import { NextResponse, type NextRequest } from "next/server";
import { authFailure, requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isValidTimeZone } from "@/lib/schedule-time";

type RouteContext = { params: Promise<{ id: string; matchId: string }> };

const NO_STORE = { "Cache-Control": "no-store" };

function displayName(user: { name: string | null; username: string | null; email: string | null }) {
  return user.name ?? user.username ?? user.email ?? "Player";
}

async function loadMatch(tournamentId: string, matchId: string) {
  return prisma.match.findFirst({
    where: { id: matchId, tournamentId, tournament: { format: "FRIENDLY_MATCH" } },
    select: {
      id: true,
      scheduledAt: true,
      scheduledById: true,
      player1: { select: { id: true, user: { select: { id: true, name: true, username: true, email: true, timezone: true } } } },
      player2: { select: { id: true, user: { select: { id: true, name: true, username: true, email: true, timezone: true } } } },
      timeOptions: {
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        select: { id: true, proposedById: true, startsAt: true },
      },
    },
  });
}

type LoadedMatch = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

async function buildSnapshot(match: LoadedMatch, userId: string, isAdmin: boolean) {
  const players = [match.player1, match.player2].filter(
    (player): player is NonNullable<typeof player> => player !== null,
  );
  const viewerParticipantId = players.find((player) => player.user.id === userId)?.id ?? null;
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });

  return {
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    viewer: {
      isAdmin,
      participantId: viewerParticipantId,
      isPlayer: viewerParticipantId !== null && !isAdmin,
      timezone: viewer?.timezone ?? null,
    },
    players: players.map((player) => ({
      participantId: player.id,
      name: displayName(player.user),
      timezone: player.user.timezone,
      isSelf: player.user.id === userId,
    })),
    options: match.timeOptions.map((option) => ({
      id: option.id,
      proposedById: option.proposedById,
      proposedByName: displayName(players.find((player) => player.id === option.proposedById)?.user ?? { name: null, username: null, email: null }),
      startsAt: option.startsAt.toISOString(),
    })),
  };
}

async function authorize(context: RouteContext) {
  const { id: tournamentId, matchId } = await context.params;
  const auth = await requireUser(tournamentId);
  if (!auth.ok) return { error: authFailure(auth) };

  const match = await loadMatch(tournamentId, matchId);
  if (!match) {
    return { error: NextResponse.json({ error: "Match not found." }, { status: 404 }) };
  }

  const isPlayer = match.player1?.user.id === auth.userId || match.player2?.user.id === auth.userId;
  if (!auth.isAdmin && !isPlayer) {
    return {
      error: NextResponse.json({ error: "Only the match players and admins can use the schedule." }, { status: 403 }),
    };
  }

  return { match, tournamentId, matchId, userId: auth.userId, isAdmin: auth.isAdmin, isPlayer: isPlayer && !auth.isAdmin };
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function parseFutureDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const result = await authorize(context);
  if ("error" in result) return result.error;

  return NextResponse.json(
    await buildSnapshot(result.match, result.userId, result.isAdmin),
    { headers: NO_STORE },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const result = await authorize(context);
  if ("error" in result) return result.error;
  const { match, tournamentId, matchId, userId, isAdmin, isPlayer } = result;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const ownParticipantId =
    [match.player1, match.player2].find((player) => player?.user.id === userId)?.id ?? null;
  const respond = async (status = 200) => {
    const fresh = await loadMatch(tournamentId, matchId);
    if (!fresh) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    return NextResponse.json(await buildSnapshot(fresh, userId, isAdmin), { status, headers: NO_STORE });
  };

  switch (body.action) {
    case "timezone": {
      if (!isValidTimeZone(body.timezone)) {
        return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 });
      }
      await prisma.user.update({ where: { id: userId }, data: { timezone: body.timezone } });
      return respond();
    }

    case "add": {
      if (!isPlayer || !ownParticipantId) return forbidden("Only the match players can suggest times.");
      const startsAt = parseFutureDate(body.startsAt);
      if (!startsAt) return NextResponse.json({ error: "Enter a valid date and time." }, { status: 400 });
      if (startsAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Choose a time in the future." }, { status: 400 });
      }
      const duplicate = match.timeOptions.some(
        (option) => option.proposedById === ownParticipantId && option.startsAt.getTime() === startsAt.getTime(),
      );
      if (!duplicate) {
        await prisma.matchTimeOption.create({
          data: { matchId, proposedById: ownParticipantId, startsAt },
        });
      }
      return respond(duplicate ? 200 : 201);
    }

    case "remove": {
      if (!isPlayer || !ownParticipantId) return forbidden("Only the match players can remove times.");
      if (typeof body.optionId !== "string") {
        return NextResponse.json({ error: "Choose a time to remove." }, { status: 400 });
      }
      const option = match.timeOptions.find((item) => item.id === body.optionId);
      if (!option) return NextResponse.json({ error: "That time no longer exists." }, { status: 404 });
      if (option.proposedById !== ownParticipantId) return forbidden("You can only remove your own suggestions.");
      await prisma.matchTimeOption.deleteMany({ where: { id: option.id, matchId } });
      return respond();
    }

    case "pick": {
      if (!isPlayer || !ownParticipantId) return forbidden("Only the match players can pick a time.");
      if (typeof body.optionId !== "string") {
        return NextResponse.json({ error: "Choose a time to pick." }, { status: 400 });
      }
      const option = match.timeOptions.find((item) => item.id === body.optionId);
      if (!option) return NextResponse.json({ error: "That time no longer exists." }, { status: 404 });
      if (option.proposedById === ownParticipantId) {
        return forbidden("Pick a time your opponent suggested.");
      }
      if (option.startsAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "That time has already passed." }, { status: 400 });
      }
      await prisma.match.update({
        where: { id: matchId },
        data: { scheduledAt: option.startsAt, scheduledById: userId },
      });
      return respond();
    }

    case "set": {
      if (!isAdmin) return forbidden("Only admins can set the time directly.");
      const startsAt = parseFutureDate(body.startsAt);
      if (!startsAt) return NextResponse.json({ error: "Enter a valid date and time." }, { status: 400 });
      if (startsAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Choose a time in the future." }, { status: 400 });
      }
      await prisma.match.update({
        where: { id: matchId },
        data: { scheduledAt: startsAt, scheduledById: userId },
      });
      return respond();
    }

    case "cancel": {
      await prisma.$transaction([
        prisma.matchTimeOption.deleteMany({ where: { matchId } }),
        prisma.match.update({ where: { id: matchId }, data: { scheduledAt: null, scheduledById: null } }),
      ]);
      return respond();
    }

    default:
      return NextResponse.json({ error: "Unknown schedule action." }, { status: 400 });
  }
}
