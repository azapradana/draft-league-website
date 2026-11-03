"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Slide = { id: string; imageUrl: string; linkUrl: string | null };

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export function ShowcaseSlider({ slides, accentColor }: { slides: Slide[]; accentColor: string }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  const current = Math.min(index, count - 1);
  const autoplay = count > 1 && !hovered && !focused && !reducedMotion;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % count), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, count, current]);

  if (count === 0) return null;

  const arrowClass =
    "absolute top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#070D24]/80 text-white transition hover:border-white/40 hover:bg-[#070D24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EEF2FF]";

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Member showcase"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === "ArrowLeft") go(current - 1);
        if (event.key === "ArrowRight") go(current + 1);
      }}
    >
      <div
        className="relative aspect-[6/1] overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638]"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || count < 2) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(touch.clientY - start.y)) {
            go(current + (dx < 0 ? 1 : -1));
          }
        }}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex h-full motion-safe:transition-transform motion-safe:duration-500"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide, i) => {
            const active = i === current;
            // eslint-disable-next-line @next/next/no-img-element
            const image = (
              <img
                src={slide.imageUrl}
                alt={`Member showcase slide ${i + 1} of ${count}`}
                className="h-full w-full object-cover"
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
              />
            );
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={!active}
                className="h-full w-full shrink-0 bg-[#122050]"
              >
                {slide.linkUrl ? (
                  <a
                    href={slide.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={active ? 0 : -1}
                    className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#EEF2FF]"
                  >
                    {image}
                  </a>
                ) : (
                  image
                )}
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button type="button" aria-label="Previous slide" onClick={() => go(current - 1)} className={`${arrowClass} left-3`}>
              <Chevron direction="left" />
            </button>
            <button type="button" aria-label="Next slide" onClick={() => go(current + 1)} className={`${arrowClass} right-3`}>
              <Chevron direction="right" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${i + 1} of ${count}`}
              aria-current={i === current}
              onClick={() => go(i)}
              className="h-2.5 w-2.5 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EEF2FF]"
              style={{ backgroundColor: i === current ? accentColor : "#9FB0E6", opacity: i === current ? 1 : 0.5 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
