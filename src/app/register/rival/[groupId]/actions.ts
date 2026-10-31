"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRivalInvitation, consumeInvitation } from "@/lib/friendly-war";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export type RivalActionResult = { success: true } | { error: string };

const INVITE_RACE_ERROR = "This invitation just reached its limit.";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Creates a brand-new account directly inside the rival group.
export async function registerRivalUser(formData: FormData): Promise<RivalActionResult> {
  const groupId = field(formData, "groupId");
  const check = await checkRivalInvitation(groupId, field(formData, "invite"));
  if (!check.ok) return { error: check.reason };

  const username = field(formData, "username").trim();
  const password = field(formData, "password");
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3-20 characters: lowercase letters, numbers, or underscores." };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const passwordHash = await bcrypt.hash(password, 12);
  const settings = await getSiteSettings();

  try {
    await prisma.$transaction(async (tx) => {
      if (!(await consumeInvitation(tx, check.invitation.id))) throw new Error(INVITE_RACE_ERROR);
      await tx.user.create({
        data: {
          username,
          name: username,
          passwordHash,
          coinsBalance: settings.initialPlayerCoins,
          groupId: check.invitation.groupId,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That username is already taken. Please choose another." };
    }
    if (error instanceof Error && error.message === INVITE_RACE_ERROR) {
      return { error: INVITE_RACE_ERROR };
    }
    throw error;
  }
  return { success: true };
}

// Lets an already signed-in user without a faction (a guest) join the rival group.
export async function claimRivalInvitation(formData: FormData): Promise<RivalActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in to accept this invitation." };

  const groupId = field(formData, "groupId");
  const check = await checkRivalInvitation(groupId, field(formData, "invite"));
  if (!check.ok) return { error: check.reason };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { groupId: true },
  });
  if (!user) return { error: "Account not found." };
  if (user.groupId === groupId) return { success: true };
  if (user.groupId) {
    return { error: "Your account already belongs to a group. Ask an admin to move you." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (!(await consumeInvitation(tx, check.invitation.id))) throw new Error(INVITE_RACE_ERROR);
      // Re-check inside the transaction so concurrent claims cannot overwrite a group.
      const updated = await tx.user.updateMany({
        where: { id: session.user.id, groupId: null },
        data: { groupId },
      });
      if (updated.count !== 1) throw new Error("Your account already belongs to a group.");
    });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  return { success: true };
}
