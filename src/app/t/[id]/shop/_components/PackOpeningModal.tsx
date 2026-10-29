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

type OpeningPhase = "sealed" | "tearing" | "flash" | "encounter";

function PullArtwork({
  pull,
  large = false,
}: {
  pull: PackPull;
  large?: boolean;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source =
    pull.species.imageUrl ??
    (!pull.species.isMega
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pull.species.dex}.png`
      : null);
  const size = large ? "h-52 w-52 sm:h-60 sm:w-60" : "h-28 w-28";

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const image = imageRef.current;
    if (image?.complete) {
      if (image.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, [source]);

  if (!source || failed) {
    return (
      <span
        className={`relative flex ${size} items-center justify-center rounded-full border border-[#243775] px-2 text-center text-xs text-[#9FB0E6]`}
      >
        No image yet
      </span>
    );
  }

  return (
    <span className={`relative flex ${size} items-center justify-center`}>
      {!loaded && (
        <span
          aria-hidden="true"
          className="absolute inset-5 animate-pulse rounded-full bg-[#243775] motion-reduce:animate-none"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={source}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`relative h-full w-full object-contain transition-opacity duration-300 ${
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
  packPrice,
  onClose,
}: {
  pulls: PackPull[];
  packImage: string | null;
  cardBackImage: string | null;
  packPrice: number;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<OpeningPhase>("sealed");
  const [currentIndex, setCurrentIndex] = useState(0);
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
    if (phase !== "tearing" && phase !== "flash") return;
    const duration = reducedMotion ? 60 : phase === "tearing" ? 650 : 500;
    const timer = window.setTimeout(
      () => setPhase(phase === "tearing" ? "flash" : "encounter"),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  const currentPull = pulls[currentIndex];
  const isLastPull = currentIndex >= pulls.length - 1;

  function showNextPull() {
    if (!isLastPull) setCurrentIndex((index) => index + 1);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#070D24]/95 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-opening-title"
    >
      <section className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#D9A21B] bg-[#0C1638] p-4 shadow-2xl shadow-[#F5C542]/20 sm:max-h-[calc(100dvh-3rem)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
              {phase === "encounter" ? "Wild encounter" : "Pack opening"}
            </p>
            <h2 id="pack-opening-title" className="mt-2 text-2xl font-bold">
              {phase === "encounter" ? "A Pokémon appeared!" : "A surprise awaits"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#9FB0E6] transition-colors hover:text-[#EEF2FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
            aria-label="Close pack results"
          >
            Close
          </button>
        </div>

        {(phase === "sealed" || phase === "tearing") && (
          <div className="flex flex-col items-center py-7 sm:py-10">
            <div className="pack-stage relative flex h-[330px] w-[270px] items-center justify-center">
              <button
                type="button"
                onClick={() => setPhase("tearing")}
                disabled={phase !== "sealed"}
                aria-label="Click or tap to tear open the pack"
                className={`pack-wrapper relative h-[300px] w-[210px] rounded-2xl border-2 border-[#F5C542] bg-[linear-gradient(135deg,#F5C542,#D9A21B_38%,#fff0a8_48%,#D9A21B_58%,#9c6800)] shadow-xl shadow-[#F5C542]/30 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#EEF2FF] ${
                  phase === "tearing" ? "pack-wrapper-tearing" : "cursor-pointer"
                }`}
              >
                <span className="pack-art pack-half-left" aria-hidden="true">
                  {packImage && !packImageFailed && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={packImage}
                        alt=""
                        onError={() => setPackImageFailed(true)}
                      />
                      <span className="pack-art-shade" />
                    </>
                  )}
                  <span className="pack-inner-border" />
                </span>
                <span className="pack-art pack-half-right" aria-hidden="true">
                  {packImage && !packImageFailed && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={packImage} alt="" />
                      <span className="pack-art-shade" />
                    </>
                  )}
                  <span className="pack-inner-border" />
                </span>
                <span className="pack-copy pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-5 text-center text-[#EEF2FF]">
                  <span className="text-xs font-black uppercase tracking-[0.28em]">
                    Draft League
                  </span>
                  <span className="mt-5 text-2xl font-black drop-shadow-md">
                    Mystery
                    <br />
                    Pack
                  </span>
                  <span className="mt-5 rounded-full bg-[#070D24] px-4 py-2 text-xs font-bold text-[#F5C542]">
                    Click or tap to rip
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  className="pack-tear-line pointer-events-none absolute left-0 top-[17%] z-20 h-8 w-full overflow-visible"
                  viewBox="0 0 210 32"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 16 15 9 27 19 42 8 55 18 70 7 82 18 98 6 111 19 126 8 140 18 155 7 169 19 183 9 196 17 210 10"
                    fill="none"
                    stroke="#FFF8D6"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-3 text-center text-sm text-[#9FB0E6]">
              {phase === "tearing"
                ? "The foil is ripping open..."
                : "Click or tap the pack to tear the foil."}
            </p>
          </div>
        )}

        {phase === "flash" && (
          <div
            className="flex min-h-[360px] items-center justify-center"
            aria-live="polite"
            aria-label="The pack is opening"
          >
            <span className="text-lg font-black uppercase tracking-[0.2em] text-[#F5C542]">
              Get ready...
            </span>
          </div>
        )}

        {phase === "encounter" && (
          <div className="mt-5">
            {currentPull ? (
              <>
                <div className="battle-field relative isolate overflow-hidden rounded-2xl border border-[#243775] bg-[radial-gradient(ellipse_at_50%_42%,#243775_0%,#122050_35%,#070D24_78%)]">
                  {cardBackImage && !cardBackImageFailed && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cardBackImage}
                        alt=""
                        onError={() => setCardBackImageFailed(true)}
                        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.08]"
                      />
                    </>
                  )}
                  <div className="battle-scanlines pointer-events-none absolute inset-0 -z-0" />
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#243775]/80 bg-[#070D24]/75 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5C542] sm:text-sm">
                      A wild {currentPull.species.name} appeared!
                    </p>
                    <span className="rounded-full border border-[#243775] bg-[#0C1638] px-3 py-1 text-xs font-semibold text-[#9FB0E6]">
                      {currentIndex + 1} / {pulls.length}
                    </span>
                  </div>

                  <div className="relative z-10 grid min-h-[330px] items-center gap-2 p-4 sm:grid-cols-[1fr_190px] sm:p-6">
                    <div className="relative flex min-h-[265px] flex-col items-center justify-center">
                      <span
                        aria-hidden="true"
                        className="battle-platform absolute bottom-5 h-12 w-56 rounded-[50%]"
                        style={{
                          background: `radial-gradient(ellipse, ${currentPull.tier.color}55 0%, #070D24 72%)`,
                        }}
                      />
                      <div
                        key={`${currentPull.species.dex}-${currentIndex}`}
                        className="encounter-reveal relative z-10 flex flex-col items-center text-center"
                      >
                        <span
                          aria-hidden="true"
                          className="rarity-aura absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl sm:h-52 sm:w-52"
                          style={{ backgroundColor: `${currentPull.tier.color}45` }}
                        />
                        <span className="relative z-10 drop-shadow-[0_8px_24px_rgba(7,13,36,0.8)]">
                          <PullArtwork pull={currentPull} large />
                        </span>
                        <span className="relative z-10 -mt-2 text-2xl font-black text-[#EEF2FF] drop-shadow-lg sm:text-3xl">
                          {currentPull.species.name}
                        </span>
                      </div>
                    </div>

                    <aside className="relative z-10 rounded-xl border border-[#243775] bg-[#070D24]/85 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9FB0E6]">
                        Encounter data
                      </p>
                      <p className="mt-2 text-lg font-bold text-[#EEF2FF]">
                        {currentPull.species.name}
                      </p>
                      <p className="mt-1 text-sm text-[#9FB0E6]">
                        Pokédex #{currentPull.species.dex}
                        {currentPull.species.isMega ? " · Mega" : ""}
                      </p>
                      <span
                        className="mt-4 inline-flex rounded-full border px-3 py-1 text-sm font-bold"
                        style={{
                          color: currentPull.tier.color,
                          borderColor: currentPull.tier.color,
                          boxShadow: `0 0 18px ${currentPull.tier.color}44`,
                        }}
                      >
                        {currentPull.tier.name}
                      </span>
                      <p className="mt-4 border-t border-[#243775] pt-3 text-xs leading-relaxed text-[#9FB0E6]">
                        Duplicate protection is applied to every pull. Successful pack
                        openings are not refunded.
                      </p>
                    </aside>
                  </div>
                </div>

                <div className="mt-5 flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <p className="text-sm text-[#9FB0E6]">
                    Pack cost:{" "}
                    <span className="font-bold text-[#F5C542]">
                      {packPrice.toLocaleString()} coins
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={isLastPull ? onClose : showNextPull}
                    className="w-full rounded-xl bg-[#F5C542] px-6 py-3 font-bold text-[#070D24] transition-colors hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] sm:w-auto"
                  >
                    {isLastPull ? "Finish and view collection" : "Next Pokémon"}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <p className="font-semibold text-[#9FB0E6]">
                  No Pokémon pulls were returned.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 rounded-xl bg-[#F5C542] px-6 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
                >
                  Finish
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {phase === "flash" && (
        <div key="opening-flash" aria-hidden="true" className="pack-flash fixed inset-0 z-[60]" />
      )}

      <style jsx>{`
        .pack-wrapper {
          isolation: isolate;
          perspective: 900px;
          transform: rotate(-3deg);
          transition: transform 220ms ease, box-shadow 220ms ease;
        }

        .pack-wrapper:not(:disabled):hover {
          transform: rotate(0) scale(1.035);
          box-shadow: 0 0 42px #f5c54266;
        }

        .pack-wrapper-tearing {
          cursor: default;
        }

        .pack-art {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: linear-gradient(135deg, #f5c542, #d9a21b 38%, #fff0a8 48%, #d9a21b 58%, #9c6800);
        }

        .pack-half-left {
          clip-path: polygon(0 0, 48% 0, 54% 17%, 47% 34%, 53% 51%, 46% 68%, 53% 84%, 47% 100%, 0 100%);
          border-radius: 0.8rem 0 0 0.8rem;
        }

        .pack-half-right {
          clip-path: polygon(48% 0, 100% 0, 100% 100%, 47% 100%, 53% 84%, 46% 68%, 53% 51%, 47% 34%, 54% 17%);
          border-radius: 0 0.8rem 0.8rem 0;
        }

        .pack-art img {
          height: 100%;
          width: 100%;
          object-fit: cover;
        }

        .pack-art-shade {
          position: absolute;
          inset: 0;
          background: rgb(7 13 36 / 55%);
        }

        .pack-inner-border {
          position: absolute;
          inset: 0.5rem;
          border: 1px solid rgb(255 240 168 / 80%);
          border-radius: 0.65rem;
        }

        .pack-copy {
          transition: opacity 160ms ease;
        }

        .pack-wrapper-tearing .pack-copy {
          opacity: 0;
        }

        .pack-wrapper-tearing .pack-half-left {
          animation: foil-left 650ms cubic-bezier(0.55, 0, 0.8, 0.35) forwards;
          will-change: transform, opacity;
        }

        .pack-wrapper-tearing .pack-half-right {
          animation: foil-right 650ms cubic-bezier(0.55, 0, 0.8, 0.35) forwards;
          will-change: transform, opacity;
        }

        .pack-tear-line {
          filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px #f5c542);
          stroke-dasharray: 380;
          stroke-dashoffset: 380;
          transition: stroke-dashoffset 500ms ease;
        }

        .pack-wrapper-tearing .pack-tear-line {
          stroke-dashoffset: 0;
          animation: tear-spark 650ms ease-out forwards;
        }

        .pack-flash {
          pointer-events: none;
          background: radial-gradient(ellipse at center, #ffffff 0%, #fff8df 36%, #f5c542 72%, #d9a21b 100%);
          animation: flash-flood 500ms ease-out forwards;
          will-change: opacity;
        }

        .battle-field {
          animation: shutter-open 560ms steps(8, end) both;
        }

        .battle-scanlines {
          opacity: 0.18;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 3px,
            rgb(0 0 0 / 65%) 4px,
            rgb(0 0 0 / 65%) 5px
          );
        }

        .battle-platform {
          box-shadow: 0 0 24px #f5c54222;
        }

        .encounter-reveal {
          animation: encounter-enter 800ms cubic-bezier(0.2, 0.85, 0.25, 1.15) both;
          will-change: transform, opacity;
        }

        .rarity-aura {
          animation: aura-pulse 2.4s ease-in-out infinite;
        }

        @keyframes foil-left {
          0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0); }
          35% { transform: translate3d(-12px, -10px, 0) rotate(-5deg); }
          100% { opacity: 0; transform: translate3d(-180px, 100px, 0) rotate(-28deg); }
        }

        @keyframes foil-right {
          0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0); }
          35% { transform: translate3d(12px, -12px, 0) rotate(5deg); }
          100% { opacity: 0; transform: translate3d(180px, 100px, 0) rotate(28deg); }
        }

        @keyframes tear-spark {
          0% { opacity: 0; }
          18% { opacity: 1; }
          65% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes flash-flood {
          0% { opacity: 0; }
          16% { opacity: 1; }
          38% { opacity: 0.88; }
          100% { opacity: 0; }
        }

        @keyframes shutter-open {
          0% { clip-path: inset(50% 0); opacity: 0.3; }
          100% { clip-path: inset(0); opacity: 1; }
        }

        @keyframes encounter-enter {
          0% { opacity: 0; transform: translate3d(130px, 0, 0) scale(0.42); }
          68% { opacity: 1; transform: translate3d(-12px, 0, 0) scale(1.08); }
          86% { transform: translate3d(4px, 0, 0) scale(0.98); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes aura-pulse {
          0%, 100% { opacity: 0.38; transform: translate(-50%, -50%) scale(0.88); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.12); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pack-wrapper,
          .pack-copy,
          .pack-tear-line {
            transition-duration: 0.01ms !important;
          }

          .pack-wrapper-tearing .pack-half-left,
          .pack-wrapper-tearing .pack-half-right,
          .pack-wrapper-tearing .pack-tear-line,
          .pack-flash,
          .battle-field,
          .encounter-reveal,
          .rarity-aura {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
