"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { CoinBalanceDisplay } from "./coin-balance";

type TournamentNavigationProps = {
  tournamentId: string;
  tournamentName: string;
  swissFormat: boolean;
  active: boolean;
  completed: boolean;
  email?: string | null;
  name: string;
  role?: string;
};

function TournamentStatus({
  active,
  completed,
}: {
  active: boolean;
  completed: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
        completed
          ? "bg-emerald-950 text-emerald-300"
          : active
            ? "bg-[#F5C542] text-[#070D24]"
            : "bg-[#243775] text-[#9FB0E6]"
      }`}
    >
      {completed ? "Completed" : active ? "Active" : "Inactive"}
    </span>
  );
}

function NavigationLinks({
  tournamentId,
  swissFormat,
  pathname,
  onNavigate,
}: {
  tournamentId: string;
  swissFormat: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const basePath = `/t/${tournamentId}`;
  const navigation = [
    { label: "Overview", href: basePath },
    { label: "Shop", href: `${basePath}/shop` },
    { label: "My Roster", href: `${basePath}/roster` },
    ...(swissFormat
      ? [{ label: "Swiss Standings", href: `${basePath}/standings` }]
      : []),
    { label: "Results", href: `${basePath}/results` },
    { label: "Matches / Bracket", href: `${basePath}#bracket` },
  ];

  return (
    <nav aria-label="Tournament navigation" className="space-y-1">
      {navigation.map((item) => {
        const isCurrent =
          item.label === "Matches / Bracket"
            ? pathname.startsWith(`${basePath}/matches`)
            : item.label === "Swiss Standings"
              ? pathname.startsWith(`${basePath}/standings`)
              : pathname === item.href ||
                (item.label === "Overview" && pathname === `${item.href}/`);

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              isCurrent
                ? "border-[#F5C542] bg-[#122050] text-[#F5C542]"
                : "border-transparent text-[#9FB0E6] hover:bg-[#122050] hover:text-[#EEF2FF]"
            }`}
            href={item.href}
            key={item.label}
            onClick={onNavigate}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                isCurrent ? "bg-[#F5C542]" : "bg-[#52669F]"
              }`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function TournamentNavigation({
  tournamentId,
  tournamentName,
  swissFormat,
  active,
  completed,
  email,
  name,
  role,
}: TournamentNavigationProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-14 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[#243775] bg-[#0C1638] px-4 py-3 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#EEF2FF]">
            {tournamentName}
          </p>
          <TournamentStatus active={active} completed={completed} />
        </div>
        <button
          aria-controls="tournament-mobile-drawer"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close tournament menu" : "Open tournament menu"}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#243775] text-[#EEF2FF] transition-colors hover:border-[#F5C542] hover:text-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
          type="button"
        >
          {menuOpen ? (
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          )}
        </button>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 z-20 hidden w-64 flex-col border-r border-[#243775]/60 bg-[#0C1638] px-4 py-6 md:flex">
        <div className="px-3">
          <Link
            className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#9FB0E6] transition-colors hover:text-[#EEF2FF]"
            href="/"
          >
            <span aria-hidden="true" className="mr-2">←</span>
            All tournaments
          </Link>
          <h1 className="break-words text-xl font-bold leading-tight text-[#EEF2FF]">
            {tournamentName}
          </h1>
          <div className="mt-3">
            <TournamentStatus active={active} completed={completed} />
          </div>
        </div>

        <div className="mx-3 my-6 rounded-xl border border-[#F5C542]/40 bg-[#070D24]/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9FB0E6]">
            Tournament balance
          </p>
          <div className="mt-1 text-lg font-bold text-[#F5C542]">
            <CoinBalanceDisplay />
          </div>
        </div>

        <NavigationLinks
          tournamentId={tournamentId}
          swissFormat={swissFormat}
          pathname={pathname}
        />

        <div className="mt-auto border-t border-[#243775] pt-4">
          <AccountMenu email={email} name={name} role={role} placement="top" />
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-50 transition-[visibility] duration-300 md:hidden ${
          menuOpen
            ? "visible delay-0"
            : "invisible pointer-events-none delay-300"
        }`}
        id="tournament-mobile-drawer"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <button
          aria-label="Close tournament menu"
          className={`absolute inset-0 bg-[#070D24]/75 transition-opacity duration-300 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMenuOpen(false)}
          tabIndex={menuOpen ? 0 : -1}
          type="button"
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r border-[#243775]/60 bg-[#0C1638] px-4 py-6 shadow-2xl transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between gap-3 px-3">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold leading-tight text-[#EEF2FF]">
                {tournamentName}
              </h2>
              <div className="mt-3">
                <TournamentStatus active={active} completed={completed} />
              </div>
            </div>
            <button
              aria-label="Close tournament menu"
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#243775] text-[#EEF2FF] hover:border-[#F5C542] hover:text-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
              onClick={() => setMenuOpen(false)}
              type="button"
            >
              <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="mx-3 my-6 rounded-xl border border-[#F5C542]/40 bg-[#070D24]/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9FB0E6]">
              Tournament balance
            </p>
            <div className="mt-1 text-lg font-bold text-[#F5C542]">
              <CoinBalanceDisplay />
            </div>
          </div>

          <NavigationLinks
            tournamentId={tournamentId}
            swissFormat={swissFormat}
            pathname={pathname}
            onNavigate={() => setMenuOpen(false)}
          />

          <div className="mt-auto space-y-3 border-t border-[#243775] pt-4">
            <Link
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-[#9FB0E6] transition-colors hover:bg-[#122050] hover:text-[#EEF2FF]"
              href="/"
              onClick={() => setMenuOpen(false)}
            >
              ← Back to all tournaments
            </Link>
            <AccountMenu email={email} name={name} role={role} placement="top" />
          </div>
        </aside>
      </div>
    </>
  );
}
