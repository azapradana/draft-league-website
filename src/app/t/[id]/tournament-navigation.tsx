"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TournamentNavigation({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const pathname = usePathname();
  const navigation = [
    { label: "Overview", href: `/t/${tournamentId}` },
    { label: "Shop", href: `/t/${tournamentId}/shop` },
    { label: "My roster", href: `/t/${tournamentId}/roster` },
    { label: "Results", href: `/t/${tournamentId}/results` },
  ];

  return (
    <nav
      aria-label="Tournament navigation"
      className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-6 pb-4 sm:px-10"
    >
      {navigation.map((item) => {
        const isCurrent =
          pathname === item.href ||
          (item.label === "Overview" && pathname === `${item.href}/`);

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
              isCurrent
                ? "bg-[#F5C542] text-[#070D24]"
                : "text-[#9FB0E6] hover:bg-[#122050] hover:text-[#EEF2FF]"
            }`}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
