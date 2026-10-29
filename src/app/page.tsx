import { MatchStatus, ParticipantStatus } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import TournamentStatusTabs from "./tournament-status-tabs";

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const session = await getServerSession(authOptions);
  const [settings, tournaments, activePlayers, matchesPlayed, coinsInCirculation] =
    await Promise.all([
      getSiteSettings(),
      prisma.tournament.findMany({
        orderBy: [{ active: "desc" }, { completed: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          imageUrl: true,
          regulation: true,
          format: true,
          swissRounds: true,
          topCut: true,
          maxParticipants: true,
          active: true,
          completed: true,
          participants: session?.user?.id
            ? {
                where: { userId: session.user.id },
                select: { status: true },
              }
            : false,
          _count: {
            select: {
              participants: { where: { status: ParticipantStatus.APPROVED } },
              matches: true,
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
  const tournamentCards = tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    imageUrl: tournament.imageUrl,
    regulation: tournament.regulation,
    format: tournament.format,
    swissRounds: tournament.swissRounds,
    topCut: tournament.topCut,
    maxParticipants: tournament.maxParticipants,
    active: tournament.active,
    completed: tournament.completed,
    matchCount: tournament._count.matches,
    participantCount: tournament._count.participants,
    participationStatus: Array.isArray(tournament.participants)
      ? tournament.participants[0]?.status ?? null
      : null,
  }));
  const mobileStats: { label: string; value: number }[] = [
    { label: "Active players", value: activePlayers },
    { label: "Matches played", value: matchesPlayed },
    { label: "Coins in play", value: coinsInCirculation._sum.coins ?? 0 },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070D24] text-[#EEF2FF]">
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
        </div>
        <TournamentStatusTabs
          key={
            category === "upcoming" || category === "completed"
              ? category
              : "ongoing"
          }
          tournaments={tournamentCards}
          accentColor={settings.accentColor}
          initialCategory={
            category === "upcoming" || category === "completed"
              ? category
              : "ongoing"
          }
        />
      </section>

      <footer className="border-t border-white/5 py-6">
        <p className="mx-auto max-w-7xl px-5 text-xs text-[#7181B3] sm:px-8">
          © {new Date().getFullYear()} {settings.siteTitle}. All tournament data is live.
        </p>
      </footer>
    </main>
  );
}
