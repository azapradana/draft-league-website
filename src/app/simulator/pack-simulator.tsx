"use client";

import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import PackOpeningModal, { type PackPull } from "@/app/t/[id]/shop/_components/PackOpeningModal";
import { RichText } from "@/components/rich-text";

type SimulatorSpecies = PackPull["species"];

type SimulatorTier = {
  name: string;
  color: string;
  weight: number;
  minimumOne: boolean;
  species: SimulatorSpecies[];
};

export type SimulatorPack = {
  id: string;
  tournamentName: string;
  name: string;
  description: string;
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
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F5C542]">
            Practice Tear
          </p>
          <h1 className="display-font mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            The RNG Sandbox
          </h1>
          <p className="mt-4 text-base leading-7 text-[#B9C5E8]">
            Test your luck with tournament packs enabled for practice. The pulls
            are just for fun: no coins spent, no cards added to your collection.
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-[#F5C542]/40 bg-[#F5C542]/10 px-5 py-4 text-sm font-bold text-[#FFE28A]">
          Zero Cost. Pure Dopamine. Test your luck before the real tournament.
        </div>

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7181B3]">
                Currently available
              </p>
              <h2 className="display-font mt-2 text-2xl font-extrabold">
                Practice-ready tournament packs
              </h2>
            </div>
            <span className="rounded-full border border-[#243775] bg-[#0C1638] px-3 py-1.5 text-xs font-bold text-[#9FB0E6]">
              {packs.length} {packs.length === 1 ? "pack" : "packs"}
            </span>
          </div>

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
            <div className="grid gap-5 lg:grid-cols-2">
              {packs.map((pack) => {
                const disabled = simulatePackIsUnavailable(pack);
                return (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    disabled={disabled}
                    onOpen={() => openPack(pack)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

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
}: {
  pack: SimulatorPack;
  disabled: boolean;
  onOpen: () => void;
}) {
  const [packImageFailed, setPackImageFailed] = useState(false);

  return (
    <article className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
      {pack.packImage && !packImageFailed && (
        <div className="mx-auto mb-5 aspect-[2/3] w-full max-w-[280px] overflow-hidden rounded-xl border border-[#243775] bg-[#070D24]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pack.packImage}
            alt={`${pack.name} artwork`}
            onError={() => setPackImageFailed(true)}
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9FB0E6]">
            {pack.tournamentName}
          </p>
          <h3 className="mt-1 text-xl font-bold">{pack.name}</h3>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            {pack.pullCount} pull{pack.pullCount === 1 ? "" : "s"} per pack
          </p>
        </div>
        <p className="rounded-lg bg-[#070D24] px-3 py-2 font-bold text-[#F5C542]">
          Always free
        </p>
      </div>

      {pack.description && (
        <div className="mt-4">
          <RichText value={pack.description} />
        </div>
      )}

      <section className="mt-5">
        <h4 className="text-sm font-semibold text-[#EEF2FF]">Pull tiers</h4>
        <p className="mt-1 text-xs text-[#9FB0E6]">
          Guaranteed tiers are selected first; remaining pulls use tier weights.
        </p>
        {pack.tiers.filter((tier) => tier.species.length > 0).length === 0 ? (
          <p className="mt-3 text-sm text-[#9FB0E6]">
            No Pokémon have been added to this pack yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {pack.tiers
              .filter((tier) => tier.species.length > 0)
              .map((tier) => (
                <li
                  key={tier.name}
                  className="rounded-full border px-3 py-1 text-sm"
                  style={{ borderColor: tier.color, color: tier.color }}
                >
                  {tier.name}
                  {tier.minimumOne ? " · guaranteed" : ""}
                </li>
              ))}
          </ul>
        )}
      </section>

      <details className="mt-5 rounded-xl border border-[#243775] bg-[#070D24] p-4">
        <summary className="cursor-pointer font-semibold text-[#EEF2FF]">
          What can drop?
        </summary>
        <div className="mt-4 space-y-3">
          {pack.tiers
            .filter((tier) => tier.species.length > 0)
            .map((tier) => (
              <div key={tier.name}>
                <h5 className="text-sm font-semibold" style={{ color: tier.color }}>
                  {tier.name}
                  {tier.minimumOne ? " · guaranteed" : ""}
                </h5>
                <p className="mt-1 text-sm text-[#9FB0E6]">
                  {tier.species.map((species) => species.name).join(", ")}
                </p>
              </div>
            ))}
        </div>
      </details>

      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="mt-5 w-full rounded-xl bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Practice tear
      </button>
      {disabled && (
        <p className="mt-2 text-sm text-amber-200" role="status">
          This pack has no valid pulls configured.
        </p>
      )}
    </article>
  );
}
