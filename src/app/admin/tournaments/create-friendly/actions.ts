"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCoreGroup } from "@/lib/groups";

export type CreateFriendlyMatchResult =
  | {
      success: true;
      tournamentId: string;
      groupId: string;
      rivalGroupName: string;
      invitePath: string;
    }
  | { error: string };

const MIN_SQUAD_SIZE = 1;
const MAX_SQUAD_SIZE = 50;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function createFriendlyMatch(
  formData: FormData,
): Promise<CreateFriendlyMatchResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in to create a friendly match." };
  if (session.user.role !== "ADMIN") return { error: "Admin access is required." };
  const adminId = session.user.id;

  const name = text(formData, "name");
  const description = text(formData, "description");
  const rivalName = text(formData, "rivalName");
  // An uploaded logo takes precedence over a pasted link.
  const rivalLogo = text(formData, "rivalLogoUpload") || text(formData, "rivalLogoUrl");
  const squadRaw = text(formData, "squadSize");

  if (name.length < 2 || name.length > 100) {
    return { error: "Tournament name must be 2-100 characters." };
  }
  if (description.length > 5000) {
    return { error: "Description cannot exceed 5,000 characters." };
  }
  if (rivalName.length < 2 || rivalName.length > 50) {
    return { error: "Rival group name must be 2-50 characters." };
  }
  if (rivalLogo && (rivalLogo.length > 2048 || !isHttpUrl(rivalLogo))) {
    return { error: "Rival logo must be a valid http(s) URL or an uploaded image." };
  }
  if (!/^\d+$/.test(squadRaw)) return { error: "Squad size must be a whole number." };
  const squadSize = Number(squadRaw);
  if (squadSize < MIN_SQUAD_SIZE || squadSize > MAX_SQUAD_SIZE) {
    return { error: `Squad size must be between ${MIN_SQUAD_SIZE} and ${MAX_SQUAD_SIZE}.` };
  }

  const core = await ensureCoreGroup();
  if (rivalName.toLowerCase() === core.name.toLowerCase()) {
    return { error: `The rival group cannot be named ${core.name}.` };
  }

  const token = randomBytes(24).toString("base64url");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rival = await tx.group.create({
        data: { name: rivalName, logoUrl: rivalLogo || null, isCore: false },
      });
      const tournament = await tx.tournament.create({
        data: {
          name,
          description,
          mode: "REGULAR",
          format: "SINGLE_ELIMINATION",
          autoApproveSignups: true,
          friendlyWar: {
            create: {
              squadSize,
              status: "OPEN",
              groups: { create: [{ groupId: core.id }, { groupId: rival.id }] },
            },
          },
        },
      });
      await tx.groupInvitation.create({
        data: { token, groupId: rival.id, createdById: adminId },
      });
      return { tournamentId: tournament.id, groupId: rival.id };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/groups");
    return {
      success: true,
      tournamentId: result.tournamentId,
      groupId: result.groupId,
      rivalGroupName: rivalName,
      invitePath: `/register/rival/${result.groupId}?invite=${token}`,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A group with that name already exists." };
    }
    throw error;
  }
}
