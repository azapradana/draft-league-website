import assert from "node:assert/strict";
import test from "node:test";
import { buildDoubleEliminationBracket } from "../src/lib/double-elimination-bracket";

test("rejects invalid participant lists", () => {
  for (const ids of [[], ["a"], ["a", "a"], ["a", ""]]) {
    assert.throws(() => buildDoubleEliminationBracket(ids));
  }
});

for (const count of [2, 3, 4, 5, 8, 9, 16, 32]) {
  test(`builds a complete ${count}-player bracket`, () => {
    const participants = Array.from({ length: count }, (_, index) => `seed-${index + 1}`);
    const size = 2 ** Math.ceil(Math.log2(count));
    const matches = buildDoubleEliminationBracket(participants);
    const byKey = new Map(matches.map((match) => [match.key, match]));
    const incoming = new Map<string, number>();

    assert.equal(matches.length, size * 2 - 2);
    assert.equal(byKey.size, matches.length);
    assert.equal(matches.filter((match) => match.bracket === "GRAND_FINAL").length, 1);

    for (const match of matches) {
      for (const link of [match.nextWin, match.nextLose]) {
        if (!link) continue;
        assert.ok(byKey.has(link.matchKey));
        const slot = `${link.matchKey}:${link.slot}`;
        incoming.set(slot, (incoming.get(slot) ?? 0) + 1);
      }
      if (match.bracket === "LOSERS" || match.bracket === "GRAND_FINAL") {
        assert.equal(match.nextLose, null);
      }
    }

    for (const match of matches) {
      for (const slot of [1, 2] as const) {
        const initial = slot === 1 ? match.player1Id : match.player2Id;
        const feeders = incoming.get(`${match.key}:${slot}`) ?? 0;
        if (match.bracket === "WINNERS" && match.round === 1) {
          assert.equal(feeders, 0);
        } else {
          assert.equal(feeders, 1);
          assert.equal(initial, null);
        }
      }
    }

    const firstRound = matches.filter(
      (match) => match.bracket === "WINNERS" && match.round === 1,
    );
    const entrants = firstRound.flatMap((match) => [match.player1Id, match.player2Id]);
    assert.deepEqual(entrants.filter(Boolean).sort(), [...participants].sort());
    const byeSeeds = firstRound
      .filter((match) => !match.player1Id || !match.player2Id)
      .map((match) => match.player1Id ?? match.player2Id)
      .sort();
    assert.deepEqual(byeSeeds, participants.slice(0, size - count).sort());
  });

  for (const lowerBracketWinsFinal of [false, true]) {
  test(`simulates ${count} players with ${lowerBracketWinsFinal ? "losers" : "winners"} bracket champion`, () => {
    const participants = Array.from({ length: count }, (_, index) => `seed-${index + 1}`);
    const matches = buildDoubleEliminationBracket(participants);
    const slots = new Map(
      matches.map((match) => [
        match.key,
        {
          players: [match.player1Id, match.player2Id],
          ready: [
            match.bracket === "WINNERS" && match.round === 1,
            match.bracket === "WINNERS" && match.round === 1,
          ],
        },
      ]),
    );
    const finished = new Set<string>();
    const losses = new Map(participants.map((id) => [id, 0]));
    let finalWinner: string | null = null;
    let finalLoser: string | null = null;

    while (finished.size < matches.length) {
      let advanced = false;
      for (const match of matches) {
        const state = slots.get(match.key)!;
        if (finished.has(match.key) || !state.ready.every(Boolean)) continue;
        const [winner, loser] =
          match.bracket === "GRAND_FINAL" && lowerBracketWinsFinal
            ? [state.players[1], state.players[0]]
            : state.players;
        const actualWinner = winner ?? loser;
        const actualLoser = winner && loser ? loser : null;
        if (actualLoser) losses.set(actualLoser, losses.get(actualLoser)! + 1);
        if (match.bracket === "GRAND_FINAL") {
          finalWinner = actualWinner;
          finalLoser = actualLoser;
        }
        for (const [link, player] of [
          [match.nextWin, actualWinner],
          [match.nextLose, actualLoser],
        ] as const) {
          if (!link) continue;
          const target = slots.get(link.matchKey)!;
          assert.equal(target.ready[link.slot - 1], false);
          target.players[link.slot - 1] = player;
          target.ready[link.slot - 1] = true;
        }
        finished.add(match.key);
        advanced = true;
      }
      assert.ok(advanced, "bracket must not contain a cycle or unresolved feeder");
    }

    assert.ok(finalWinner);
    assert.ok(finalLoser);
    for (const participant of participants) {
      const expected: number =
        participant === finalWinner
          ? Number(lowerBracketWinsFinal)
          : participant === finalLoser && lowerBracketWinsFinal
            ? 1
            : 2;
      assert.equal(losses.get(participant), expected);
    }
  });
  }
}
