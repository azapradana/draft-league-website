export type PrizeDistribution = number[];

export function parsePrizeDistribution(value: unknown): PrizeDistribution | null {
  if (
    !Array.isArray(value) ||
    !value.every(
      (amount) => Number.isSafeInteger(amount) && amount >= 1,
    )
  ) {
    return null;
  }
  return value;
}

export function suggestPrizeDistribution(
  pool: number,
  winnersCount: number,
): PrizeDistribution {
  if (
    !Number.isSafeInteger(pool) ||
    !Number.isSafeInteger(winnersCount) ||
    pool < 0 ||
    winnersCount < 0 ||
    (pool === 0 && winnersCount !== 0) ||
    (pool > 0 && (winnersCount === 0 || winnersCount > pool))
  ) {
    return [];
  }
  if (winnersCount === 0) return [];

  const weights =
    winnersCount < 4
      ? [50, 25, 15].slice(0, winnersCount)
      : [50, 25, 15, ...Array(winnersCount - 3).fill(10 / (winnersCount - 3))];
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exactShares = weights.map((weight) => (pool * weight) / totalWeight);
  const amounts = exactShares.map((share) => Math.floor(share));
  const remainingCoins = pool - amounts.reduce((sum, amount) => sum + amount, 0);

  const remainders = exactShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainingCoins; index += 1) {
    amounts[remainders[index].index] += 1;
  }

  for (let index = 0; index < amounts.length; index += 1) {
    if (amounts[index] !== 0) continue;
    const donorIndex = amounts.reduce(
      (bestIndex, amount, currentIndex) =>
        amount > 1 &&
        (bestIndex === -1 || amount > amounts[bestIndex])
          ? currentIndex
          : bestIndex,
      -1,
    );
    if (donorIndex === -1) return [];
    amounts[donorIndex] -= 1;
    amounts[index] = 1;
  }

  return amounts;
}
