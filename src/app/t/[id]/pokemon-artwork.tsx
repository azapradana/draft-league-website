"use client";

import { useEffect, useRef, useState } from "react";

export type PokemonArtworkSpecies = {
  dex: number;
  name: string;
  isMega: boolean;
  imageUrl: string | null;
};

export default function PokemonArtwork({
  species,
  className = "h-24 w-24",
}: {
  species: PokemonArtworkSpecies;
  className?: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source =
    species.imageUrl ??
    (!species.isMega
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.dex}.png`
      : null);

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
        className={`flex shrink-0 items-center justify-center rounded-full border border-[#243775] px-2 text-center text-xs text-[#9FB0E6] ${className}`}
      >
        No image yet
      </span>
    );
  }

  return (
    <span className={`relative flex shrink-0 items-center justify-center ${className}`}>
      {!loaded && (
        <span
          aria-hidden="true"
          className="absolute inset-2 overflow-hidden rounded-full bg-[#243775]"
        >
          <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#9FB0E6]/30 to-transparent motion-reduce:animate-none" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={source}
        alt={species.name}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`relative h-full w-full object-contain transition-opacity ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
