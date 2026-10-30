"use client";

import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import PackOpeningModal, { type PackPull } from "@/app/t/[id]/shop/_components/PackOpeningModal";
import PackInfoModal, { type PackInfoTier } from "@/components/PackInfoModal";

/* eslint-disable @next/next/no-img-element */

type SimulatorSpecies = PackPull["species"];

type SimulatorTier = PackInfoTier & { species: SimulatorSpecies[] };

export type SimulatorPack = {
  id: string;
  tournamentName: string;
  name: string;
  packImage: string | null;
  pullCount: number;
  tiers: SimulatorTier[];
};

function chooseUniformly<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function chooseWeighted<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  let choice = Math.random() * totalWeight;

  for (const item of items) {
    choice -= item.weight;
    if (choice < 0) return item;
  }

  return items[items.length - 1];
}

function simulatePack(pack: SimulatorPack): PackPull[] | null {
  const guaranteedTiers = pack.tiers.filter((tier) => tier.minimumOne);
  if (
    pack.pullCount < 1 ||
    guaranteedTiers.length > pack.pullCount ||
    guaranteedTiers.some((tier) => tier.species.length === 0)
  ) {
    return null;
  }

  const pulls: PackPull[] = guaranteedTiers.map((tier) => ({
    species: chooseUniformly(tier.species),
    tier: { name: tier.name, color: tier.color },
  }));

  while (pulls.length < pack.pullCount) {
    const weightedTiers = pack.tiers
      .filter((tier) => tier.species.length > 0 && tier.weight > 0)
      .map((tier) => ({ tier, weight: Math.round(tier.weight * 10_000) }))
      .filter(({ weight }) => weight > 0);
    if (weightedTiers.length === 0) return null;

    const { tier } = chooseWeighted(weightedTiers);
    pulls.push({
      species: chooseUniformly(tier.species),
      tier: { name: tier.name, color: tier.color },
    });
  }

  return pulls;
}

export default function PackSimulator({ packs }: { packs: SimulatorPack[] }) {
  const openingSequence = useRef(0);
  const [opening, setOpening] = useState<{
    pack: SimulatorPack;
    pulls: PackPull[];
    sequence: number;
  } | null>(null);
  const [infoPack, setInfoPack] = useState<SimulatorPack | null>(null);

  function openPack(pack: SimulatorPack) {
    const pulls = simulatePack(pack);
    if (pulls) {
      openingSequence.current += 1;
      setOpening({ pack, pulls, sequence: openingSequence.current });
    }
  }

  return (
    <main className="min-h-screen bg-[#070D24] px-5 py-10 text-[#EEF2FF] sm:px-8 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-3xl">
          <h1 className="display-font text-3xl font-black tracking-tight sm:text-4xl">
            The Pull Lab
          </h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            Practice packs · no coins spent
          </p>
        </header>

        <section className="mt-7">
          {packs.length === 0 ? (
            <div className="flex items-start gap-4 rounded-2xl border border-dashed border-[#243775] p-6 text-[#9FB0E6]">
              <svg
                aria-hidden="true"
                className="mt-0.5 h-6 w-6 shrink-0 text-[#F5C542]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 9.5 4.5 4h15L21 9.5M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6"
                />
              </svg>
              <p>No practice packs are currently available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {packs.map((pack) => {
                const disabled = simulatePackIsUnavailable(pack);
                return (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    disabled={disabled}
                    onOpen={() => openPack(pack)}
                    onInfo={() => setInfoPack(pack)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {infoPack && (
        <PackInfoModal
          packName={infoPack.name}
          tiers={infoPack.tiers}
          onClose={() => setInfoPack(null)}
        />
      )}

      <AnimatePresence>
        {opening && (
          <PackOpeningModal
            key={`${opening.pack.id}:${opening.sequence}`}
            pulls={opening.pulls}
            packImage={opening.pack.packImage}
            packPrice={0}
            practiceMode
            onRepeat={() => openPack(opening.pack)}
            onClose={() => setOpening(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function simulatePackIsUnavailable(pack: SimulatorPack): boolean {
  const guaranteedTiers = pack.tiers.filter((tier) => tier.minimumOne);
  return (
    pack.pullCount < 1 ||
    guaranteedTiers.length > pack.pullCount ||
    guaranteedTiers.some((tier) => tier.species.length === 0) ||
    (pack.pullCount > guaranteedTiers.length &&
      !pack.tiers.some(
        (tier) =>
          tier.species.length > 0 &&
          Math.round(tier.weight * 10_000) > 0,
      ))
  );
}

function PackCard({
  pack,
  disabled,
  onOpen,
  onInfo,
}: {
  pack: SimulatorPack;
  disabled: boolean;
  onOpen: () => void;
  onInfo: () => void;
}) {
  const [packImageFailed, setPackImageFailed] = useState(false);

  return (
    <article className="flex min-w-0 flex-col">
      <div className="mb-3 aspect-[4/5] sm:mb-4">
        {pack.packImage && !packImageFailed ? (
          <img
            src={pack.packImage}
            alt={`${pack.name} artwork`}
            onError={() => setPackImageFailed(true)}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#7181B3]">
            Artwork unavailable
          </div>
        )}
      </div>

      <div className="mb-3 flex min-h-14 flex-col items-center gap-1 text-center sm:mb-4">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#9FB0E6] sm:text-xs">
            {pack.tournamentName}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[#EEF2FF] sm:text-base">
            {pack.name}
          </h3>
        </div>
        <p className="shrink-0 text-xs font-semibold text-[#F5C542]">
          Free
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="mx-auto min-h-11 w-fit rounded-xl bg-[#F5C542] px-6 py-2.5 text-sm font-bold text-[#070D24] transition-colors hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Open Pack
      </button>
      <button
        type="button"
        onClick={onInfo}
        className="mx-auto mt-1 min-h-11 w-fit px-2 text-xs font-medium text-[#9FB0E6] underline decoration-[#52618C] underline-offset-4 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542] sm:text-sm"
      >
        Pack Information
      </button>
      {disabled && (
        <p className="mt-2 text-center text-xs text-amber-200" role="status">
          This pack has no valid pulls configured.
        </p>
      )}
    </article>
  );
}
