import { MatchStatus, ParticipantStatus } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { AccountMenu } from "@/components/auth/account-menu";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function Home() {
  const session = await getServerSession(authOptions);
  const [settings, tournaments, activePlayers, matchesPlayed, coinsInCirculation] =
    await Promise.all([
      getSiteSettings(),
      prisma.tournament.findMany({
        orderBy: [{ active: "desc" }, { completed: "asc" }, { name: "asc" }],
        take: 6,
        include: {
          participants: session?.user?.id
            ? {
                where: { userId: session.user.id },
                select: { status: true },
              }
            : false,
          _count: {
            select: {
              participants: { where: { status: ParticipantStatus.APPROVED } },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          participants: {
            some: {
              status: ParticipantStatus.APPROVED,
              tournament: { active: true, completed: false },
            },
          },
        },
      }),
      prisma.match.count({ where: { status: MatchStatus.COMPLETED } }),
      prisma.participant.aggregate({
        where: { status: ParticipantStatus.APPROVED },
        _sum: { coins: true },
      }),
    ]);

  const shopTournament = tournaments.find((tournament) => !tournament.completed);
  const mobileStats: { label: string; value: number }[] = [
    { label: "Active players", value: activePlayers },
    { label: "Matches played", value: matchesPlayed },
    { label: "Coins in play", value: coinsInCirculation._sum.coins ?? 0 },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070D24] text-[#EEF2FF]">
      <header className="relative z-10 border-b border-white/5 bg-[#070D24]/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            {settings.siteLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.siteLogoUrl}
                alt=""
                className="h-10 w-10 rounded-xl object-contain"
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-[#070D24]"
                style={{ backgroundColor: settings.accentColor }}
                aria-hidden="true"
              >
                D
              </span>
            )}
            <span className="truncate text-base font-extrabold tracking-tight sm:text-lg">
              {settings.siteTitle}
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main navigation">
            <a
              href="#tournaments"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#9FB0E6] transition hover:text-white sm:inline-flex"
            >
              Tournaments
            </a>
            {session?.user ? (
              <div className="flex items-center gap-2">
                {session.user.role === "ADMIN" && (
                  <Link
                    className="hidden rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold transition hover:border-[#F5C542] sm:inline-flex"
                    href="/admin"
                  >
                    Admin
                  </Link>
                )}
                <AccountMenu
                  email={session.user.email}
                  name={session.user.name ?? session.user.email ?? "Player"}
                  role={session.user.role}
                />
              </div>
            ) : (
              <Link
                className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-bold transition hover:border-white/50 sm:px-4"
                href="/login"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <section className="relative isolate border-b border-white/5">
        <div
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_75%_35%,#243775_0%,#122050_30%,#070D24_78%)] bg-cover bg-center"
          style={{ backgroundImage: "var(--hero-background-image)" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070D24] via-[#070D24]/90 to-[#070D24]/45"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-t from-[#070D24] via-transparent to-[#070D24]/25"
          aria-hidden="true"
        />
        <div className="mx-auto grid min-h-[480px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:py-28">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              The league is live
            </div>
            <p
              className="mb-4 text-xs font-extrabold uppercase tracking-[0.24em]"
              style={{ color: settings.accentColor }}
            >
              Draft. Battle. Become legend.
            </p>
            <h1 className="display-font max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              {settings.heroHeadline}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#B9C5E8] sm:text-lg sm:leading-8">
              {settings.heroSubheading}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#tournaments"
                className="inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-sm font-extrabold text-[#070D24] transition hover:brightness-110"
                style={{ backgroundColor: settings.accentColor }}
              >
                Browse tournaments <span className="ml-2" aria-hidden="true">→</span>
              </a>
              <Link
                href={shopTournament ? `/t/${shopTournament.id}/shop` : "#tournaments"}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold transition hover:border-white/40 hover:bg-white/10"
              >
                Explore Gacha Shop <span className="ml-2" aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>

          <div className="hidden justify-self-end lg:block">
            <div className="w-72 rounded-2xl border border-white/10 bg-[#0C1638]/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#9FB0E6]">
                  Live league
                </span>
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  ONLINE
                </span>
              </div>
              <p className="display-font mt-8 text-5xl font-black tracking-tight">
                {numberFormatter.format(activePlayers)}
              </p>
              <p className="mt-1 text-sm text-[#9FB0E6]">active competitors</p>
              <div className="mt-6 h-px bg-white/10" />
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-[#9FB0E6]">Matches decided</span>
                <span className="font-bold">{numberFormatter.format(matchesPlayed)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-[#9FB0E6]">League economy</span>
                <span className="font-bold" style={{ color: settings.accentColor }}>
                  {numberFormatter.format(coinsInCirculation._sum.coins ?? 0)} coins
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:hidden">
        <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-[#243775] bg-[#0C1638] py-4">
          {mobileStats.map(({ label, value }) => (
            <div className="px-3 text-center" key={label}>
              <p className="display-font text-xl font-black sm:text-2xl">
                {numberFormatter.format(value)}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#9FB0E6] sm:text-xs">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="tournaments"
        className="mx-auto max-w-7xl scroll-mt-8 px-5 pb-20 pt-10 sm:px-8 sm:pt-14"
      >
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-xs font-extrabold uppercase tracking-[0.2em]"
              style={{ color: settings.accentColor }}
            >
              Find your next match
            </p>
            <h2 className="display-font mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Featured tournaments
            </h2>
          </div>
          {tournaments.length > 0 && (
            <p className="text-sm text-[#9FB0E6]">
              Showing {tournaments.length} event{tournaments.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {tournaments.length === 0 ? (
          <div className="rounded-2xl border border-[#243775] bg-[#0C1638] px-6 py-12 text-center sm:px-10">
            <p className="display-font text-2xl font-bold">The bracket is waiting.</p>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              No tournaments are listed yet. Check back soon for the next event.
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => {
              const participation = Array.isArray(tournament.participants)
                ? tournament.participants[0]
                : undefined;
              const status = tournament.completed
                ? "COMPLETED"
                : tournament.active
                  ? "REGISTRATION OPEN"
                  : "IN PROGRESS";
              const statusClass = tournament.completed
                ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
                : tournament.active
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                  : "border-amber-300/20 bg-amber-300/10 text-amber-200";

              return (
                <li key={tournament.id}>
                  <article className="group h-full overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638] transition duration-200 hover:-translate-y-1 hover:border-[#526bb4] hover:shadow-xl hover:shadow-black/20">
                    <Link
                      className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#F5C542]"
                      href={`/t/${tournament.id}`}
                      aria-label={`View ${tournament.name}`}
                    >
                      <div className="relative h-40 overflow-hidden bg-[radial-gradient(ellipse_at_80%_35%,#243775_0%,#122050_48%,#0C1638_100%)]">
                        {tournament.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tournament.imageUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span
                              className="display-font text-6xl font-black tracking-tighter text-white/10"
                              aria-hidden="true"
                            >
                              DRAFT
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#070D24]/90 via-transparent to-[#070D24]/10" />
                        <span
                          className={`absolute left-4 top-4 rounded-full border px-3 py-1.5 text-[10px] font-extrabold tracking-[0.1em] ${statusClass}`}
                        >
                          {status}
                        </span>
                        <span className="absolute bottom-4 right-4 rounded-md border border-white/15 bg-[#070D24]/70 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white backdrop-blur">
                          REGULATION {tournament.regulation.toUpperCase()}
                        </span>
                      </div>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="display-font line-clamp-1 text-xl font-bold tracking-tight group-hover:text-white">
                            {tournament.name}
                          </h3>
                          <span className="shrink-0 rounded-md border border-[#243775] bg-[#122050] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B9C5E8]">
                            {tournament.format === "SWISS"
                              ? `Swiss · ${tournament.swissRounds} rounds${tournament.topCut > 0 ? ` · Top ${tournament.topCut}` : ""}`
                              : "Single Elimination"}
                          </span>
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
                          <span className="flex items-center gap-2 text-[#9FB0E6]">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                              <path d="M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 15a5.5 5.5 0 0 1 11 0v1H2v-1ZM14 11c2.21 0 4 1.79 4 4v1h-3v-1a6.47 6.47 0 0 0-1.1-3.63c.03-.12.06-.25.1-.37Z" />
                            </svg>
                            {numberFormatter.format(tournament._count.participants)} players
                          </span>
                          <span
                            className="text-sm font-bold transition group-hover:translate-x-0.5"
                            style={{ color: settings.accentColor }}
                          >
                            View event <span aria-hidden="true">→</span>
                          </span>
                        </div>
                        {participation && (
                          <p className="mt-3 text-xs font-semibold text-[#B9C5E8]">
                            Your status: {participation.status}
                          </p>
                        )}
                      </div>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="border-t border-white/5 py-6">
        <p className="mx-auto max-w-7xl px-5 text-xs text-[#7181B3] sm:px-8">
          © {new Date().getFullYear()} {settings.siteTitle}. All tournament data is live.
        </p>
      </footer>
    </main>
  );
}
