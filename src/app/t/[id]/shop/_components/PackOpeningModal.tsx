"use client";

import { useEffect, useRef, useState } from "react";

export type PackPull = {
  species: {
    dex: number;
    name: string;
    isMega: boolean;
    imageUrl: string | null;
  };
  tier: { name: string; color: string };
};

function PullArtwork({ pull }: { pull: PackPull }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source =
    pull.species.imageUrl ??
    (!pull.species.isMega
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pull.species.dex}.png`
      : null);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete) {
      if (image.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, [source]);

  if (!source || failed) {
    return (
      <span className="mb-3 flex h-28 w-28 items-center justify-center rounded-full border border-[#243775] px-2 text-center text-xs text-[#9FB0E6]">
        No image yet
      </span>
    );
  }

  return (
    <span className="relative mb-3 flex h-28 w-28 items-center justify-center">
      {!loaded && (
        <span
          aria-hidden="true"
          className="absolute inset-2 animate-pulse rounded-full bg-[#243775] motion-reduce:animate-none"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={source}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`relative h-full w-full object-contain ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}

export default function PackOpeningModal({
  pulls,
  packImage,
  cardBackImage,
  onClose,
}: {
  pulls: PackPull[];
  packImage: string | null;
  cardBackImage: string | null;
  onClose: () => void;
}) {
  const [torn, setTorn] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [packImageFailed, setPackImageFailed] = useState(false);
  const [cardBackImageFailed, setCardBackImageFailed] = useState(false);

  useEffect(() => setPackImageFailed(false), [packImage]);
  useEffect(() => setCardBackImageFailed(false), [cardBackImage]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!torn) return;
    if (reducedMotion) {
      setRevealed(pulls.map((_, index) => index));
      return;
    }
    if (revealed.length >= pulls.length) return;
    const timer = window.setTimeout(() => {
      setRevealed((current) => {
        const nextIndex = pulls.findIndex((_, index) => !current.includes(index));
        return nextIndex < 0 ? current : [...current, nextIndex];
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [pulls, reducedMotion, revealed, torn]);

  function revealOne(index: number) {
    setRevealed((current) =>
      current.includes(index) ? current : [...current, index],
    );
  }

  const allRevealed = revealed.length === pulls.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#070D24]/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-opening-title"
    >
      <section className="my-auto w-full max-w-4xl rounded-3xl border border-[#D9A21B] bg-[#0C1638] p-5 shadow-2xl shadow-[#F5C542]/20 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
              Pack opened
            </p>
            <h2 id="pack-opening-title" className="mt-2 text-2xl font-bold">
              {allRevealed ? "Your pulls" : "A surprise awaits"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#9FB0E6] hover:text-[#EEF2FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
            aria-label="Close pack results"
          >
            Close
          </button>
        </div>

        {!torn ? (
          <div className="flex flex-col items-center py-10">
            <button
              type="button"
              onClick={() => setTorn(true)}
              className={`group relative flex h-64 w-48 -rotate-3 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-[#F5C542] bg-[linear-gradient(135deg,#F5C542,#D9A21B_38%,#fff0a8_48%,#D9A21B_58%,#9c6800)] p-5 text-center shadow-xl shadow-[#F5C542]/30 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#EEF2FF] motion-reduce:transition-none ${
                packImage && !packImageFailed ? "text-[#EEF2FF]" : "text-[#070D24]"
              }`}
            >
              {packImage && !packImageFailed && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={packImage}
                    alt=""
                    onError={() => setPackImageFailed(true)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span aria-hidden="true" className="absolute inset-0 bg-[#070D24]/55" />
                </>
              )}
              <span className="absolute inset-2 rounded-xl border border-[#fff0a8]/80" />
              <span className="relative text-xs font-black uppercase tracking-[0.28em]">
                Draft League
              </span>
              <span className="relative mt-5 text-2xl font-black">Mystery<br />Pack</span>
              <span className="relative mt-5 rounded-full bg-[#070D24] px-4 py-2 text-xs font-bold text-[#F5C542]">
                Tap to tear open
              </span>
            </button>
            <p className="mt-6 text-center text-sm text-[#9FB0E6]">
              Click or tap the pack to reveal your Pokémon.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pulls.map((pull, index) => {
                const isRevealed = revealed.includes(index);
                return (
                  <button
                    type="button"
                    key={`${pull.species.dex}-${index}`}
                    onClick={() => revealOne(index)}
                    aria-label={
                      isRevealed
                        ? `${pull.species.name}, ${pull.tier.name} tier`
                        : `Reveal card ${index + 1}`
                    }
                    className="relative min-h-64 overflow-hidden rounded-2xl border bg-[#070D24] p-4 text-left transition duration-700 motion-reduce:transition-none"
                    style={{
                      borderColor: isRevealed ? pull.tier.color : "#243775",
                      boxShadow: isRevealed
                        ? `0 0 28px ${pull.tier.color}55`
                        : undefined,
                      transform: isRevealed ? "rotateY(0deg)" : "rotateY(180deg)",
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[#070D24] p-4 text-center"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(0deg)",
                      }}
                    >
                      <PullArtwork pull={pull} />
                      <span className="text-lg font-bold">{pull.species.name}</span>
                      <span className="mt-1 text-xs text-[#9FB0E6]">
                        #{pull.species.dex}
                        {pull.species.isMega ? " · Mega" : ""}
                      </span>
                      <span
                        className="mt-3 rounded-full border px-3 py-1 text-sm font-semibold"
                        style={{ color: pull.tier.color, borderColor: pull.tier.color }}
                      >
                        {pull.tier.name}
                      </span>
                    </div>
                    <div
                      className="absolute inset-0 flex min-h-56 flex-col items-center justify-center rounded-xl border border-[#243775] bg-[radial-gradient(circle_at_center,#122050,#070D24_72%)] text-center"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      {cardBackImage && !cardBackImageFailed && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cardBackImage}
                            alt=""
                            onError={() => setCardBackImageFailed(true)}
                            className="absolute inset-0 h-full w-full rounded-xl object-cover"
                          />
                          <span aria-hidden="true" className="absolute inset-0 rounded-xl bg-[#070D24]/35" />
                        </>
                      )}
                      <span className="relative z-10 text-5xl font-black text-[#F5C542]">?</span>
                      <span className="relative z-10 mt-3 text-sm font-semibold text-[#9FB0E6]">
                        Card {index + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {!allRevealed && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextIndex = pulls.findIndex((_, index) => !revealed.includes(index));
                    if (nextIndex >= 0) revealOne(nextIndex);
                  }}
                  className="rounded-xl border border-[#243775] px-5 py-3 font-semibold text-[#EEF2FF] hover:border-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
                >
                  Reveal next card
                </button>
                <button
                  type="button"
                  onClick={() => setRevealed(pulls.map((_, index) => index))}
                  className="rounded-xl bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
                >
                  Reveal all
                </button>
              </div>
            )}
            {allRevealed && (
              <p className="mt-6 text-center font-semibold text-[#F5C542]">
                All {pulls.length} {pulls.length === 1 ? "pull is" : "pulls are"} yours.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
