"use client";

import { useMemo, useState } from "react";
import PackOpeningModal, { type PackPull } from "./_components/PackOpeningModal";
import { useCoinBalance } from "../coin-balance";

type ShopTier = {
  name: string;
  color: string;
  weight: number;
  species: Array<{ dex: number; name: string }>;
};

export type ShopPack = {
  id: string;
  name: string;
  price: number;
  pullCount: number;
  purchaseLimit: number | null;
  tiers: ShopTier[];
};

export default function ShopPacks({
  tournamentId,
  packs,
  tournamentActive,
  approved,
  initialCoins,
}: {
  tournamentId: string;
  packs: ShopPack[];
  tournamentActive: boolean;
  approved: boolean;
  initialCoins: number | null;
}) {
  const { balance, setBalance } = useCoinBalance();
  const [openingPack, setOpeningPack] = useState<string | null>(null);
  const [pulls, setPulls] = useState<PackPull[] | null>(null);
  const [error, setError] = useState("");
  const coins = balance ?? initialCoins;
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
      const result = (await response.json()) as
        | { pulls: PackPull[]; coins: number }
        | { error: string };
      if (!response.ok || !("pulls" in result)) {
        throw new Error("error" in result ? result.error : "The pack could not be opened.");
      }
      setBalance(result.coins);
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
            {coins === null ? "Not in this tournament" : `${coins.toLocaleString()} coins`}
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
        <p className="rounded-2xl border border-dashed border-[#243775] p-6 text-[#9FB0E6]">
          There are no packs on sale right now.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              disabled={!canBuy || coins === null || coins < pack.price || openingPack !== null}
              opening={openingPack === pack.id}
              onBuy={() => void buyAndOpen(pack)}
            />
          ))}
        </div>
      )}

      {pulls && (
        <PackOpeningModal
          pulls={pulls}
          onClose={() => setPulls(null)}
        />
      )}
    </div>
  );
}

function PackCard({
  pack,
  disabled,
  opening,
  onBuy,
}: {
  pack: ShopPack;
  disabled: boolean;
  opening: boolean;
  onBuy: () => void;
}) {
  const totalWeight = useMemo(
    () =>
      pack.tiers.reduce(
        (total, tier) => total + (tier.species.length > 0 ? tier.weight : 0),
        0,
      ),
    [pack.tiers],
  );

  return (
    <article className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{pack.name}</h3>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            {pack.pullCount} pull{pack.pullCount === 1 ? "" : "s"} per pack
            {" · "}
            {pack.purchaseLimit === null
              ? "No purchase limit"
              : `Limit ${pack.purchaseLimit} per player`}
          </p>
        </div>
        <p className="rounded-lg bg-[#070D24] px-3 py-2 font-bold text-[#F5C542]">
          {pack.price.toLocaleString()} coins
        </p>
      </div>

      <section className="mt-5">
        <h4 className="text-sm font-semibold text-[#EEF2FF]">Tier odds</h4>
        <p className="mt-1 text-xs text-[#9FB0E6]">
          Odds use the weight of non-empty tiers and ignore copy caps.
        </p>
        {pack.tiers.filter((tier) => tier.species.length > 0).length === 0 ? (
          <p className="mt-3 text-sm text-[#9FB0E6]">No Pokémon have been added to this pack yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {pack.tiers
              .filter((tier) => tier.species.length > 0)
              .map((tier) => {
                const odds = totalWeight > 0 ? (tier.weight / totalWeight) * 100 : 0;
                return (
                  <li
                    key={tier.name}
                    className="rounded-full border px-3 py-1 text-sm"
                    style={{ borderColor: tier.color, color: tier.color }}
                  >
                    {tier.name}: {odds.toFixed(2)}%
                  </li>
                );
              })}
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
        onClick={onBuy}
        className="mt-5 w-full rounded-xl bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {opening ? "Opening pack…" : "Buy & open"}
      </button>
    </article>
  );
}
