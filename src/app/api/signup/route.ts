import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send valid JSON to create an account." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Send a username and password." }, { status: 400 });
  }

  const { username, password, inviteToken: rawInviteToken } = body as {
    username?: unknown;
    password?: unknown;
    inviteToken?: unknown;
  };
  const inviteToken =
    typeof rawInviteToken === "string" ? rawInviteToken : undefined;

  if (typeof username !== "string" || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters: lowercase letters, numbers, or underscores." },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const settings = await getSiteSettings();
    const invitation = inviteToken
      ? await prisma.tournament.findUnique({
          where: { friendlyMatchInviteToken: inviteToken },
          select: {
            id: true,
            friendlyMatchGroupId: true,
            format: true,
            startingCoins: true,
          },
        })
      : null;
    if (inviteToken && (!invitation || invitation.format !== "FRIENDLY_MATCH" || !invitation.friendlyMatchGroupId)) {
      return NextResponse.json(
        { error: "This Friendly Match invitation is invalid or expired." },
        { status: 400 },
      );
    }

    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          username,
          name: username,
          passwordHash,
          coinsBalance: settings.initialPlayerCoins,
          ...(invitation?.friendlyMatchGroupId
            ? { groupId: invitation.friendlyMatchGroupId }
            : {}),
        },
        select: { id: true },
      });
      if (invitation) {
        await transaction.participant.create({
          data: {
            userId: createdUser.id,
            tournamentId: invitation.id,
            friendlyMatchGroupId: invitation.friendlyMatchGroupId,
            status: "APPROVED",
            checkedIn: true,
            coins: invitation.startingCoins,
          },
        });
      }
      return createdUser;
    });

    return NextResponse.json(
      { id: user.id, ...(invitation ? { tournamentId: invitation.id } : {}) },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That username is already taken. Please choose another." },
        { status: 409 },
      );
    }

    throw error;
  }
}
