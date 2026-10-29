"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { usePersonalWallet } from "@/components/wallet/personal-wallet";

type SidebarProps = {
  accentColor: string;
  siteLogoUrl: string | null;
  siteTitle: string;
  shopHref: string | null;
  user: {
    name: string;
    email?: string | null;
    role?: string;
    image?: string | null;
  } | null;
  mobileOpen: boolean;
  onClose: () => void;
};

const tournamentLinks = [
  { label: "Browse tournaments", category: "", icon: "◈" },
  { label: "Ongoing", category: "ongoing", icon: "●" },
  { label: "Upcoming", category: "upcoming", icon: "◷" },
  { label: "Completed", category: "completed", icon: "✓" },
];

function SidebarContents({
  accentColor,
  siteLogoUrl,
  siteTitle,
  shopHref,
  user,
  onNavigate,
}: Omit<SidebarProps, "mobileOpen" | "onClose"> & { onNavigate?: () => void }) {
  const { balance } = usePersonalWallet();
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";

  function navClass(isActive: boolean) {
    return `flex min-h-10 items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? "border-[#F5C542] bg-[#122050] text-[#F5C542]"
        : "border-transparent text-[#9FB0E6] hover:bg-[#122050] hover:text-[#EEF2FF]"
    }`;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
      <Link
        className="mb-8 flex min-w-0 items-center gap-3 rounded-lg px-2"
        href="/"
        onClick={onNavigate}
      >
        {siteLogoUrl ? (
          <Image
            src={siteLogoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-xl object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-lg font-black text-[#070D24]"
            style={{ backgroundColor: accentColor }}
          >
            D
          </span>
        )}
        <span className="truncate text-sm font-extrabold tracking-tight text-[#EEF2FF]">
          {siteTitle}
        </span>
      </Link>

      <div className="space-y-6">
        <section>
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7181B3]">
            League
          </p>
          <nav aria-label="Tournament navigation" className="space-y-1">
            {tournamentLinks.map(({ label, category, icon }) => (
              <Link
                aria-current={!category && pathname === "/" ? "page" : undefined}
                className={navClass(!category && pathname === "/")}
                href={category ? `/?category=${category}#tournaments` : "/"}
                key={label}
                onClick={onNavigate}
              >
                <span aria-hidden="true" className="w-4 text-center text-xs">
                  {icon}
                </span>
                {label}
              </Link>
            ))}
          </nav>
        </section>

        <section>
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7181B3]">
            Collect
          </p>
          <nav aria-label="Shop navigation" className="space-y-1">
            <Link
              aria-current={pathname.endsWith("/shop") ? "page" : undefined}
              className={navClass(pathname.endsWith("/shop"))}
              href={shopHref ?? "/"}
              onClick={onNavigate}
            >
              <span aria-hidden="true" className="w-4 text-center text-xs">✧</span>
              Gacha shop / Packs
            </Link>
          </nav>
        </section>

        {user && (
          <section>
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7181B3]">
              Account
            </p>
            <nav aria-label="Account navigation" className="space-y-1">
              <Link
                aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                className={navClass(pathname.startsWith("/profile"))}
                href="/profile"
                onClick={onNavigate}
              >
                <span aria-hidden="true" className="w-4 text-center text-xs">◉</span>
                My profile & wallet
              </Link>
              <div className="ml-9 flex items-center justify-between rounded-lg bg-[#070D24]/60 px-3 py-2">
                <span className="text-xs text-[#9FB0E6]">Coins</span>
                <span aria-live="polite" className="text-xs font-bold text-[#F5C542]">
                  {balance.toLocaleString()}
                </span>
              </div>
            </nav>
          </section>
        )}

        {isAdmin && (
          <section>
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7181B3]">
              Administration
            </p>
            <nav aria-label="Administration navigation" className="space-y-1">
              {[
                { label: "Admin dashboard", href: "/admin" },
                { label: "Global packs", href: "/admin/packs" },
                { label: "Site branding", href: "/admin/settings" },
              ].map(({ label, href }) => {
                const isActive =
                  pathname === href ||
                  (href !== "/admin" && pathname.startsWith(`${href}/`));
                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={navClass(isActive)}
                    href={href}
                    key={href}
                    onClick={onNavigate}
                  >
                    <span aria-hidden="true" className="w-4 text-center text-xs">⌘</span>
                    {label}
                  </Link>
                );
              })}
            </nav>
          </section>
        )}
      </div>

      <div className="mt-auto border-t border-[#243775] pt-4">
        {user ? (
          <>
            <Link
              className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#122050]"
              href="/profile"
              onClick={onNavigate}
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                  src={user.image}
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F5C542] text-sm font-black text-[#070D24]">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[#EEF2FF]">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-[#9FB0E6]">
                  {user.email ?? (isAdmin ? "Administrator" : "Player account")}
                </span>
              </span>
            </Link>
            <button
              className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-[#9FB0E6] transition-colors hover:bg-[#122050] hover:text-[#EEF2FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
              onClick={() => signOut({ callbackUrl: "/" })}
              type="button"
            >
              <span aria-hidden="true" className="w-4 text-center">↪</span>
              Sign out
            </button>
          </>
        ) : (
          <div className="grid gap-2">
            <Link
              className="flex min-h-10 items-center justify-center rounded-lg bg-[#F5C542] px-3 py-2 text-sm font-extrabold text-[#070D24] transition hover:brightness-110"
              href="/login"
              onClick={onNavigate}
            >
              Sign in
            </Link>
            <Link
              className="flex min-h-10 items-center justify-center rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] transition hover:border-[#F5C542]"
              href="/signup"
              onClick={onNavigate}
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({
  accentColor,
  siteLogoUrl,
  siteTitle,
  shopHref,
  user,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const contentsProps = { accentColor, siteLogoUrl, siteTitle, shopHref, user };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#243775]/70 bg-[#0C1638] md:block">
        <SidebarContents {...contentsProps} />
      </aside>

      <div
        aria-hidden={!mobileOpen}
        className={`fixed inset-0 z-50 transition-[visibility] duration-300 md:hidden ${
          mobileOpen ? "visible" : "invisible pointer-events-none delay-300"
        }`}
        inert={!mobileOpen}
      >
        <button
          aria-label="Close navigation menu"
          className={`absolute inset-0 bg-[#070D24]/75 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
          tabIndex={mobileOpen ? 0 : -1}
          type="button"
        />
        <aside
          aria-label="Main navigation"
          className={`absolute inset-y-0 left-0 w-[min(16rem,85vw)] border-r border-[#243775]/70 bg-[#0C1638] shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContents {...contentsProps} onNavigate={onClose} />
        </aside>
      </div>
    </>
  );
}
