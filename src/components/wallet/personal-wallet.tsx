"use client";

import { createContext, useContext, useState } from "react";

const PersonalWalletContext = createContext<{
  balance: number;
  setBalance: (balance: number) => void;
} | null>(null);

export function PersonalWalletProvider({
  initialBalance,
  children,
}: {
  initialBalance: number;
  children: React.ReactNode;
}) {
  const [balance, setBalance] = useState(initialBalance);

  return (
    <PersonalWalletContext.Provider value={{ balance, setBalance }}>
      {children}
    </PersonalWalletContext.Provider>
  );
}

export function usePersonalWallet() {
  const context = useContext(PersonalWalletContext);
  if (!context) {
    throw new Error("Personal wallet must be used within a PersonalWalletProvider.");
  }
  return context;
}

export function PersonalWalletHeader() {
  const { balance } = usePersonalWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-[#243775] bg-[#0C1638] text-[#EEF2FF]">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9FB0E6]">
          Personal wallet
        </p>
        <p aria-live="polite" className="text-sm font-bold text-[#F5C542] sm:text-base">
          {balance.toLocaleString()} coins
        </p>
      </div>
    </header>
  );
}
