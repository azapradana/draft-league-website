export type DoubleEliminationBracket = "WINNERS" | "LOSERS" | "GRAND_FINAL";
export type BracketSlot = 1 | 2;

export type BracketLink = {
  matchKey: string;
  slot: BracketSlot;
};

export type DoubleEliminationMatch = {
  key: string;
  bracket: DoubleEliminationBracket;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  nextWin: BracketLink | null;
  nextLose: BracketLink | null;
};

function seedPositions(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    seeds = seeds.flatMap((seed) => [seed, sum - seed]);
  }
  return seeds;
}

/**
 * Constructs a fixed graph from participants in seed order.
 * The caller is responsible for shuffling participants using the existing
 * tournament seeding procedure before calling this function.
 */
export function buildDoubleEliminationBracket(
  participantIds: readonly string[],
): DoubleEliminationMatch[] {
  if (
    participantIds.length < 2 ||
    participantIds.some((id) => !id) ||
    new Set(participantIds).size !== participantIds.length
  ) {
    throw new Error("At least two distinct participants are required.");
  }

  const size = 2 ** Math.ceil(Math.log2(participantIds.length));
  const winnersRounds = Math.log2(size);
  const matches: DoubleEliminationMatch[] = [];

  function add(
    bracket: DoubleEliminationBracket,
    round: number,
    position: number,
  ): DoubleEliminationMatch {
    const prefix = bracket === "WINNERS" ? "W" : bracket === "LOSERS" ? "L" : "G";
    const match: DoubleEliminationMatch = {
      key: `${prefix}${round}-${position}`,
      bracket,
      round,
      position,
      player1Id: null,
      player2Id: null,
      nextWin: null,
      nextLose: null,
    };
    matches.push(match);
    return match;
  }

  const winners = Array.from({ length: winnersRounds }, (_, index) =>
    Array.from({ length: size / 2 ** (index + 1) }, (_, position) =>
      add("WINNERS", index + 1, position + 1),
    ),
  );
  const losers = Array.from({ length: 2 * (winnersRounds - 1) }, (_, index) =>
    Array.from(
      { length: size / 2 ** (Math.floor(index / 2) + 2) },
      (_, position) => add("LOSERS", index + 1, position + 1),
    ),
  );
  const final = add("GRAND_FINAL", 1, 1);
  const seeds = seedPositions(size);

  winners[0].forEach((match, index) => {
    match.player1Id = participantIds[seeds[index * 2] - 1] ?? null;
    match.player2Id = participantIds[seeds[index * 2 + 1] - 1] ?? null;
  });

  winners.forEach((round, roundIndex) => {
    round.forEach((match, position) => {
      match.nextWin =
        roundIndex === winnersRounds - 1
          ? { matchKey: final.key, slot: 1 }
          : {
              matchKey: winners[roundIndex + 1][Math.floor(position / 2)].key,
              slot: (position % 2 + 1) as BracketSlot,
            };
      if (winnersRounds === 1) {
        match.nextLose = { matchKey: final.key, slot: 2 };
      } else if (roundIndex === 0) {
        match.nextLose = {
          matchKey: losers[0][Math.floor(position / 2)].key,
          slot: (position % 2 + 1) as BracketSlot,
        };
      } else {
        const dropRound = losers[roundIndex * 2 - 1];
        match.nextLose = {
          matchKey: dropRound[dropRound.length - 1 - position].key,
          slot: 2,
        };
      }
    });
  });

  losers.forEach((round, roundIndex) => {
    round.forEach((match, position) => {
      if (roundIndex === losers.length - 1) {
        match.nextWin = { matchKey: final.key, slot: 2 };
      } else if (roundIndex % 2 === 0) {
        match.nextWin = { matchKey: losers[roundIndex + 1][position].key, slot: 1 };
      } else {
        match.nextWin = {
          matchKey: losers[roundIndex + 1][Math.floor(position / 2)].key,
          slot: (position % 2 + 1) as BracketSlot,
        };
      }
    });
  });

  return matches;
}
