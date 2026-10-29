"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
  packPrice,
  practiceMode = false,
  onRepeat,
  onClose,
}: {
  pulls: PackPull[];
  packImage: string | null;
  packPrice: number;
  practiceMode?: boolean;
  onRepeat?: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<OpeningPhase>("sealed");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [packImageFailed, setPackImageFailed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = prefersReducedMotion ?? false;

  useEffect(() => setPackImageFailed(false), [packImage]);

  useEffect(() => {
    if (phase !== "tearing" && phase !== "flash") return;
    const timer = window.setTimeout(
      () => setPhase(phase === "tearing" ? "flash" : "encounter"),
      reduceMotion ? 1 : phase === "tearing" ? 400 : 500,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reduceMotion]);

  const currentPull = pulls[currentIndex];
  const isLastPull = currentIndex >= pulls.length - 1;
  const canReveal = phase === "flash" || phase === "encounter";
  const packArtwork =
    packImage && !packImageFailed ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={packImage} alt="" onError={() => setPackImageFailed(true)} />
    ) : (
      <span className="pack-copy">
        <strong>Draft League</strong>
        <b>Mystery<br />Pack</b>
      </span>
    );

  function startTear() {
    if (phase === "sealed") setPhase("tearing");
  }

  function showNextPull() {
    if (!isLastPull) setCurrentIndex((index) => index + 1);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#070D24]/95 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-opening-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
    >
      <motion.section
        className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#D9A21B] bg-[#0C1638] p-4 shadow-2xl shadow-[#F5C542]/20 sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        initial={{ y: reduceMotion ? 0 : 20, scale: reduceMotion ? 1 : 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
              {phase === "encounter"
                ? practiceMode
                  ? "Practice encounter"
                  : "Wild encounter"
                : practiceMode
                  ? "Practice tear"
                  : "Pack opening"}
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

        <AnimatePresence mode="wait">
          {(phase === "sealed" || phase === "tearing") && (
            <motion.div
              key="pack"
              className="flex flex-col items-center py-7 sm:py-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
            >
              <div className="pack-stage relative flex h-[330px] w-[270px] items-center justify-center">
                <span
                  aria-hidden="true"
                  className={`pack-inner-glow absolute h-56 w-56 rounded-full ${
                    phase === "tearing" ? "pack-inner-glow-open" : ""
                  }`}
                />
                <motion.button
                  type="button"
                  onClick={startTear}
                  onDragEnd={(_, info) => {
                    if (info.offset.y < -45 || info.velocity.y < -350) startTear();
                  }}
                  drag={phase === "sealed" ? "y" : false}
                  dragConstraints={{ top: -110, bottom: 60 }}
                  dragElastic={0.28}
                  whileTap={phase === "sealed" ? { scale: 0.97 } : undefined}
                  disabled={phase !== "sealed"}
                  aria-label="Click or drag upward to tear open the pack"
                  className="pack-wrapper relative h-[300px] w-[210px] rounded-2xl border-2 border-[#F5C542] bg-[linear-gradient(135deg,#F5C542,#D9A21B_38%,#fff0a8_48%,#D9A21B_58%,#9c6800)] shadow-xl shadow-[#F5C542]/30 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#EEF2FF]"
                  style={{ touchAction: "none", rotate: -3 }}
                  whileHover={phase === "sealed" ? { rotate: 0, scale: 1.035 } : undefined}
                >
                  <span
                    className="pack-art"
                    aria-hidden="true"
                    style={{ visibility: phase === "sealed" ? "visible" : "hidden" }}
                  >
                    {packArtwork}
                    <span className="pack-inner-border" />
                  </span>
                  <motion.span
                    className="pack-art pack-top-half"
                    initial="rest"
                    animate={phase === "tearing" ? "torn" : "rest"}
                    variants={{
                      rest: { x: 0, y: 0, rotate: 0, opacity: 1, skewY: 0 },
                      torn: { x: 8, y: -138, rotate: -12, opacity: 0, skewY: -5 },
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0.01 }
                        : { type: "spring", stiffness: 150, damping: 18, mass: 0.8 }
                    }
                    style={{ visibility: phase === "tearing" ? "visible" : "hidden" }}
                    aria-hidden="true"
                  >
                    {packArtwork}
                    <span className="pack-inner-border" />
                  </motion.span>
                  <motion.span
                    className="pack-art pack-bottom-half"
                    initial="rest"
                    animate={phase === "tearing" ? "torn" : "rest"}
                    variants={{
                      rest: { x: 0, y: 0, rotate: 0, opacity: 1, skewY: 0 },
                      torn: { x: -4, y: 88, rotate: 5, opacity: 0.12, skewY: 3 },
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0.01 }
                        : { type: "spring", stiffness: 130, damping: 19, mass: 0.9 }
                    }
                    style={{ visibility: phase === "tearing" ? "visible" : "hidden" }}
                    aria-hidden="true"
                  >
                    {packArtwork}
                    <span className="pack-inner-border" />
                  </motion.span>
                  <svg
                    aria-hidden="true"
                    className={`pack-tear-line pointer-events-none absolute left-0 top-[48%] z-20 h-8 w-full overflow-visible ${
                      phase === "tearing" ? "pack-tear-line-active" : ""
                    }`}
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
                  {phase === "sealed" && (
                    <span className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#070D24]/90 px-4 py-2 text-xs font-bold text-[#F5C542]">
                      Click or drag up to rip
                    </span>
                  )}
                </motion.button>
              </div>
              <p className="mt-3 text-center text-sm text-[#9FB0E6]">
                {phase === "tearing"
                  ? "The foil is ripping open..."
                  : "Click or drag upward to tear the foil."}
              </p>
            </motion.div>
          )}

          {canReveal && (
            <motion.div
              key="reveal"
              className="mt-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
              aria-live="polite"
            >
              {currentPull ? (
                <>
                  <motion.div
                    key={`battle-${currentIndex}`}
                    className="battle-field relative isolate overflow-hidden rounded-2xl border border-[#243775] bg-[radial-gradient(ellipse_at_50%_42%,#243775_0%,#122050_35%,#070D24_78%)]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                  >
                    <div className="battle-scanlines pointer-events-none absolute inset-0 -z-0" />
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#243775]/80 bg-[#070D24]/75 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5C542] sm:text-sm">
                        A wild {currentPull.species.name} appeared!
                      </p>
                      <span className="rounded-full border border-[#243775] bg-[#0C1638] px-3 py-1 text-xs font-semibold text-[#9FB0E6]">
                        {currentIndex + 1} / {pulls.length}
                      </span>
                    </div>

                    <div className="relative z-10 grid min-h-[330px] items-center gap-2 p-4 sm:grid-cols-[1fr_210px] sm:p-6">
                      <div className="relative flex min-h-[265px] flex-col items-center justify-center">
                        <span
                          aria-hidden="true"
                          className="battle-platform absolute bottom-5 h-12 w-56 rounded-[50%]"
                          style={{
                            background: `radial-gradient(ellipse, ${currentPull.tier.color}55 0%, #070D24 72%)`,
                          }}
                        />
                        <motion.div
                          key={`pokemon-${currentIndex}`}
                          className="encounter-reveal relative z-10 flex flex-col items-center text-center"
                          initial={{ opacity: 0, x: 90, scale: 0 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={
                            reduceMotion
                              ? { duration: 0.01 }
                              : { type: "spring", stiffness: 170, damping: 13, mass: 0.85 }
                          }
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
                        </motion.div>
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
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#243775] pt-3">
                          {practiceMode ? (
                            <>
                              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                                Simulation only
                              </span>
                              <span className="rounded-full border border-[#F5C542]/40 bg-[#F5C542]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F5C542]">
                                Not saved
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                                Copy limits enforced
                              </span>
                              <span className="rounded-full border border-[#F5C542]/40 bg-[#F5C542]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F5C542]">
                                Successful opens are not refunded
                              </span>
                            </>
                          )}
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-[#9FB0E6]">
                          {practiceMode
                            ? "This practice pull does not spend coins or change your collection."
                            : "Copy limits prevent pulls beyond the tournament's player and league caps."}
                        </p>
                      </aside>
                    </div>
                  </motion.div>

                  <div className="mt-5 flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <p className="text-sm text-[#9FB0E6]">
                      {practiceMode ? (
                        <span className="font-bold text-emerald-200">Practice tear · 0 coins</span>
                      ) : (
                        <>
                          Pack cost:{" "}
                          <span className="font-bold text-[#F5C542]">
                            {packPrice.toLocaleString()} coins
                          </span>
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={
                        isLastPull
                          ? practiceMode && onRepeat
                            ? onRepeat
                            : onClose
                          : showNextPull
                      }
                      className="w-full rounded-xl bg-[#F5C542] px-6 py-3 font-bold text-[#070D24] transition-colors hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] sm:w-auto"
                    >
                      {isLastPull
                        ? practiceMode
                          ? "Rip another pack"
                          : "Finish and view collection"
                        : "Next Pokémon"}
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
              {phase === "flash" && (
                <p className="sr-only">Encounter transition in progress...</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <AnimatePresence>
        {phase === "tearing" && (
          <motion.div
            key="pack-flash"
            aria-hidden="true"
            className="pack-flash fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.4 }}
          />
        )}
      </AnimatePresence>
      {phase === "flash" && (
        <div
          key={`shutter-${currentIndex}`}
          aria-hidden="true"
          className="battle-shutter pointer-events-none fixed inset-0 z-[60]"
        />
      )}

      <style jsx>{`
        .pack-wrapper {
          isolation: isolate;
          perspective: 900px;
          transform-style: preserve-3d;
          touch-action: none;
          transition: box-shadow 220ms ease;
        }

        .pack-wrapper:not(:disabled):hover {
          box-shadow: 0 0 42px #f5c54266;
        }

        .pack-inner-glow {
          background: radial-gradient(circle, #ffffff 0%, #fff8df 18%, #f5c542 42%, #f5c54200 74%);
          opacity: 0;
          transform: scale(0.55);
        }

        .pack-inner-glow-open {
          animation: interior-glow 650ms ease-out both;
        }

        .pack-art {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: linear-gradient(135deg, #f5c542, #d9a21b 38%, #fff0a8 48%, #d9a21b 58%, #9c6800);
          will-change: transform, opacity;
        }

        .pack-top-half {
          clip-path: polygon(0 0, 100% 0, 100% 49%, 88% 52%, 78% 48%, 64% 53%, 51% 48%, 39% 53%, 25% 48%, 12% 53%, 0 49%);
          border-radius: 0.8rem 0.8rem 0 0;
        }

        .pack-bottom-half {
          clip-path: polygon(0 49%, 12% 53%, 25% 48%, 39% 53%, 51% 48%, 64% 53%, 78% 48%, 88% 52%, 100% 49%, 100% 100%, 0 100%);
          border-radius: 0 0 0.8rem 0.8rem;
        }

        .pack-art img {
          height: 100%;
          width: 100%;
          object-fit: cover;
        }

        .pack-inner-border {
          position: absolute;
          inset: 0.5rem;
          border: 1px solid rgb(255 240 168 / 80%);
          border-radius: 0.65rem;
        }

        .pack-copy {
          display: flex;
          height: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          color: #eef2ff;
          text-align: center;
          text-shadow: 0 2px 8px #070d24;
        }

        .pack-copy strong {
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }

        .pack-copy b {
          margin-top: 1.25rem;
          font-size: 1.5rem;
          font-weight: 900;
          line-height: 1.15;
        }

        .pack-tear-line {
          filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px #f5c542);
          opacity: 0;
          stroke-dasharray: 380;
          stroke-dashoffset: 380;
        }

        .pack-tear-line-active {
          animation: tear-spark 400ms ease-out forwards;
        }

        .pack-flash {
          pointer-events: none;
          background: radial-gradient(ellipse at center, #ffffff 0%, #fff8df 32%, #f5c542 68%, #d9a21b 100%);
          animation: flash-flood 400ms ease-out forwards;
          will-change: opacity;
        }

        .battle-field {
          animation: shutter-open 500ms steps(10, end) both;
        }

        .battle-shutter {
          background: repeating-linear-gradient(
            to bottom,
            #ffffff 0,
            #ffffff 3px,
            #070d24 3px,
            #070d24 6px
          );
          animation: shutter-scan 500ms steps(10, end) both;
          will-change: transform, opacity;
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
          transform-origin: center bottom;
          will-change: transform, opacity;
        }

        .rarity-aura {
          animation: aura-pulse 2.4s ease-in-out infinite;
        }

        @keyframes interior-glow {
          0% { opacity: 0; transform: scale(0.55); }
          45% { opacity: 0.95; transform: scale(1.35); }
          100% { opacity: 0.68; transform: scale(1.05); }
        }

        @keyframes tear-spark {
          0% { opacity: 0; stroke-dashoffset: 380; }
          18% { opacity: 1; }
          65% { opacity: 1; stroke-dashoffset: 0; }
          100% { opacity: 0; stroke-dashoffset: 0; }
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

        @keyframes shutter-scan {
          0% { opacity: 1; transform: scaleY(1); }
          35% { opacity: 1; transform: scaleY(1); }
          100% { opacity: 0; transform: scaleY(0); }
        }

        @keyframes aura-pulse {
          0%, 100% { opacity: 0.38; transform: translate(-50%, -50%) scale(0.88); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.12); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pack-inner-glow-open,
          .pack-tear-line-active,
          .pack-flash,
          .battle-field,
          .battle-shutter,
          .rarity-aura {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
