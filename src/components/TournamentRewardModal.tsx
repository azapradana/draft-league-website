"use client";

import { useEffect, useState } from "react";

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
}

export default function TournamentRewardModal({
  coinPrizePool,
  distribution,
}: {
  coinPrizePool: number;
  distribution: number[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-[#F5C542] underline underline-offset-2"
      >
        Tournament Rewards
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-rewards-title"
            className="w-full max-w-md rounded-2xl border border-[#243775] bg-[#0C1638] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="tournament-rewards-title" className="text-xl font-semibold">
                  Tournament Rewards
                </h3>
                <p className="mt-1 text-sm text-[#9FB0E6]">
                  Total prize pool:{" "}
                  <span className="font-semibold text-[#F5C542]">
                    {coinPrizePool.toLocaleString()} Coins
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-xl leading-none text-[#9FB0E6] hover:text-white"
              >
                ×
              </button>
            </div>
            {distribution.length === 0 ? (
              <p className="mt-5 text-sm text-[#9FB0E6]">
                No coin prizes have been configured for this tournament.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-[#243775] rounded-xl border border-[#243775]">
                {distribution.map((amount, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-semibold">{ordinal(index + 1)} Place</span>
                    <span className="font-semibold text-[#F5C542]">
                      {amount.toLocaleString()} Coins
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
