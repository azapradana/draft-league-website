type StandingParticipant = { id: string; bracketSeed: number | null };
type StandingMatch = {
  bracket: string | null;
  roundNumber: number;
  bracketPosition: number | null;
  status: string;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
};

export function rankDoubleElimination<T extends StandingParticipant>(
  participants: T[],
  matches: StandingMatch[],
): T[] {
  const ranked: string[] = [];
  const add = (id: string | null) => {
    if (id && !ranked.includes(id)) ranked.push(id);
  };
  const final = matches.find(
    (match) => match.bracket === "GRAND_FINAL" && match.status === "COMPLETED" && match.winnerId,
  );
  if (final) {
    add(final.winnerId);
    add(final.winnerId === final.player1Id ? final.player2Id : final.player1Id);
  }
  const seeds = new Map(participants.map((participant) => [participant.id, participant.bracketSeed]));
  const eliminations = matches
    .filter((match) => match.bracket === "LOSERS" && match.status === "COMPLETED" && match.winnerId && match.player1Id && match.player2Id)
    .map((match) => ({
      id: match.winnerId === match.player1Id ? match.player2Id! : match.player1Id!,
      round: match.roundNumber,
    }))
    .sort((a, b) => b.round - a.round || (seeds.get(a.id) ?? Infinity) - (seeds.get(b.id) ?? Infinity) || a.id.localeCompare(b.id));
  for (const elimination of eliminations) add(elimination.id);
  for (const participant of [...participants].sort((a, b) =>
    (a.bracketSeed ?? Infinity) - (b.bracketSeed ?? Infinity) || a.id.localeCompare(b.id)
  )) add(participant.id);
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  return ranked.flatMap((id) => {
    const participant = byId.get(id);
    return participant ? [participant] : [];
  });
}
