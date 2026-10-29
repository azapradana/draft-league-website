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
