import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { guestApiBlock } from "@/lib/guest-access";
import { prisma } from "@/lib/prisma";
import { canAccessMatch } from "@/lib/match-room";

const MAX_MESSAGE_LENGTH = 1000;
const MESSAGE_LIMIT = 100;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to view match chat." }, { status: 401 });
  }

  const guestBlock = guestApiBlock(session, (await params).id);
  if (guestBlock) return guestBlock;

  const { id: tournamentId, matchId } = await params;
  const canAccess = await canAccessMatch({
    tournamentId,
    matchId,
    userId: session.user.id,
    isAdmin: session.user.role === "ADMIN",
  });
  if (!canAccess) {
    const exists = await prisma.match.findFirst({
      where: { id: matchId, tournamentId, tournament: { format: "DOUBLE_ELIMINATION" } },
      select: { id: true },
    });
    if (exists) return NextResponse.json({ error: "Only the match players and admins can access this chat." }, { status: 403 });
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const recentMessages = await prisma.matchMessage.findMany({
    where: { matchId },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: MESSAGE_LIMIT,
    select: {
      id: true,
      senderId: true,
      senderName: true,
      content: true,
      timestamp: true,
    },
  });

  return NextResponse.json(
    { messages: recentMessages.reverse() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to send match chat messages." }, { status: 401 });
  }

  const guestBlock = guestApiBlock(session, (await params).id);
  if (guestBlock) return guestBlock;

  const { id: tournamentId, matchId } = await params;
  const canAccess = await canAccessMatch({
    tournamentId,
    matchId,
    userId: session.user.id,
    isAdmin: session.user.role === "ADMIN",
  });
  if (!canAccess) {
    const exists = await prisma.match.findFirst({
      where: { id: matchId, tournamentId, tournament: { format: "DOUBLE_ELIMINATION" } },
      select: { id: true },
    });
    if (exists) return NextResponse.json({ error: "Only the match players and admins can access this chat." }, { status: 403 });
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const content =
    typeof body === "object" && body !== null && "content" in body
      ? body.content
      : undefined;
  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Enter a message before sending." }, { status: 400 });
  }
  if (content.trim().length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, username: true, email: true },
  });
  if (!sender) {
    return NextResponse.json({ error: "Your account could not be found." }, { status: 401 });
  }

  const message = await prisma.matchMessage.create({
    data: {
      matchId,
      senderId: session.user.id,
      senderName: sender.name ?? sender.username ?? sender.email ?? "Player",
      content: content.trim(),
    },
    select: {
      id: true,
      senderId: true,
      senderName: true,
      content: true,
      timestamp: true,
    },
  });

  return NextResponse.json(
    { message },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
