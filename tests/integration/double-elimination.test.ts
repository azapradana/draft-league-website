import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient, MatchStatus } from "@prisma/client";
import { generateDoubleElimination } from "../../src/lib/double-elimination-generate";
import { advanceDoubleElimination, clearDoubleEliminationDownstream } from "../../src/lib/double-elimination-progress";
import { dropParticipant } from "../../src/lib/participant-drop";
import { lockTournamentMatchesAndParticipants } from "../../src/lib/tournament-locks";
import { rankDoubleElimination } from "../../src/lib/double-elimination-standings";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !decodeURIComponent(new URL(testUrl).pathname.slice(1)).endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must name a database ending in _test.");
}
const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
const userIds: string[] = [];
const tournamentIds: string[] = [];

after(async () => {
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function fixture(count: number) {
  const tournamentId = randomUUID();
  const players = Array.from({ length: count }, () => ({ id: randomUUID(), userId: randomUUID() }));
  userIds.push(...players.map((player) => player.userId));
  tournamentIds.push(tournamentId);
  await prisma.user.createMany({ data: players.map((player) => ({ id: player.userId })) });
  await prisma.tournament.create({
    data: {
      id: tournamentId,
      name: "Integration test",
      mode: "REGULAR",
      format: "DOUBLE_ELIMINATION",
      startedAt: new Date(),
      currentStage: "SINGLE_ELIMINATION",
    },
  });
  await prisma.participant.createMany({
    data: players.map((player) => ({
      ...player, tournamentId, status: "APPROVED", checkedIn: true,
    })),
  });
  return { tournamentId, players };
}

async function generate(tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    assert.ok(await lockTournamentMatchesAndParticipants(tx, tournamentId));
    return generateDoubleElimination(tx, tournamentId);
  }, { timeout: 30000 });
}

async function confirm(tournamentId: string, matchId: string, winnerId: string) {
  return prisma.$transaction(async (tx) => {
    assert.ok(await lockTournamentMatchesAndParticipants(tx, tournamentId));
    const match = await tx.match.findFirstOrThrow({ where: { id: matchId, tournamentId } });
    if (match.status !== "PENDING") return false;
    assert.ok(winnerId === match.player1Id || winnerId === match.player2Id);
    await tx.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.COMPLETED, winnerId },
    });
    await advanceDoubleElimination(tx, tournamentId);
    return true;
  }, { timeout: 30000 });
}

async function drop(tournamentId: string, participantId: string, userId: string) {
  return prisma.$transaction(
    (tx) => dropParticipant(tx, tournamentId, participantId, userId),
    { timeout: 30000 },
  );
}

for (const count of [4, 6, 8, 13]) {
  test(`persists and completes a ${count}-player bracket with a drop`, async () => {
    const { tournamentId, players } = await fixture(count);
    const created = await generate(tournamentId);
    const size = 2 ** Math.ceil(Math.log2(count));
    assert.equal(created.matchesCreated, 2 * size - 2);
    assert.equal(created.byes, size - count);
    await assert.rejects(() => generate(tournamentId), /already been generated/);
    let matches = await prisma.match.findMany({ where: { tournamentId } });
    const ids = new Set(matches.map((match) => match.id));
    for (const match of matches) {
      if (match.nextWinMatchId) assert.ok(ids.has(match.nextWinMatchId));
      if (match.nextLoseMatchId) assert.ok(ids.has(match.nextLoseMatchId));
      if (match.bracket === "WINNERS" && match.roundNumber === 1 && (!match.player1Id || !match.player2Id)) {
        assert.equal(match.status, "COMPLETED");
      }
    }
    let played = 0;
    let dropped = false;
    while (matches.some((match) => match.status !== "COMPLETED")) {
      const match = matches.find((entry) => entry.status === "PENDING" && entry.player1Id && entry.player2Id);
      assert.ok(match, "expected a playable match");
      if (!dropped && played >= 1) {
        const loser = players.find((player) => player.id === match.player2Id)!;
        const result = await drop(tournamentId, loser.id, loser.userId);
        assert.ok(result.ok);
        dropped = true;
      } else {
        assert.ok(await confirm(tournamentId, match.id, match.player1Id!));
        played += 1;
      }
      assert.ok(played < size * 2);
      matches = await prisma.match.findMany({ where: { tournamentId } });
    }
    const final = matches.find((match) => match.bracket === "GRAND_FINAL")!;
    assert.ok(final.winnerId);
    const participants = await prisma.participant.findMany({ where: { tournamentId } });
    const ranking = rankDoubleElimination(participants, matches);
    assert.equal(ranking[0].id, final.winnerId);
    assert.equal(ranking[1].id, final.winnerId === final.player1Id ? final.player2Id : final.player1Id);
    const losses = new Map<string, number>(players.map((player) => [player.id, 0]));
    for (const match of matches) {
      if (!match.player1Id || !match.player2Id || !match.winnerId) continue;
      const loser = match.player1Id === match.winnerId ? match.player2Id : match.player1Id;
      losses.set(loser, losses.get(loser)! + 1);
    }
    for (const lossCount of losses.values()) assert.ok(lossCount <= 2);
  });
}

test("parallel confirms serialize without duplicate advancement", async () => {
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const { tournamentId } = await fixture(4);
    await generate(tournamentId);
    const match = await prisma.match.findFirstOrThrow({
      where: { tournamentId, bracket: "WINNERS", roundNumber: 1 },
    });
    const result = await Promise.all([
      confirm(tournamentId, match.id, match.player1Id!),
      confirm(tournamentId, match.id, match.player1Id!),
    ]);
    assert.equal(result.filter(Boolean).length, 1);
    const target = await prisma.match.findUniqueOrThrow({ where: { id: match.nextWinMatchId! } });
    assert.equal(match.nextWinSlot === 1 ? target.player1Id : target.player2Id, match.player1Id);
  }
});

test("confirm and drop serialize on the same match", async () => {
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const { tournamentId, players } = await fixture(4);
    await generate(tournamentId);
    const match = await prisma.match.findFirstOrThrow({
      where: { tournamentId, bracket: "WINNERS", roundNumber: 1 },
    });
    const player = players.find((item) => item.id === match.player2Id)!;
    await Promise.all([
      confirm(tournamentId, match.id, match.player1Id!),
      drop(tournamentId, player.id, player.userId),
    ]);
    const saved = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    assert.equal(saved.status, "COMPLETED");
    assert.equal(saved.winnerId, match.player1Id);
  }
});

test("override refuses a downstream result", async () => {
  const { tournamentId } = await fixture(4);
  await generate(tournamentId);
  const first = await prisma.match.findFirstOrThrow({
    where: { tournamentId, bracket: "WINNERS", roundNumber: 1 },
  });
  await confirm(tournamentId, first.id, first.player1Id!);
  await prisma.match.update({
    where: { id: first.nextWinMatchId! },
    data: { player1Vote: first.player1Id },
  });
  const allowed = await prisma.$transaction(async (tx) => {
    assert.ok(await lockTournamentMatchesAndParticipants(tx, tournamentId));
    return clearDoubleEliminationDownstream(tx, tournamentId, first.id);
  });
  assert.equal(allowed, false);
});

test("two drops feeding the same losers match serialize", async () => {
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const { tournamentId, players } = await fixture(4);
    await generate(tournamentId);
    const first = await prisma.match.findMany({
      where: { tournamentId, bracket: "WINNERS", roundNumber: 1 },
      orderBy: { bracketPosition: "asc" },
    });
    const droppers = first.map((match) => players.find((player) => player.id === match.player2Id)!);
    const results = await Promise.all(droppers.map((player) => drop(tournamentId, player.id, player.userId)));
    assert.ok(results.every((result) => result.ok));
    const losersMatch = await prisma.match.findUniqueOrThrow({ where: { id: first[0].nextLoseMatchId! } });
    assert.equal(first[0].nextLoseMatchId, first[1].nextLoseMatchId);
    assert.deepEqual(new Set([losersMatch.player1Id, losersMatch.player2Id]), new Set(droppers.map((player) => player.id)));
    assert.equal(losersMatch.status, "COMPLETED");
  }
});

test("override and confirmation of the same match serialize", async () => {
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const { tournamentId } = await fixture(4);
    await generate(tournamentId);
    const match = await prisma.match.findFirstOrThrow({
      where: { tournamentId, bracket: "WINNERS", roundNumber: 1 },
    });
    await Promise.all([
      confirm(tournamentId, match.id, match.player1Id!),
      prisma.$transaction(async (tx) => {
        assert.ok(await lockTournamentMatchesAndParticipants(tx, tournamentId));
        const fresh = await tx.match.findUniqueOrThrow({ where: { id: match.id } });
        if (fresh.status === "COMPLETED" && fresh.winnerId !== match.player2Id) {
          assert.ok(await clearDoubleEliminationDownstream(tx, tournamentId, match.id));
        }
        await tx.match.update({
          where: { id: match.id },
          data: { status: "COMPLETED", winnerId: match.player2Id },
        });
        await advanceDoubleElimination(tx, tournamentId);
      }, { timeout: 30000 }),
    ]);
    const saved = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    const target = await prisma.match.findUniqueOrThrow({ where: { id: match.nextWinMatchId! } });
    assert.equal(saved.winnerId, match.player2Id);
    assert.equal(match.nextWinSlot === 1 ? target.player1Id : target.player2Id, saved.winnerId);
  }
});

test("generation and advancement use bounded statements", async () => {
  const { tournamentId } = await fixture(13);
  const measured = new PrismaClient({
    datasources: { db: { url: testUrl } },
    log: [{ emit: "event", level: "query" }],
  });
  let queries = 0;
  measured.$on("query", () => { queries += 1; });
  try {
    await measured.$transaction(async (tx) => {
      assert.ok(await lockTournamentMatchesAndParticipants(tx, tournamentId));
      await generateDoubleElimination(tx, tournamentId);
    }, { timeout: 30000 });
    assert.ok(queries <= 16, `generation used ${queries} statements`);
    queries = 0;
    const matches = await measured.match.findMany({
      where: { tournamentId, bracket: { not: null } },
      select: { id: true, player1Id: true, player2Id: true, status: true },
    });
    assert.equal(queries, 1, "loading the bracket must use one query");
    const playable = matches.find((match) => match.status === "PENDING" && match.player1Id && match.player2Id)!;
    queries = 0;
    await measured.$transaction(async (tx) => {
      assert.ok(await lockTournamentMatchesAndParticipants(tx, tournamentId));
      await tx.match.update({ where: { id: playable.id }, data: { status: "COMPLETED", winnerId: playable.player1Id } });
      await advanceDoubleElimination(tx, tournamentId);
    }, { timeout: 30000 });
    assert.ok(queries <= 10, `advancement used ${queries} statements`);
  } finally {
    await measured.$disconnect();
  }
});
