export function topCutStageLabel(playersInRound: number) {
  if (playersInRound <= 2) return "Grand Finals";
  if (playersInRound === 4) return "Semi Finals (Top 4)";
  return `Top ${playersInRound}`;
}

// Players remaining at the start of each planned Top Cut round, e.g. 8 -> [8, 4, 2].
export function plannedTopCutPlayerCounts(topCut: number) {
  const counts: number[] = [];
  for (let players = topCut; players >= 2; players /= 2) counts.push(players);
  return counts;
}
