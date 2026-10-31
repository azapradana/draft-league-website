"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type GroupActionResult =
  | { success: true; message?: string; token?: string; groupId?: string }
  | { error: string };

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in to manage groups." };
  if (session.user.role !== "ADMIN") return { error: "Admin access is required." };
  return { userId: session.user.id };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// An uploaded logo takes precedence over a pasted link.
function parseLogoUrl(formData: FormData): string | null | { error: string } {
  const value = text(formData, "logoUpload") || text(formData, "logoUrl");
  if (!value) return null;
  if (value.length > 2048) return { error: "Logo URL is too long." };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    return { error: "Logo must be a valid http(s) URL." };
  }
  return value;
}

function parseName(formData: FormData): string | { error: string } {
  const name = text(formData, "name");
  if (name.length < 2 || name.length > 50) {
    return { error: "Group name must be 2-50 characters." };
  }
  return name;
}

function done(message: string, extra: { token?: string; groupId?: string } = {}): GroupActionResult {
  revalidatePath("/admin/groups");
  return { success: true, message, ...extra };
}

export async function createGroup(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const name = parseName(formData);
  if (typeof name !== "string") return name;
  const logoUrl = parseLogoUrl(formData);
  if (logoUrl !== null && typeof logoUrl !== "string") return logoUrl;

  try {
    await prisma.group.create({ data: { name, logoUrl, isCore: false } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A group with that name already exists." };
    }
    throw error;
  }
  return done("Group created.");
}

export async function updateGroup(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const groupId = text(formData, "groupId");
  if (!groupId) return { error: "Choose a group." };
  const name = parseName(formData);
  if (typeof name !== "string") return name;
  const logoUrl = parseLogoUrl(formData);
  if (logoUrl !== null && typeof logoUrl !== "string") return logoUrl;

  try {
    // Keep the existing logo when neither an upload nor a link was provided.
    await prisma.group.update({
      where: { id: groupId },
      data: { name, ...(logoUrl ? { logoUrl } : {}) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { error: "A group with that name already exists." };
      if (error.code === "P2025") return { error: "Group not found." };
    }
    throw error;
  }
  return done("Group saved.");
}

export async function deleteGroup(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const groupId = text(formData, "groupId");
  if (!groupId) return { error: "Choose a group." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({ where: { id: groupId } });
      if (!group) return { error: "Group not found." };
      if (group.isCore) return { error: "The core group cannot be deleted." };

      await tx.user.updateMany({ where: { groupId }, data: { groupId: null } });
      await tx.group.delete({ where: { id: groupId } });
      return null;
    });
    if (result) return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      return { error: "This group has friendly match history and cannot be deleted." };
    }
    throw error;
  }
  return done("Group deleted. Members were unassigned.");
}

export async function assignUserToGroup(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const userId = text(formData, "userId");
  const groupId = text(formData, "groupId");
  if (!userId) return { error: "Choose a user." };

  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!group) return { error: "Group not found." };
  }
  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: { groupId: groupId || null },
  });
  if (result.count === 0) return { error: "User not found." };
  return done("Group assignment updated.");
}

export async function updateFriendlyMatchCount(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const userId = text(formData, "userId");
  const countRaw = text(formData, "friendlyMatchCount");
  if (!userId) return { error: "Choose a user." };
  if (!/^\d+$/.test(countRaw)) return { error: "Enter a whole number of 0 or greater." };

  const friendlyMatchCount = Number(countRaw);
  if (!Number.isSafeInteger(friendlyMatchCount) || friendlyMatchCount > 2_147_483_647) {
    return { error: "Count must be a whole number no greater than 2147483647." };
  }

  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: { friendlyMatchCount },
  });
  if (result.count === 0) return { error: "User not found." };
  return done("Friendly match count updated.");
}

export async function addUserToGroupByUsername(
  formData: FormData,
): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const username = text(formData, "username");
  const groupId = text(formData, "groupId");
  if (!username) return { error: "Enter a username." };
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return { error: "Group not found." };
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return { error: "No user with that username." };
  await prisma.user.update({ where: { id: user.id }, data: { groupId } });
  return done("Member added.");
}

export async function generateInvitation(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const groupId = text(formData, "groupId");
  const maxUsesRaw = text(formData, "maxUses");
  const expiresDaysRaw = text(formData, "expiresInDays");

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found." };
  if (group.isCore) return { error: "Invitation links are only for rival groups." };

  let maxUses: number | null = null;
  if (maxUsesRaw) {
    maxUses = Number(maxUsesRaw);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
      return { error: "Max uses must be a whole number from 1 to 1000." };
    }
  }
  let expiresAt: Date | null = null;
  if (expiresDaysRaw) {
    const days = Number(expiresDaysRaw);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return { error: "Expiry must be a whole number of days from 1 to 365." };
    }
    expiresAt = new Date(Date.now() + days * 86_400_000);
  }

  const token = randomBytes(24).toString("base64url");
  await prisma.groupInvitation.create({
    data: { token, groupId, maxUses, expiresAt, createdById: auth.userId },
  });
  return done("Invitation link generated.", { token, groupId });
}

export async function revokeInvitation(formData: FormData): Promise<GroupActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const invitationId = text(formData, "invitationId");
  const result = await prisma.groupInvitation.updateMany({
    where: { id: invitationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return { error: "Invitation not found or already revoked." };
  return done("Invitation revoked.");
}
