"use client";

import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import PackOpeningModal, { type PackPull } from "@/app/t/[id]/shop/_components/PackOpeningModal";

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
            <div className="rounded-2xl border border-dashed border-[#243775] bg-[#0C1638]/60 p-8 text-center">
              <p className="text-lg font-bold">No practice packs right now</p>
              <p className="mt-2 text-sm text-[#9FB0E6]">
                Tournament packs enabled for practice will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {packs.map((pack) => {
                const disabled = simulatePackIsUnavailable(pack);
                return (
                  <article
                    className="overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638]"
                    key={pack.id}
                  >
                    <div className="flex gap-4 p-5">
                      <PackArtwork pack={pack} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9FB0E6]">
                          {pack.tournamentName}
                        </p>
                        <h3 className="mt-1 text-xl font-black">{pack.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#9FB0E6]">
                          {pack.description || "A mystery pack awaits."}
                        </p>
                        <p className="mt-3 text-xs font-bold text-[#F5C542]">
                          {pack.pullCount} {pack.pullCount === 1 ? "pull" : "pulls"} · Always free
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-[#243775] px-5 py-3">
                      {pack.tiers.map((tier) => (
                        <span
                          className="rounded-full border px-2.5 py-1 text-xs font-bold"
                          key={tier.name}
                          style={{ color: tier.color, borderColor: `${tier.color}88` }}
                        >
                          {tier.name}
                          {tier.minimumOne ? " · guaranteed" : ""}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#243775] p-5">
                      <p className="text-xs text-[#9FB0E6]">
                        {disabled
                          ? "This pack has no valid pulls configured."
                          : "Nothing saved. Rip it as often as you like."}
                      </p>
                      <button
                        className="shrink-0 rounded-xl bg-[#F5C542] px-5 py-3 text-sm font-extrabold text-[#070D24] transition hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => openPack(pack)}
                        type="button"
                      >
                        Practice tear
                      </button>
                    </div>
                  </article>
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

function PackArtwork({ pack }: { pack: SimulatorPack }) {
  if (!pack.packImage) {
    return (
      <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl border border-[#F5C542]/50 bg-gradient-to-br from-[#F5C542] via-[#D9A21B] to-[#9c6800] p-2 text-center text-xs font-black text-[#070D24]">
        RNG
        <br />
        SANDBOX
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="h-24 w-20 shrink-0 rounded-xl border border-[#243775] object-cover"
      src={pack.packImage}
    />
  );
}
