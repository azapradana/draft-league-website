"use client";

import Image from "next/image";
import { useState } from "react";
import type { ParticipantStatus, TournamentFormat } from "@prisma/client";
import Link from "next/link";
import { isOptimizableImageUrl } from "@/lib/image-optimization";

type TournamentCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  regulation: string;
  format: TournamentFormat;
  swissRounds: number;
  topCut: number;
  maxParticipants: number | null;
  active: boolean;
  completed: boolean;
  matchCount: number;
  participantCount: number;
  participationStatus: ParticipantStatus | null;
};

type TournamentCategory = "ongoing" | "upcoming" | "completed";

const categories: { id: TournamentCategory; label: string }[] = [
  { id: "ongoing", label: "Ongoing" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

const numberFormatter = new Intl.NumberFormat("en-US");

export default function TournamentStatusTabs({
  tournaments,
  accentColor,
  initialCategory,
}: {
  tournaments: TournamentCard[];
  accentColor: string;
  initialCategory: TournamentCategory;
}) {
  const [activeCategory, setActiveCategory] =
    useState<TournamentCategory>(initialCategory);
  const groupedTournaments: Record<TournamentCategory, TournamentCard[]> = {
    ongoing: tournaments.filter(
      (tournament) => !tournament.completed && tournament.matchCount > 0,
    ),
    upcoming: tournaments.filter(
      (tournament) => !tournament.completed && tournament.matchCount === 0,
    ),
    completed: tournaments.filter((tournament) => tournament.completed),
  };
  const visibleTournaments = groupedTournaments[activeCategory];

  return (
    <div>
      <div
        className="mb-6 flex gap-2 overflow-x-auto border-b border-[#243775] pb-px"
        role="tablist"
        aria-label="Filter tournaments by status"
      >
        {categories.map(({ id, label }) => {
          const isActive = activeCategory === id;

          return (
            <button
              key={id}
              id={`tournament-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="tournament-panel"
              onClick={() => setActiveCategory(id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] sm:px-5 ${
                isActive
                  ? "border-[#F5C542] text-white"
                  : "border-transparent text-[#9FB0E6] hover:border-[#526bb4] hover:text-white"
              }`}
              style={isActive ? { borderColor: accentColor } : undefined}
            >
              {label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  isActive
                    ? "bg-[#F5C542]/15 text-[#F5C542]"
                    : "bg-[#122050] text-[#9FB0E6]"
                }`}
                style={isActive ? { color: accentColor } : undefined}
              >
                {groupedTournaments[id].length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="tournament-panel"
        role="tabpanel"
        aria-labelledby={`tournament-tab-${activeCategory}`}
        tabIndex={0}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5C542]"
      >
        <p className="mb-4 text-sm text-[#9FB0E6]" aria-live="polite">
          Showing {visibleTournaments.length} event
          {visibleTournaments.length === 1 ? "" : "s"}
        </p>

        {visibleTournaments.length === 0 ? (
          <div className="rounded-2xl border border-[#243775] bg-[#0C1638] px-6 py-12 text-center sm:px-10">
            <p className="display-font text-2xl font-bold">
              {activeCategory === "ongoing"
                ? "No live events right now."
                : activeCategory === "upcoming"
                  ? "The bracket is waiting."
                  : "No completed events yet."}
            </p>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              {activeCategory === "upcoming"
                ? "Check back soon for the next event."
                : activeCategory === "completed"
                  ? "Completed tournaments and their results will appear here."
                  : "Browse upcoming tournaments to find your next match."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleTournaments.map((tournament, index) => {
              const status = tournament.completed
                ? "COMPLETED"
                : tournament.matchCount > 0
                  ? "IN PROGRESS"
                  : tournament.active
                    ? "REGISTRATION OPEN"
                    : "DRAFT";
              const statusClass = tournament.completed
                ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
                : tournament.matchCount > 0
                  ? "border-blue-300/20 bg-blue-300/10 text-blue-200"
                  : tournament.active
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                    : "border-[#526bb4]/40 bg-[#122050] text-[#B9C5E8]";
              const format =
                tournament.format === "SWISS"
                  ? `Swiss${tournament.topCut > 0 ? ` + Top ${tournament.topCut}` : ""} · ${tournament.swissRounds} rounds`
                  : "Single Elimination";
              const participantLimit =
                tournament.maxParticipants === null
                  ? "Open"
                  : numberFormatter.format(tournament.maxParticipants);

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
                          <Image
                            src={tournament.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                            preload={index === 0}
                            unoptimized={!isOptimizableImageUrl(tournament.imageUrl)}
                            className="object-cover transition duration-500 group-hover:scale-105"
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
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="display-font line-clamp-1 text-xl font-bold tracking-tight group-hover:text-white">
                            {tournament.name}
                          </h3>
                          <span className="shrink-0 rounded-md border border-[#243775] bg-[#122050] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B9C5E8]">
                            {format}
                          </span>
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
                          <span className="flex items-center gap-2 text-[#9FB0E6]">
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                              aria-hidden="true"
                            >
                              <path d="M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 15a5.5 5.5 0 0 1 11 0v1H2v-1ZM14 11c2.21 0 4 1.79 4 4v1h-3v-1a6.47 6.47 0 0 0-1.1-3.63c.03-.12.06-.25.1-.37Z" />
                            </svg>
                            {numberFormatter.format(tournament.participantCount)} /{" "}
                            {participantLimit} players
                          </span>
                          <span
                            className="text-sm font-bold transition group-hover:translate-x-0.5"
                            style={{ color: accentColor }}
                          >
                            View event <span aria-hidden="true">→</span>
                          </span>
                        </div>
                        {tournament.participationStatus && (
                          <p className="mt-3 text-xs font-semibold text-[#B9C5E8]">
                            Your status: {tournament.participationStatus}
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
      </div>
    </div>
  );
}
