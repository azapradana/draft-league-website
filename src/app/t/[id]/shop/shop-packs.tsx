"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import type { PackPull } from "./_components/PackOpeningModal";
import { useCoinBalance } from "../coin-balance";
import { usePersonalWallet } from "@/components/wallet/personal-wallet";
import type { PackInfoTier } from "@/components/PackInfoModal";
import { isOptimizableImageUrl } from "@/lib/image-optimization";

const PackInfoModal = dynamic(() => import("@/components/PackInfoModal"));
const PackOpeningLayer = dynamic(
  () => import("./_components/PackOpeningLayer"),
  {
    loading: () => (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#070D24]/95 text-sm font-semibold text-[#F5C542]"
        role="status"
      >
        Preparing pack opening…
      </div>
    ),
  },
);

type ShopTier = PackInfoTier;

export type ShopPack = {
  id: string;
  name: string;
  packImage: string | null;
  price: number;
  tiers: ShopTier[];
};

function isPackPull(value: unknown): value is PackPull {
  if (typeof value !== "object" || value === null || !("species" in value) || !("tier" in value)) {
    return false;
  }

  const { species, tier } = value;
  return (
    typeof species === "object" &&
    species !== null &&
    "dex" in species &&
    typeof species.dex === "number" &&
    "name" in species &&
    typeof species.name === "string" &&
    "isMega" in species &&
    typeof species.isMega === "boolean" &&
    "imageUrl" in species &&
    (typeof species.imageUrl === "string" || species.imageUrl === null) &&
    typeof tier === "object" &&
    tier !== null &&
    "name" in tier &&
    typeof tier.name === "string" &&
    "color" in tier &&
    typeof tier.color === "string"
  );
}

function isPackOpenResult(
  value: unknown,
): value is {
  pulls: PackPull[];
  coins: number;
  tournamentCoins: number;
  walletCoins: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "pulls" in value &&
    Array.isArray(value.pulls) &&
    value.pulls.every(isPackPull) &&
    "coins" in value &&
    typeof value.coins === "number" &&
    "tournamentCoins" in value &&
    typeof value.tournamentCoins === "number" &&
    "walletCoins" in value &&
    typeof value.walletCoins === "number"
  );
}

export default function ShopPacks({
  tournamentId,
  packs,
  tournamentActive,
  approved,
  initialTournamentCoins,
}: {
  tournamentId: string;
  packs: ShopPack[];
  tournamentActive: boolean;
  approved: boolean;
  initialTournamentCoins: number | null;
}) {
  const { balance, setBalance } = useCoinBalance();
  const { balance: walletCoins, setBalance: setWalletBalance } = usePersonalWallet();
  const [openingPack, setOpeningPack] = useState<string | null>(null);
  const [pulls, setPulls] = useState<PackPull[] | null>(null);
  const [openingResultPack, setOpeningResultPack] = useState<ShopPack | null>(null);
  const [openingSequence, setOpeningSequence] = useState(0);
  const [hasOpenedPack, setHasOpenedPack] = useState(false);
  const [infoPack, setInfoPack] = useState<ShopPack | null>(null);
  const [error, setError] = useState("");
  const tournamentCoins = balance ?? initialTournamentCoins;
  const coins =
    tournamentCoins === null ? null : tournamentCoins + walletCoins;
  const canBuy = tournamentActive && approved;

  async function buyAndOpen(pack: ShopPack) {
    setError("");
    setOpeningPack(pack.id);
    try {
      const response = await fetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}/open`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ packId: pack.id }),
        },
      );
      const responseText = await response.text();
      let result: unknown;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          "The server returned an invalid response while opening this pack. Please try again.",
        );
      }

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "The pack could not be opened. Please try again.";
        throw new Error(message);
      }
      if (!isPackOpenResult(result)) {
        throw new Error(
          "The server returned an invalid response while opening this pack. Please try again.",
        );
      }
      setBalance(result.tournamentCoins);
      setWalletBalance(result.walletCoins);
      setHasOpenedPack(true);
      setOpeningSequence((sequence) => sequence + 1);
      setOpeningResultPack(pack);
      setPulls(result.pulls);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "The pack could not be opened. Please try again.",
      );
    } finally {
      setOpeningPack(null);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Tournament shop
        </p>
        <h2 className="mt-2 text-3xl font-bold">Choose a pack</h2>
        <p className="mt-3 max-w-2xl text-[#9FB0E6]">
          Your balance:{" "}
          <span className="font-bold text-[#F5C542]">
            {coins === null
              ? "Not in this tournament"
              : `${coins.toLocaleString()} coins · ${tournamentCoins?.toLocaleString()} tournament + ${walletCoins.toLocaleString()} personal wallet`}
          </span>
        </p>
      </section>

      {!tournamentActive && (
        <p className="rounded-xl border border-[#243775] bg-[#0C1638] p-4 text-[#9FB0E6]">
          This tournament is inactive, so the shop is closed.
        </p>
      )}
      {tournamentActive && !approved && (
        <p className="rounded-xl border border-[#243775] bg-[#0C1638] p-4 text-[#9FB0E6]">
          An admin must approve your place in this tournament before you can buy packs.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/60 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      )}

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
          <p>No packs currently available in the store.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {packs.map((pack, index) => (
            <PackCard
              key={pack.id}
              pack={pack}
              preload={index === 0}
              disabled={!canBuy || coins === null || coins < pack.price || openingPack !== null}
              coinsShortfall={
                canBuy && coins !== null && coins < pack.price
                  ? pack.price - coins
                  : null
              }
              opening={openingPack === pack.id}
              onBuy={() => void buyAndOpen(pack)}
              onInfo={() => setInfoPack(pack)}
            />
          ))}
        </div>
      )}

      {infoPack && (
        <PackInfoModal
          packName={infoPack.name}
          tiers={infoPack.tiers}
          onClose={() => setInfoPack(null)}
        />
      )}

      {hasOpenedPack && (
        <PackOpeningLayer
          sequenceKey={`${openingResultPack?.id ?? "opened-pack"}:${openingSequence}`}
          pulls={pulls}
          packImage={openingResultPack?.packImage ?? null}
          packPrice={openingResultPack?.price ?? 0}
          onClose={() => {
            setPulls(null);
            setOpeningResultPack(null);
          }}
        />
      )}
    </div>
  );
}

function PackCard({
  pack,
  preload,
  disabled,
  coinsShortfall,
  opening,
  onBuy,
  onInfo,
}: {
  pack: ShopPack;
  preload: boolean;
  disabled: boolean;
  coinsShortfall: number | null;
  opening: boolean;
  onBuy: () => void;
  onInfo: () => void;
}) {
  const [packImageFailed, setPackImageFailed] = useState(false);

  return (
    <article className="flex min-w-0 flex-col">
      <div className="relative mb-3 aspect-[4/5] sm:mb-4">
        {pack.packImage && !packImageFailed ? (
          <Image
            src={pack.packImage}
            alt={`${pack.name} artwork`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            preload={preload}
            unoptimized={!isOptimizableImageUrl(pack.packImage)}
            onError={() => setPackImageFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#7181B3]">
            Artwork unavailable
          </div>
        )}
      </div>

      <div className="mb-3 flex min-h-14 flex-col items-center gap-1 text-center sm:mb-4">
        <h3 className="line-clamp-2 min-w-0 text-sm font-bold leading-5 text-[#EEF2FF] sm:text-base">
          {pack.name}
        </h3>
        <p className="shrink-0 text-xs font-semibold text-[#F5C542] sm:text-sm">
          {pack.price.toLocaleString()} coins
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onBuy}
        className="mx-auto min-h-11 w-fit rounded-xl bg-[#F5C542] px-6 py-2.5 text-sm font-bold text-[#070D24] transition-colors hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {opening ? "Opening…" : "Open Pack"}
      </button>
      {coinsShortfall !== null && (
        <p className="mt-2 text-center text-xs text-amber-200" role="status">
          Need {coinsShortfall.toLocaleString()} more coins
        </p>
      )}
      <button
        type="button"
        onClick={onInfo}
        className="mx-auto mt-1 min-h-11 w-fit px-2 text-xs font-medium text-[#9FB0E6] underline decoration-[#52618C] underline-offset-4 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542] sm:text-sm"
      >
        Pack Information
      </button>
    </article>
  );
}
