import { ParticipantStatus } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import TournamentStatusTabs from "./tournament-status-tabs";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const session = await getServerSession(authOptions);
  const [settings, tournaments] = await Promise.all([
    getSiteSettings(),
    prisma.tournament.findMany({
      orderBy: [{ active: "desc" }, { completed: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        imageUrl: true,
        regulation: true,
        format: true,
        friendlyMatchSize: true,
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
  ]);

  const shopTournament = tournaments.find((tournament) => !tournament.completed);
  const tournamentCards = tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    imageUrl: tournament.imageUrl,
    regulation: tournament.regulation,
    format: tournament.format,
    friendlyMatchSize: tournament.friendlyMatchSize,
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
        <div className="mx-auto grid min-h-[480px] max-w-7xl items-center px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
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
            <Link
              href="/simulator"
              className="mt-5 inline-flex max-w-xl flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#F5C542]/30 bg-[#F5C542]/10 px-4 py-3 text-sm font-semibold text-[#FFE28A] transition hover:border-[#F5C542]/60 hover:bg-[#F5C542]/15"
            >
              <span className="rounded-full bg-[#F5C542] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#070D24]">
                Free practice
              </span>
              <span>Zero Cost. Pure Dopamine. Test your luck before the real tournament.</span>
            </Link>
          </div>
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
