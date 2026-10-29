import Link from "next/link";

export default async function AdminTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const basePath = `/admin/t/${id}`;
  const links = [
    { href: `${basePath}`, label: "General settings" },
    { href: `${basePath}/participants`, label: "Participants" },
    { href: `${basePath}/packs`, label: "Packs / Gacha" },
    { href: `${basePath}/matches`, label: "Brackets" },
    { href: `${basePath}/disputes`, label: "Disputes" },
  ];

  return (
    <div className="min-h-screen bg-[#070D24] text-[#EEF2FF] md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-[#243775] bg-[#0C1638] md:flex md:flex-col">
        <div className="border-b border-[#243775] px-6 py-6">
          <Link
            href="/admin"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[#9FB0E6] transition hover:text-[#F5C542]"
          >
            ← Admin dashboard
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#F5C542]">
            Tournament workspace
          </p>
        </div>
        <nav aria-label="Tournament management" className="space-y-1 px-3 py-5">
          {links.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#122050] hover:text-[#F5C542] ${
                index === 3 ? "mt-4 border-t border-[#243775] pt-5" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <details className="border-b border-[#243775] bg-[#0C1638] md:hidden">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#EEF2FF] marker:hidden">
            <span className="mr-2 text-[#F5C542]" aria-hidden="true">
              ☰
            </span>
            Tournament menu
          </summary>
          <nav
            aria-label="Tournament management"
            className="grid gap-1 border-t border-[#243775] px-4 py-3"
          >
            <Link href="/admin" className="rounded-lg px-3 py-2 text-sm text-[#9FB0E6]">
              ← Admin dashboard
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[#122050] hover:text-[#F5C542]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
        {children}
      </div>
    </div>
  );
}
