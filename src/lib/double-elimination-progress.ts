import { MatchStatus, type Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Reconciles a locked bracket after a result or drop. A slot fed by a completed
 * match is settled even when that feeder has no winner (an empty bye).
 */
export async function advanceDoubleElimination(tx: Tx, tournamentId: string) {
  const [matches, dropped] = await Promise.all([
    tx.match.findMany({
      where: { tournamentId, bracket: { not: null } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        bracket: true,
        roundNumber: true,
        player1Id: true,
        player2Id: true,
        winnerId: true,
        status: true,
        nextWinMatchId: true,
        nextWinSlot: true,
        nextLoseMatchId: true,
        nextLoseSlot: true,
        autoResolved: true,
        forfeitedParticipantId: true,
      },
    }),
    tx.participant.findMany({
      where: { tournamentId, droppedAt: { not: null } },
      select: { id: true },
    }),
  ]);
  const byId = new Map(matches.map((match) => [match.id, match]));
  const updatedIds = new Set<string>();
  const droppedIds = new Set(dropped.map((participant) => participant.id));
  const incoming = new Map<string, { sourceId: string; slot: number; loser: boolean }[]>();

  for (const match of matches) {
    for (const [targetId, slot, loser] of [
      [match.nextWinMatchId, match.nextWinSlot, false],
      [match.nextLoseMatchId, match.nextLoseSlot, true],
    ] as const) {
      if (!targetId) continue;
      if (!byId.has(targetId) || (slot !== 1 && slot !== 2)) {
        throw new Error("Invalid double-elimination bracket link.");
      }
      const feeders = incoming.get(targetId) ?? [];
      if (feeders.some((feeder) => feeder.slot === slot)) {
        throw new Error("Multiple bracket links target the same slot.");
      }
      feeders.push({ sourceId: match.id, slot, loser });
      incoming.set(targetId, feeders);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const match of matches) {
      const firstRound = match.bracket === "WINNERS" && match.roundNumber === 1;
      const feeders = incoming.get(match.id) ?? [];
      if (!firstRound) {
        if (feeders.length !== 2) throw new Error("Bracket match has incomplete feeders.");
        for (const feeder of feeders) {
          const source = byId.get(feeder.sourceId)!;
          if (source.status !== MatchStatus.COMPLETED) continue;
          const player = feeder.loser
            ? source.winnerId === source.player1Id
              ? source.player2Id
              : source.player1Id
            : source.winnerId;
          const key = feeder.slot === 1 ? "player1Id" : "player2Id";
          if (match[key] !== player) {
            if (match.status === MatchStatus.COMPLETED) {
              throw new Error("Cannot change a completed downstream match.");
            }
            match[key] = player;
            updatedIds.add(match.id);
            changed = true;
          }
        }
      }

      const ready =
        firstRound ||
        feeders.every((feeder) => byId.get(feeder.sourceId)!.status === MatchStatus.COMPLETED);
      if (!ready || match.status === MatchStatus.COMPLETED) continue;

      const [player1, player2] = [match.player1Id, match.player2Id];
      const player1Dropped = player1 !== null && droppedIds.has(player1);
      const player2Dropped = player2 !== null && droppedIds.has(player2);
      if (match.status === MatchStatus.DISPUTED && !player1Dropped && !player2Dropped) continue;
      if (player1 && player2 && !player1Dropped && !player2Dropped) continue;
      const winnerId =
        player1Dropped && player2Dropped ? player1 :
        player1Dropped ? player2 : player2Dropped ? player1 : player1 ?? player2;
      const forfeitedParticipantId =
        player1 && player2
          ? (player1Dropped && player2Dropped ? player2 : player1Dropped ? player1 : player2Dropped ? player2 : null)
          : null;
      match.status = MatchStatus.COMPLETED;
      match.winnerId = winnerId;
      match.autoResolved = true;
      match.forfeitedParticipantId = forfeitedParticipantId;
      updatedIds.add(match.id);
      changed = true;
    }
  }
  if (updatedIds.size > 0) {
    const updates = matches.filter((match) => updatedIds.has(match.id)).map((match) => ({
      id: match.id,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      winnerId: match.winnerId,
      status: match.status,
      autoResolved: match.autoResolved,
      forfeitedParticipantId: match.forfeitedParticipantId,
    }));
    await tx.$executeRaw`
      UPDATE "Match" AS m SET
        "player1Id" = v."player1Id",
        "player2Id" = v."player2Id",
        "winnerId" = v."winnerId",
        "status" = v."status"::"MatchStatus",
        "autoResolved" = v."autoResolved",
        "forfeitedParticipantId" = v."forfeitedParticipantId",
        "updatedAt" = CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb)
        AS v(id text, "player1Id" text, "player2Id" text, "winnerId" text,
             status text, "autoResolved" boolean, "forfeitedParticipantId" text)
      WHERE m.id = v.id AND m."tournamentId" = ${tournamentId}
    `;
  }
}

export async function clearDoubleEliminationDownstream(
  tx: Tx,
  tournamentId: string,
  matchId: string,
): Promise<boolean> {
  const matches = await tx.match.findMany({
    where: { tournamentId, bracket: { not: null } },
    select: {
      id: true,
      nextWinMatchId: true,
      nextWinSlot: true,
      nextLoseMatchId: true,
      nextLoseSlot: true,
      status: true,
      autoResolved: true,
      player1Vote: true,
      player2Vote: true,
      player1DrawVote: true,
      player2DrawVote: true,
      scheduledAt: true,
      _count: { select: { messages: true } },
    },
  });
  const byId = new Map(matches.map((match) => [match.id, match]));
  if (!byId.has(matchId)) throw new Error("Bracket match not found.");
  const slots = new Map<string, Set<number>>();
  const seen = new Set([matchId]);
  const queue = [matchId];
  for (let index = 0; index < queue.length; index += 1) {
    const source = byId.get(queue[index])!;
    for (const [targetId, slot] of [
      [source.nextWinMatchId, source.nextWinSlot],
      [source.nextLoseMatchId, source.nextLoseSlot],
    ] as const) {
      if (!targetId) continue;
      if (!byId.has(targetId) || (slot !== 1 && slot !== 2)) {
        throw new Error("Invalid double-elimination bracket link.");
      }
      const affected = slots.get(targetId) ?? new Set<number>();
      affected.add(slot);
      slots.set(targetId, affected);
      if (!seen.has(targetId)) {
        seen.add(targetId);
        queue.push(targetId);
      }
    }
  }
  for (const id of queue.slice(1)) {
    const match = byId.get(id)!;
    if (
      match.status === MatchStatus.DISPUTED ||
      (match.status === MatchStatus.COMPLETED && !match.autoResolved) ||
      match.player1Vote !== null || match.player2Vote !== null ||
      match.player1DrawVote || match.player2DrawVote ||
      match._count.messages > 0 ||
      (match.scheduledAt !== null && match.scheduledAt <= new Date())
    ) return false;
  }
  if (queue.length > 1) {
    const updates = queue.slice(1).map((id) => ({
      id,
      clear1: slots.get(id)!.has(1),
      clear2: slots.get(id)!.has(2),
      reset: byId.get(id)!.autoResolved,
    }));
    await tx.$executeRaw`
      UPDATE "Match" AS m SET
        "player1Id" = CASE WHEN v.clear1 THEN NULL ELSE m."player1Id" END,
        "player2Id" = CASE WHEN v.clear2 THEN NULL ELSE m."player2Id" END,
        "winnerId" = CASE WHEN v.reset THEN NULL ELSE m."winnerId" END,
        "status" = CASE WHEN v.reset THEN 'PENDING'::"MatchStatus" ELSE m."status" END,
        "autoResolved" = CASE WHEN v.reset THEN false ELSE m."autoResolved" END,
        "forfeitedParticipantId" = CASE WHEN v.reset THEN NULL ELSE m."forfeitedParticipantId" END,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb)
        AS v(id text, clear1 boolean, clear2 boolean, reset boolean)
      WHERE m.id = v.id AND m."tournamentId" = ${tournamentId}
    `;
  }
  return true;
}
