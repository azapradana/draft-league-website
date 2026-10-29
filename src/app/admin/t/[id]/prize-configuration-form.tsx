"use client";

import { useState } from "react";
import {
  parsePrizeDistribution,
  suggestPrizeDistribution,
} from "@/lib/prize-distribution";

const MAX_COIN_PRIZE_POOL = 2_147_483_647;
const MAX_PRIZE_WINNERS = 1000;

function isWholeNumber(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

export function PrizeConfigurationForm({
  tournamentId,
  initialPool,
  initialWinnersCount,
  initialDistribution,
  disabled,
}: {
  tournamentId: string;
  initialPool: number;
  initialWinnersCount: number;
  initialDistribution: unknown;
  disabled: boolean;
}) {
  const [poolInput, setPoolInput] = useState(String(initialPool));
  const [winnersInput, setWinnersInput] = useState(String(initialWinnersCount));
  const initialAmounts = parsePrizeDistribution(initialDistribution);
  const [amounts, setAmounts] = useState(
    initialAmounts?.length === initialWinnersCount
      ? initialAmounts
      : suggestPrizeDistribution(initialPool, initialWinnersCount),
  );

  function updateConfiguration(nextPoolInput: string, nextWinnersInput: string) {
    setPoolInput(nextPoolInput);
    setWinnersInput(nextWinnersInput);
    if (!isWholeNumber(nextPoolInput) || !isWholeNumber(nextWinnersInput)) {
      setAmounts([]);
      return;
    }

    setAmounts(
      suggestPrizeDistribution(
        Number(nextPoolInput),
        Number(nextWinnersInput),
      ),
    );
  }

  const pool = isWholeNumber(poolInput) ? Number(poolInput) : -1;
  const winnersCount = isWholeNumber(winnersInput) ? Number(winnersInput) : -1;
  const amountsTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  const configurationValid =
    pool >= 0 &&
    pool <= MAX_COIN_PRIZE_POOL &&
    winnersCount >= 0 &&
    winnersCount <= MAX_PRIZE_WINNERS &&
    ((pool === 0 && winnersCount === 0) ||
      (pool > 0 && winnersCount > 0 && winnersCount <= pool)) &&
    amounts.length === winnersCount &&
    amounts.every((amount) => Number.isSafeInteger(amount) && amount >= 1) &&
    amountsTotal === pool;

  return (
    <form action="/api/admin" method="POST" className="mt-6 space-y-5">
      <input type="hidden" name="action" value="updateTournament" />
      <input type="hidden" name="id" value={tournamentId} />
      <input type="hidden" name="prizeDistribution" value={JSON.stringify(amounts)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm text-[#9FB0E6]">
            Total Coin Prize Pool
          </span>
          <input
            name="coinPrizePool"
            type="number"
            min={0}
            max={MAX_COIN_PRIZE_POOL}
            step={1}
            required
            disabled={disabled}
            value={poolInput}
            onChange={(event) =>
              updateConfiguration(event.target.value, winnersInput)
            }
            className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF] disabled:opacity-60"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-[#9FB0E6]">
            Number of Winning Ranks (N)
          </span>
          <input
            name="prizeWinnersCount"
            type="number"
            min={0}
            max={MAX_PRIZE_WINNERS}
            step={1}
            required
            disabled={disabled}
            value={winnersInput}
            onChange={(event) =>
              updateConfiguration(poolInput, event.target.value)
            }
            className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF] disabled:opacity-60"
          />
        </label>
      </div>

      <div className="rounded-xl border border-[#243775] bg-[#070D24]/60 p-4">
        <p className="text-sm text-[#9FB0E6]">
          Suggested weights are 50% / 25% / 15%, with the remaining 10% split
          evenly among ranks 4 and below. For fewer than four ranks, those
          weights are scaled proportionally. Every rank receives at least one
          coin; leftover coins are assigned by largest fractional remainder.
          Edit individual payouts to override the suggestion.
        </p>
        {amounts.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {amounts.map((amount, index) => (
              <label className="block" key={index}>
                <span className="mb-2 block text-sm text-[#9FB0E6]">
                  Rank {index + 1} payout
                  {pool > 0 ? ` · ${((amount / pool) * 100).toFixed(1)}%` : ""}
                </span>
                <input
                  aria-label={`Rank ${index + 1} payout in coins`}
                  type="number"
                  min={1}
                  max={MAX_COIN_PRIZE_POOL}
                  step={1}
                  required
                  disabled={disabled}
                  value={amount}
                  onChange={(event) => {
                    if (!isWholeNumber(event.target.value)) {
                      setAmounts((current) =>
                        current.map((value, rank) =>
                          rank === index ? 0 : value,
                        ),
                      );
                      return;
                    }
                    const nextAmount = Number(event.target.value);
                    setAmounts((current) =>
                      current.map((value, rank) =>
                        rank === index ? nextAmount : value,
                      ),
                    );
                  }}
                  className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF] disabled:opacity-60"
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#9FB0E6]">
            Set a positive prize pool and at least one winning rank to configure
            payouts.
          </p>
        )}
        <p
          className={`mt-4 text-sm ${
            configurationValid ? "text-emerald-300" : "text-amber-300"
          }`}
          aria-live="polite"
        >
          Configured payouts: {amountsTotal.toLocaleString()} /{" "}
          {Math.max(pool, 0).toLocaleString()} coins
        </p>
      </div>

      {disabled ? (
        <p className="text-sm text-[#9FB0E6]">
          Prize configuration is locked because this tournament is complete.
        </p>
      ) : (
        <button
          type="submit"
          disabled={!configurationValid}
          className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save prize configuration
        </button>
      )}
    </form>
  );
}
