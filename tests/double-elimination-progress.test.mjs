import assert from "node:assert/strict";
import test from "node:test";
import { buildDoubleEliminationBracket } from "../src/lib/double-elimination-bracket.ts";
import { advanceDoubleElimination, clearDoubleEliminationDownstream } from "../src/lib/double-elimination-progress.ts";

function fixture(count) {
  const players = Array.from({ length: count }, (_, index) => `player-${index + 1}`);
  const skeleton = buildDoubleEliminationBracket(players);
  const matches = skeleton.map((match) => ({
    id: match.key,
    bracket: match.bracket,
    roundNumber: match.round,
    player1Id: match.player1Id,
    player2Id: match.player2Id,
    status: "PENDING",
    winnerId: null,
    nextWinMatchId: match.nextWin?.matchKey ?? null,
    nextWinSlot: match.nextWin?.slot ?? null,
    nextLoseMatchId: match.nextLose?.matchKey ?? null,
    nextLoseSlot: match.nextLose?.slot ?? null,
    autoResolved: false,
    forfeitedParticipantId: null,
    player1Vote: null,
    player2Vote: null,
    player1DrawVote: false,
    player2DrawVote: false,
    scheduledAt: null,
    _count: { messages: 0 },
  }));
  const dropped = new Set();
  const tx = {
    match: {
      findMany: async () => matches.map((match) => ({ ...match })),
      update: async ({ where, data }) => Object.assign(matches.find((match) => match.id === where.id), data),
    },
    participant: {
      findMany: async () => [...dropped].map((id) => ({ id })),
    },
    $executeRaw: async (_query, payload) => {
      for (const update of JSON.parse(payload)) {
        const match = matches.find(({ id }) => id === update.id);
        if ("clear1" in update) {
          if (update.clear1) match.player1Id = null;
          if (update.clear2) match.player2Id = null;
          if (update.reset) Object.assign(match, {
            status: "PENDING", winnerId: null, autoResolved: false,
            forfeitedParticipantId: null,
          });
        } else {
          Object.assign(match, update);
        }
      }
    },
  };
  return { tx, matches, players, dropped };
}

for (const count of [4, 6, 8, 13]) {
  for (const withDrop of [false, true]) {
    test(`advances ${count} players${withDrop ? " with a drop" : ""}`, async () => {
      const { tx, matches, players, dropped } = fixture(count);
      await advanceDoubleElimination(tx, "tournament");
      if (withDrop) {
        dropped.add(players.at(-1));
        await advanceDoubleElimination(tx, "tournament");
      }
      let played = 0;
      while (matches.some((match) => match.status !== "COMPLETED")) {
        const next = matches.find((match) =>
          match.status === "PENDING" && match.player1Id && match.player2Id &&
          !dropped.has(match.player1Id) && !dropped.has(match.player2Id),
        );
        assert.ok(next, "there must be a playable match");
        next.status = "COMPLETED";
        next.winnerId = next.player1Id;
        await advanceDoubleElimination(tx, "tournament");
        assert.ok(++played < count * 2);
      }
      const final = matches.find((match) => match.bracket === "GRAND_FINAL");
      assert.ok(final.winnerId);
      assert.ok(!dropped.has(final.winnerId));
      const snapshot = JSON.stringify(matches);
      await advanceDoubleElimination(tx, "tournament");
      assert.equal(JSON.stringify(matches), snapshot);
    });
  }
}

test("blocks overrides after a downstream vote without modifying the bracket", async () => {
  const { tx, matches } = fixture(4);
  const first = matches.find((match) => match.id === "W1-1");
  first.status = "COMPLETED";
  first.winnerId = first.player1Id;
  await advanceDoubleElimination(tx, "tournament");
  const downstream = matches.find((match) => match.id === first.nextWinMatchId);
  downstream.player1Vote = first.winnerId;
  const before = JSON.stringify(matches);
  assert.equal(await clearDoubleEliminationDownstream(tx, "tournament", first.id), false);
  assert.equal(JSON.stringify(matches), before);
});

test("clears unstarted downstream slots for a changed result", async () => {
  const { tx, matches } = fixture(4);
  const first = matches.find((match) => match.id === "W1-1");
  first.status = "COMPLETED";
  first.winnerId = first.player1Id;
  await advanceDoubleElimination(tx, "tournament");
  assert.equal(await clearDoubleEliminationDownstream(tx, "tournament", first.id), true);
  first.winnerId = first.player2Id;
  await advanceDoubleElimination(tx, "tournament");
  const winnerTarget = matches.find((match) => match.id === first.nextWinMatchId);
  const loserTarget = matches.find((match) => match.id === first.nextLoseMatchId);
  assert.equal(winnerTarget[`player${first.nextWinSlot}Id`], first.player2Id);
  assert.equal(loserTarget[`player${first.nextLoseSlot}Id`], first.player1Id);
});

test("blocks overrides when a later descendant has a result", async () => {
  const { tx, matches } = fixture(8);
  const first = matches.find((match) => match.id === "W1-1");
  const final = matches.find((match) => match.bracket === "GRAND_FINAL");
  final.status = "COMPLETED";
  final.autoResolved = false;
  const before = JSON.stringify(matches);
  assert.equal(await clearDoubleEliminationDownstream(tx, "tournament", first.id), false);
  assert.equal(JSON.stringify(matches), before);
});
