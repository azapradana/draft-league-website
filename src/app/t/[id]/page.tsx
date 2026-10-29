import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSwissStandings } from "@/lib/tournament-standings";
import CheckInButton from "./check-in-button";
import JoinTournamentButton from "./join-tournament-button";
import PokemonArtwork from "./pokemon-artwork";
import { RichText } from "@/components/rich-text";

export default async function TournamentOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      format: true,
      swissRounds: true,
      topCut: true,
      currentStage: true,
      completed: true,
      maxParticipants: true,
      regulation: true,
      startingCoins: true,
      maxCopiesPerPlayer: true,
      maxCopiesLeague: true,
      checkInOpen: true,
      rostersLocked: true,
      rostersPublic: true,
      participants: {
        where: { userId: session.user.id },
        select: { id: true, status: true, checkedIn: true },
      },
      matches: {
        orderBy: [
          { roundNumber: "asc" },
          { bracketPosition: "asc" },
          { createdAt: "asc" },
        ],
        include: {
          player1: {
            include: {
              user: { select: { name: true, username: true } },
            },
          },
          player2: {
            include: {
              user: { select: { name: true, username: true } },
            },
          },
          winner: {
            include: {
              user: { select: { name: true, username: true } },
            },
          },
        },
      },
    },
  });

  if (!tournament) notFound();

  const activeParticipantCount =
    tournament.maxParticipants === null
      ? null
      : await prisma.participant.count({
          where: {
            tournamentId: id,
            status: { in: ["PENDING", "APPROVED"] },
          },
        });
  const participantLimitReached =
    tournament.maxParticipants !== null &&
    activeParticipantCount !== null &&
    activeParticipantCount >= tournament.maxParticipants;

  const canViewAllRosters =
    session.user.role === "ADMIN" || tournament.rostersPublic;
  const approvedParticipants = await prisma.participant.findMany({
    where: { tournamentId: id, status: "APPROVED" },
    orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
    select: {
      id: true,
      checkedIn: true,
      user: { select: { name: true, username: true } },
    },
  });
  const visibleRosters = await prisma.roster.findMany({
    where: {
      participant: {
        is: {
          tournamentId: id,
          status: "APPROVED",
          ...(canViewAllRosters ? {} : { userId: session.user.id }),
        },
      },
    },
    select: { participantId: true, speciesIds: true },
  });
  const speciesIds = [...new Set(visibleRosters.flatMap((roster) => roster.speciesIds))];
  const species = speciesIds.length
    ? await prisma.species.findMany({
        where: { dex: { in: speciesIds } },
        select: { dex: true, name: true, isMega: true, imageUrl: true },
      })
    : [];
  const speciesByDex = new Map(species.map((entry) => [entry.dex, entry]));
  const rosterByParticipant = new Map(
    visibleRosters.map((roster) => [roster.participantId, roster.speciesIds]),
  );

  const participation = Array.isArray(tournament.participants)
    ? tournament.participants[0]
    : undefined;
  const currentRound =
    tournament.matches.length > 0
      ? tournament.matches[tournament.matches.length - 1].roundNumber
      : null;
  const currentStage =
    tournament.format === "SWISS" &&
    tournament.currentStage === "SINGLE_ELIMINATION"
      ? "SWISS"
      : tournament.currentStage;
  const rounds = Array.from(
    new Set(tournament.matches.map((match) => match.roundNumber)),
  );
  const topCutRoundNumbers = Array.from(
    new Set(
      tournament.matches
        .filter((match) => match.stage === "TOP_CUT")
        .map((match) => match.roundNumber),
    ),
  );
  const finalRoundMatches = tournament.matches.filter(
    (match) => match.roundNumber === currentRound,
  );
  const finalMatch =
    finalRoundMatches.length === 1 ? finalRoundMatches[0] : null;
  const bracketCompleted =
    finalMatch?.status === "COMPLETED" &&
    finalMatch.winnerId !== null &&
    (finalMatch.winnerId === finalMatch.player1Id ||
      finalMatch.winnerId === finalMatch.player2Id) &&
    tournament.matches.every((match) => match.status === "COMPLETED");
  const tournamentCompleted =
    tournament.format === "SWISS" && tournament.topCut === 0
      ? tournament.completed
      : bracketCompleted;
  const swissStandings =
    tournament.format === "SWISS"
      ? buildSwissStandings(approvedParticipants, tournament.matches)
      : [];
  const swissRankById = new Map(
    swissStandings.map((standing, index) => [standing.id, index]),
  );
  const eliminatedInRound = new Map<string, number>();

  if (tournamentCompleted) {
    for (const match of tournament.matches) {
      if (match.status !== "COMPLETED" || !match.winnerId) continue;
      if (tournament.format === "SWISS" && match.stage !== "TOP_CUT") continue;

      for (const participantId of [match.player1Id, match.player2Id]) {
        if (participantId && participantId !== match.winnerId) {
          eliminatedInRound.set(participantId, match.roundNumber);
        }
      }
    }
  }

  const participantsToDisplay = tournamentCompleted
    ? [...approvedParticipants].sort((a, b) => {
        if (tournament.format === "SWISS" && tournament.topCut === 0) {
          const rankDifference =
            (swissRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (swissRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER);
          if (rankDifference !== 0) return rankDifference;
        } else {
          const aIsChampion = a.id === finalMatch?.winnerId;
          const bIsChampion = b.id === finalMatch?.winnerId;
          if (aIsChampion !== bIsChampion) return aIsChampion ? -1 : 1;

          const roundDifference =
            (eliminatedInRound.get(b.id) ?? 0) -
            (eliminatedInRound.get(a.id) ?? 0);
          if (roundDifference !== 0) return roundDifference;

          const swissRankDifference =
            (swissRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (swissRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER);
          if (swissRankDifference !== 0) return swissRankDifference;
        }

        const aName = a.user.name ?? a.user.username ?? "Unnamed player";
        const bName = b.user.name ?? b.user.username ?? "Unnamed player";
        return aName.localeCompare(bName) || a.id.localeCompare(b.id);
      })
    : approvedParticipants;

  const participantRanks = new Map(
    participantsToDisplay.map((participant, index) => [
      participant.id,
      index + 1,
    ]),
  );

  function displayName(
    participant: {
      id: string;
      user: { name: string | null; username: string | null };
    } | null,
  ) {
    if (!participant) return "Bye";
    return participant.user.name ?? participant.user.username ?? "Unnamed player";
  }

  return (
    <div className="space-y-8">
      <section>
        {tournament.imageUrl && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-[#243775]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tournament.imageUrl}
              alt=""
              className="max-h-80 w-full object-cover"
            />
          </div>
        )}
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Tournament overview
        </p>
        <h2 className="mt-2 text-3xl font-bold">{tournament.name}</h2>
        {tournament.description ? (
          <div className="mt-3 max-w-2xl">
            <RichText value={tournament.description} />
          </div>
        ) : (
          <p className="mt-3 max-w-2xl text-[#9FB0E6]">
            Review the tournament settings and your participation status.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <h3 className="text-xl font-semibold">Rules and settings</h3>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[#9FB0E6]">Tournament format</dt>
            <dd className="mt-1 font-semibold">
              {tournament.format === "SWISS"
                ? `Swiss Rounds · ${tournament.swissRounds} rounds`
                : "Single Elimination"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">Participant limit</dt>
            <dd className="mt-1 font-semibold">
              {tournament.maxParticipants === null
                ? "No limit"
                : `${activeParticipantCount} / ${tournament.maxParticipants}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">Regulation</dt>
            <dd className="mt-1 font-semibold">
              {tournament.regulation.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">Starting coins</dt>
            <dd className="mt-1 font-semibold text-[#F5C542]">
              {tournament.startingCoins.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">Copy limit per player</dt>
            <dd className="mt-1 font-semibold">
              {tournament.maxCopiesPerPlayer}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">League-wide copy limit</dt>
            <dd className="mt-1 font-semibold">
              {tournament.maxCopiesLeague ?? "No limit"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <h3 className="text-xl font-semibold">Your participation</h3>
        {participation ? (
          <div className="mt-4">
            <p className="text-[#9FB0E6]">
              Status:{" "}
              <span className="font-bold text-[#EEF2FF]">
                {participation.status}
              </span>
            </p>
            {participation.status === "PENDING" && (
              <p className="mt-2 text-sm text-[#9FB0E6]">
                An admin will review your request.
              </p>
            )}
            {participation.status === "APPROVED" && (
              <p className="mt-2 text-sm text-[#9FB0E6]">
                Your request was approved. You can now buy packs and manage your roster.
              </p>
            )}
            {participation.status === "REJECTED" && (
              <p className="mt-2 text-sm text-[#9FB0E6]">
                Your request was declined. Contact a tournament admin if you
                think this is a mistake.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[#9FB0E6]">You have not joined this tournament.</p>
            {participantLimitReached ? (
              <p className="mt-3 text-sm font-semibold text-amber-200">
                This tournament has reached its participant limit.
              </p>
            ) : (
              <JoinTournamentButton tournamentId={id} />
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#F5C542]/50 bg-[#0C1638] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Tournament check-in</h3>
            <p className="mt-2 text-[#9FB0E6]">
              {!tournament.checkInOpen
                ? "Check-in is currently closed."
                : participation?.status !== "APPROVED"
                  ? "Check-in is open. An approved tournament place is required."
                  : participation.checkedIn
                    ? "You are checked in for this tournament."
                    : "Check in now to confirm your participation."}
            </p>
          </div>
          {tournament.checkInOpen &&
            participation?.status === "APPROVED" &&
            (participation.checkedIn ? (
              <span className="rounded-lg border border-emerald-500/60 px-5 py-3 font-semibold text-emerald-300">
                Checked in
              </span>
            ) : (
              <CheckInButton tournamentId={id} />
            ))}
        </div>
      </section>

      <section
        id="bracket"
        className="scroll-mt-20 rounded-2xl border border-[#243775] bg-[#0C1638] p-6"
      >
        <div>
          <h3 className="text-xl font-semibold">Tournament bracket</h3>
          <p className="mt-1 text-sm text-[#9FB0E6]">
            {currentRound === null
              ? "Pairings will appear here when the tournament starts."
              : `${currentStage.replace(/_/g, " ")} · Round ${currentRound}. Your active pairing is highlighted.`}
          </p>
          {tournament.format === "SWISS" && (
            <Link
              className="mt-3 inline-flex text-sm font-semibold text-[#F5C542] underline underline-offset-2"
              href={`/t/${tournament.id}/standings`}
            >
              View Swiss standings
            </Link>
          )}
        </div>

        {tournament.matches.length === 0 ? (
          <div className="mt-6 flex items-start gap-4 rounded-xl border border-dashed border-[#243775] p-5 text-[#9FB0E6]">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-6 w-6 shrink-0 text-[#F5C542]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Zm4 10h2m2 0h2"
              />
            </svg>
            <p>
              Tournament bracket has not been generated yet. Check in and wait for the admin to
              start Round 1.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {rounds.map((roundNumber) => {
              const roundMatches = tournament.matches.filter(
                (match) => match.roundNumber === roundNumber,
              );

              return (
                <section key={roundNumber}>
                  <h4 className="mb-3 text-lg font-semibold">
                    {roundMatches[0].stage === "TOP_CUT"
                      ? `Top Cut · Round ${topCutRoundNumbers.indexOf(roundNumber) + 1}`
                      : roundMatches[0].stage === "SWISS" ||
                          (roundMatches[0].stage === null &&
                            tournament.format === "SWISS")
                        ? `Swiss · Round ${roundNumber}`
                        : `Round ${roundNumber}`}
                    {roundNumber === currentRound ? " · Current" : ""}
                  </h4>
                  <ul className="space-y-3">
                    {roundMatches.map((match, index) => {
                      const isOwnMatch =
                        roundNumber === currentRound &&
                        Boolean(participation?.id) &&
                        (match.player1Id === participation?.id ||
                          match.player2Id === participation?.id);

                      return (
                        <li
                          key={match.id}
                          className={`rounded-xl border p-4 ${
                            isOwnMatch
                              ? "border-[#F5C542] bg-[#F5C542]/10 ring-1 ring-[#F5C542]/50"
                              : "border-[#243775] bg-[#070D24]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm text-[#9FB0E6]">
                              Match {index + 1}
                              {isOwnMatch && (
                                <span className="ml-2 font-bold text-[#F5C542]">
                                  Your pairing
                                </span>
                              )}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                match.status === "COMPLETED"
                                  ? "bg-emerald-950 text-emerald-300"
                                  : match.status === "DISPUTED"
                                    ? "bg-red-950 text-red-300"
                                    : "bg-[#243775] text-[#9FB0E6]"
                              }`}
                            >
                              {match.status}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 font-semibold">
                            {[match.player1, match.player2].map(
                              (player, playerIndex) => (
                                <span
                                  key={player?.id ?? `bye-${match.id}-${playerIndex}`}
                                  className="inline-flex items-center gap-2"
                                >
                                  {playerIndex > 0 && (
                                    <span className="text-[#9FB0E6]">vs.</span>
                                  )}
                                  <span
                                    className={
                                      player?.id === participation?.id
                                        ? "text-[#F5C542]"
                                        : undefined
                                    }
                                  >
                                    {displayName(player)}
                                  </span>
                                  {player && (
                                    <Link
                                      href={`/t/${tournament.id}/matches/${match.id}`}
                                      className="rounded-md border border-[#243775] px-2 py-1 text-xs font-semibold text-[#9FB0E6] hover:border-[#F5C542] hover:text-[#F5C542]"
                                    >
                                      Open match
                                    </Link>
                                  )}
                                </span>
                              ),
                            )}
                          </div>

                          {match.player2 === null ? (
                            <p className="mt-2 text-sm text-emerald-300">
                              Bye — {displayName(match.winner)} advanced automatically.
                            </p>
                          ) : match.winner ? (
                            <p className="mt-2 text-sm text-[#9FB0E6]">
                              Winner: {displayName(match.winner)}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Participants</h3>
            <p className="mt-1 text-sm text-[#9FB0E6]">
              {canViewAllRosters
                ? "Check-in status and participant rosters."
                : "Check-in status is public. Rosters are private except for your own."}
            </p>
          </div>
          <span className="text-sm text-[#9FB0E6]">
            {tournament.rostersLocked ? "Rosters locked" : "Roster editing open"}
          </span>
        </div>

        {participantsToDisplay.length === 0 ? (
          <p className="mt-5 text-[#9FB0E6]">No approved participants yet.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#243775] text-sm text-[#9FB0E6]">
                  {tournamentCompleted && (
                    <th scope="col" className="px-3 py-3 font-semibold">Rank</th>
                  )}
                  <th scope="col" className="px-3 py-3 font-semibold">Participant</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Check-in</th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    {tournament.rostersLocked ? "Locked roster" : "Current roster"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {participantsToDisplay.map((participant) => {
                  const isOwnParticipant = participant.id === participation?.id;
                  const canViewRoster = canViewAllRosters || isOwnParticipant;
                  const roster = canViewRoster
                    ? (rosterByParticipant.get(participant.id) ?? [])
                    : null;
                  const rank = participantRanks.get(participant.id);
                  const medal =
                    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

                  return (
                    <tr key={participant.id} className="border-b border-[#243775]/70 align-top last:border-0">
                      {tournamentCompleted && (
                        <td className="px-3 py-4 font-bold text-[#F5C542]">
                          {rank}
                        </td>
                      )}
                      <th scope="row" className="px-3 py-4 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          {participant.user.name ??
                            participant.user.username ??
                            "Unnamed player"}
                          {medal && (
                            <span
                              aria-label={
                                rank === 1
                                  ? "Gold medal"
                                  : rank === 2
                                    ? "Silver medal"
                                    : "Bronze medal"
                              }
                              role="img"
                              title={`Rank ${rank}`}
                            >
                              {medal}
                            </span>
                          )}
                        </span>
                      </th>
                      <td className="px-3 py-4">
                        <span
                          className={
                            participant.checkedIn
                              ? "font-semibold text-emerald-300"
                              : "text-[#9FB0E6]"
                          }
                        >
                          {participant.checkedIn ? "Checked in" : "Not checked in"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {roster === null ? (
                          <span className="text-[#9FB0E6]">Private</span>
                        ) : roster.length === 0 ? (
                          <span className="text-[#9FB0E6]">No roster saved</span>
                        ) : (
                          <ul className="flex flex-wrap gap-2">
                            {roster.map((speciesDex) => {
                              const entry = speciesByDex.get(speciesDex);
                              if (!entry) return null;

                              return (
                                <li
                                  key={speciesDex}
                                  className="flex items-center gap-1.5 rounded-lg border border-[#243775] bg-[#070D24] px-2 py-1"
                                  title={`${entry.name} #${entry.dex}${entry.isMega ? " · Mega" : ""}`}
                                >
                                  <PokemonArtwork species={entry} className="h-8 w-8" />
                                  <span className="text-sm">{entry.name}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
