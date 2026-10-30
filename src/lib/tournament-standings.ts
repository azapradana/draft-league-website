export type SwissParticipant = {
  id: string;
  user: {
    name: string | null;
    username: string | null;
    email?: string | null;
  };
};

export type SwissMatch = {
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  status: string;
  stage?: string | null;
};

export type SwissRoundMatch = SwissMatch & {
  roundNumber: number;
};

export type SwissStanding = SwissParticipant & {
  matchWins: number;
  matchLosses: number;
  matchPoints: number;
  opponentMatchWinPercentage: number;
  byes: number;
};

export function hasCompletedSwissRounds(
  matches: SwissRoundMatch[],
  swissRounds: number,
): boolean {
  const roundNumbers = [...new Set(matches.map((match) => match.roundNumber))];

  return (
    swissRounds > 0 &&
    roundNumbers.length === swissRounds &&
    roundNumbers.every((roundNumber, index) => roundNumber === index + 1) &&
    matches.every(
      (match) =>
        match.status === "COMPLETED" &&
        match.winnerId !== null &&
        (match.winnerId === match.player1Id ||
          match.winnerId === match.player2Id),
    )
  );
}

export function buildSwissStandings(
  participants: SwissParticipant[],
  matches: SwissMatch[],
): SwissStanding[] {
  const records = new Map(
    participants.map((participant) => [
      participant.id,
      {
        participant,
        matchWins: 0,
        matchLosses: 0,
        byes: 0,
        opponents: [] as string[],
      },
    ]),
  );

  for (const match of matches) {
    if (
      (match.stage !== undefined &&
        match.stage !== null &&
        match.stage !== "SWISS") ||
      match.status !== "COMPLETED" ||
      !match.winnerId
    ) {
      continue;
    }

    const player1 = match.player1Id ? records.get(match.player1Id) : undefined;
    const player2 = match.player2Id ? records.get(match.player2Id) : undefined;
    if (!player1) continue;

    if (!player2) {
      if (match.winnerId === match.player1Id) {
        player1.matchWins += 1;
        player1.byes += 1;
      }
      continue;
    }

    player1.opponents.push(player2.participant.id);
    player2.opponents.push(player1.participant.id);
    if (match.winnerId === match.player1Id) {
      player1.matchWins += 1;
      player2.matchLosses += 1;
    } else if (match.winnerId === match.player2Id) {
      player2.matchWins += 1;
      player1.matchLosses += 1;
    }
  }

  const matchWinPercentages = new Map(
    [...records].map(([participantId, record]) => {
      const matchesPlayed = record.matchWins + record.matchLosses;
      return [
        participantId,
        matchesPlayed === 0
          ? 0.33
          : Math.max(0.33, record.matchWins / matchesPlayed),
      ];
    }),
  );

  return [...records.values()]
    .map(({ participant, matchWins, matchLosses, byes, opponents }) => {
      const opponentMatchWinPercentage =
        opponents.length === 0
          ? 0
          : opponents.reduce(
              (total, opponentId) =>
                total + (matchWinPercentages.get(opponentId) ?? 0.33),
              0,
            ) / opponents.length;

      return {
        ...participant,
        matchWins,
        matchLosses,
        matchPoints: matchWins * 3,
        opponentMatchWinPercentage,
        byes,
      };
    })
    .sort((a, b) => {
      const pointsDifference = b.matchPoints - a.matchPoints;
      if (pointsDifference !== 0) return pointsDifference;

      const opponentPercentageDifference =
        b.opponentMatchWinPercentage - a.opponentMatchWinPercentage;
      if (opponentPercentageDifference !== 0) {
        return opponentPercentageDifference;
      }

      const winsDifference = b.matchWins - a.matchWins;
      if (winsDifference !== 0) return winsDifference;

      const aName = a.user.name ?? a.user.username ?? a.user.email ?? "";
      const bName = b.user.name ?? b.user.username ?? b.user.email ?? "";
      return aName.localeCompare(bName) || a.id.localeCompare(b.id);
    });
}
