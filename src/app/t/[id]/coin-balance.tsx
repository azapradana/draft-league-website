"use client";

import { createContext, useContext, useState } from "react";

const CoinBalanceContext = createContext<{
  balance: number | null;
  setBalance: (balance: number) => void;
} | null>(null);

export function CoinBalanceProvider({
  initialBalance,
  children,
}: {
  initialBalance: number | null;
  children: React.ReactNode;
}) {
  const [balance, setBalance] = useState(initialBalance);
  return (
    <CoinBalanceContext.Provider value={{ balance, setBalance }}>
      {children}
    </CoinBalanceContext.Provider>
  );
}

export function useCoinBalance() {
  const context = useContext(CoinBalanceContext);
  if (!context) {
    throw new Error("Coin balance must be used within a CoinBalanceProvider.");
  }
  return context;
}

export function CoinBalanceDisplay() {
  const { balance } = useCoinBalance();
  return (
    <p
      aria-live="polite"
      className="text-sm font-bold text-[#F5C542] sm:text-base"
    >
      {balance === null ? "Coins: —" : `${balance.toLocaleString()} coins`}
    </p>
  );
}
