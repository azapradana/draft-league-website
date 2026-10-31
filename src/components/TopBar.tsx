"use client";

import { usePathname } from "next/navigation";

const routeTitles: Record<string, string> = {
  "/": "Tournaments",
  "/profile": "My profile & wallet",
  "/admin": "Admin dashboard",
  "/admin/packs": "Global packs",
  "/admin/groups": "Group management",
  "/admin/settings": "Site branding",
};

function getPageTitle(pathname: string) {
  const exactTitle = routeTitles[pathname];
  if (exactTitle) return exactTitle;
  if (pathname.startsWith("/admin/t/")) return "Tournament administration";
  if (pathname.startsWith("/admin/packs/")) return "Edit global pack";
  if (pathname.startsWith("/profile/")) return "Profile settings";
  return "Draft League";
}

export default function TopBar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b border-[#243775]/70 bg-[#070D24]/90 px-4 backdrop-blur-md sm:px-6 md:px-8">
      <button
        aria-label="Open navigation menu"
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#243775] text-[#EEF2FF] transition-colors hover:border-[#F5C542] hover:text-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542] md:hidden"
        onClick={onMenuClick}
        type="button"
      >
        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </button>
      <div className="min-w-0">
        <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-[#7181B3] sm:block">
          Draft League
        </p>
        <p className="truncate text-sm font-bold text-[#EEF2FF] sm:mt-0.5 sm:text-base">
          {title}
        </p>
      </div>
    </header>
  );
}
