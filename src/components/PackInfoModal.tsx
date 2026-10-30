"use client";

import { useEffect, useRef } from "react";

export type PackInfoTier = {
  name: string;
  color: string;
  weight: number;
  minimumOne: boolean;
  species: Array<{ dex: number; name: string }>;
};

export default function PackInfoModal({
  packName,
  tiers,
  onClose,
}: {
  packName: string;
  tiers: PackInfoTier[];
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const tierWeight = (weight: number) => Math.round(weight * 10_000);
  const weightedTiers = tiers.filter(
    (tier) => tier.species.length > 0 && tierWeight(tier.weight) > 0,
  );
  const totalWeight = weightedTiers.reduce(
    (sum, tier) => sum + tierWeight(tier.weight),
    0,
  );
  const listedTiers = tiers.filter((tier) => tier.species.length > 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="pack-info-title"
        aria-modal="true"
        className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638] shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#243775] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9FB0E6]">
              Pack Information
            </p>
            <h2
              className="mt-1 truncate text-xl font-bold text-[#EEF2FF]"
              id="pack-info-title"
            >
              {packName}
            </h2>
          </div>
          <button
            aria-label="Close pack information"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-[#9FB0E6] transition hover:bg-[#172653] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <p className="mb-4 text-sm leading-6 text-[#9FB0E6]">
            Tier odds are normalized across weighted tiers. Pokémon within each tier
            are equally likely; guaranteed tiers also receive one pull per pack.
            Tournament copy limits may affect current eligibility.
          </p>

          {listedTiers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#243775] p-5 text-sm text-[#9FB0E6]">
              No Pokémon have been added to this pack yet.
            </p>
          ) : (
            <div className="space-y-4">
              {listedTiers.map((tier) => {
                const tierOdds =
                  totalWeight > 0 && tierWeight(tier.weight) > 0
                    ? (tierWeight(tier.weight) / totalWeight) * 100
                    : 0;
                const perSpeciesOdds =
                  tier.species.length > 0 ? tierOdds / tier.species.length : 0;

                return (
                  <section
                    aria-label={`${tier.name} tier`}
                    className="overflow-hidden rounded-xl border border-[#243775] bg-[#070D24]/60"
                    key={tier.name}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#243775]/70 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className="font-semibold"
                          style={{ color: tier.color }}
                        >
                          {tier.name}
                        </h3>
                        {tier.minimumOne && (
                          <span className="rounded-full bg-[#F5C542]/10 px-2 py-1 text-[11px] font-semibold text-[#F5C542]">
                            Guaranteed
                          </span>
                        )}
                      </div>
                      <p className="text-xs tabular-nums text-[#9FB0E6]">
                        Weight {tier.weight.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        <span className="mx-1.5 text-[#52618C]">·</span>
                        {tierOdds.toFixed(2)}% of weighted pulls
                      </p>
                    </div>
                    <ul className="divide-y divide-[#243775]/50">
                      {tier.species.map((species) => (
                        <li
                          className="flex items-center justify-between gap-3 px-4 py-3"
                          key={species.dex}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="w-9 shrink-0 text-xs tabular-nums text-[#7181B3]">
                              #{String(species.dex).padStart(3, "0")}
                            </span>
                            <span className="truncate text-sm font-medium text-[#EEF2FF]">
                              {species.name}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-[#9FB0E6]">
                            {perSpeciesOdds.toFixed(2)}% per weighted pull
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
