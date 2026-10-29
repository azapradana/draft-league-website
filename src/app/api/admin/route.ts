import { ParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined) return fallback;
  return fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const raw = asString(value, "");
  if (raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStrictInt(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : undefined;
  }
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off", ""].includes(normalized)) return false;
  }
  return fallback;
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const parsed = await request.json().catch(() => ({}));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  }

  const formData = await request.formData();
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    result[key] = value;
  }

  return result;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false as const, status: 401, error: "Sign in to continue." };
  }

  if (session.user.role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Admin access is required." };
  }

  return { ok: true as const, session };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = await readBody(request);
  const action = asString(body.action);

  if (!action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    switch (action) {
      case "createTournament": {
        const name = asString(body.name).trim();
        if (!name) {
          return NextResponse.json({ error: "Tournament name is required." }, { status: 400 });
        }

        const startingCoins = asInt(body.startingCoins, 0);
        const maxCopiesPerPlayer = asInt(body.maxCopiesPerPlayer, 3);
        const rawLeagueCopyLimit = body.maxCopiesLeague;
        const maxCopiesLeague =
          rawLeagueCopyLimit === undefined || rawLeagueCopyLimit === null || asString(rawLeagueCopyLimit) === ""
            ? null
            : asInt(rawLeagueCopyLimit, 0);

        const tournament = await prisma.tournament.create({
          data: {
            name,
            regulation: "m-c",
            startingCoins,
            maxCopiesPerPlayer,
            maxCopiesLeague,
            active: false,
            rostersLocked: false,
          },
        });

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(tournament, { status: 201 });
        }

        return NextResponse.redirect(new URL(`/admin/t/${tournament.id}`, request.url));
      }

      case "updateTournament": {
        const id = asString(body.id);
        if (!id) {
          return NextResponse.json({ error: "Tournament ID is required." }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({ where: { id } });
        if (!tournament) {
          return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
        }

        const updateData: {
          name?: string;
          active?: boolean;
          rostersLocked?: boolean;
          rostersPublic?: boolean;
          checkInOpen?: boolean;
          startingCoins?: number;
          maxCopiesPerPlayer?: number;
          maxCopiesLeague?: number | null;
        } = {};

        if ("name" in body) {
          const name = asString(body.name).trim();
          if (!name) {
            return NextResponse.json({ error: "Tournament name cannot be empty." }, { status: 400 });
          }
          updateData.name = name;
        }

        if ("active" in body) {
          updateData.active = asBoolean(body.active, tournament.active);
        }

        if ("rostersLocked" in body) {
          updateData.rostersLocked = asBoolean(body.rostersLocked, tournament.rostersLocked);
        }

        if ("rostersPublic" in body) {
          updateData.rostersPublic = asBoolean(body.rostersPublic, tournament.rostersPublic);
        }

        if ("checkInOpen" in body) {
          updateData.checkInOpen = asBoolean(body.checkInOpen, tournament.checkInOpen);
        }

        if ("startingCoins" in body) {
          updateData.startingCoins = asInt(body.startingCoins, tournament.startingCoins);
        }

        if ("maxCopiesPerPlayer" in body) {
          updateData.maxCopiesPerPlayer = asInt(body.maxCopiesPerPlayer, tournament.maxCopiesPerPlayer);
        }

        if ("maxCopiesLeague" in body) {
          const rawLeagueCopyLimit = body.maxCopiesLeague;
          updateData.maxCopiesLeague =
            rawLeagueCopyLimit === undefined || rawLeagueCopyLimit === null || asString(rawLeagueCopyLimit) === ""
              ? null
              : asInt(rawLeagueCopyLimit, tournament.maxCopiesLeague ?? 0);
        }

        const updatedTournament = await prisma.tournament.update({
          where: { id },
          data: updateData,
        });

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(updatedTournament);
        }

        return NextResponse.redirect(new URL(`/admin/t/${id}`, request.url));
      }

      case "setParticipant": {
        const tournamentId = asString(body.tournamentId);
        if (!tournamentId) {
          return NextResponse.json({ error: "Tournament ID is required." }, { status: 400 });
        }

        const participantId = asString(body.participantId);
        const userId = asString(body.userId);

        if (!participantId && !userId) {
          return NextResponse.json({ error: "Participant ID or user ID is required." }, { status: 400 });
        }

        const participant = participantId
          ? await prisma.participant.findUnique({
              where: { id: participantId },
              include: { user: true },
            })
          : await prisma.participant.findUnique({
              where: {
                userId_tournamentId: {
                  userId,
                  tournamentId,
                },
              },
              include: { user: true },
            });

        if (!participant) {
          return NextResponse.json({ error: "Participant not found." }, { status: 404 });
        }

        const updateData: { status?: ParticipantStatus; coins?: number } = {};

        if ("status" in body) {
          const statusValue = asString(body.status);
          if (statusValue !== "PENDING" && statusValue !== "APPROVED" && statusValue !== "REJECTED") {
            return NextResponse.json({ error: "Status must be PENDING, APPROVED, or REJECTED." }, { status: 400 });
          }
          updateData.status = statusValue as ParticipantStatus;
        }

        if ("coins" in body) {
          updateData.coins = asInt(body.coins, participant.coins);
        }

        const updatedParticipant = await prisma.participant.update({
          where: { id: participant.id },
          data: updateData,
        });

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(updatedParticipant);
        }

        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}`, request.url));
      }

      case "createPack": {
        const tournamentId = asString(body.tournamentId);
        const name = asString(body.name).trim();
        const price = asStrictInt(body.price) ?? -1;
        const pullCount = asStrictInt(body.pullCount) ?? -1;
        const rawPurchaseLimit = body.purchaseLimit;
        const purchaseLimit =
          rawPurchaseLimit === undefined ||
          rawPurchaseLimit === null ||
          asString(rawPurchaseLimit).trim() === ""
            ? null
            : asStrictInt(rawPurchaseLimit) ?? -1;

        if (!tournamentId || !name || name.length > 80 || price < 0 || price > 2_147_483_647 || pullCount < 1 || pullCount > 2_147_483_647) {
          return NextResponse.json(
            { error: "Choose a tournament, enter a pack name of 1–80 characters, a non-negative whole-number price, and at least one pull." },
            { status: 400 },
          );
        }

        if (purchaseLimit !== null && (purchaseLimit < 1 || purchaseLimit > 2_147_483_647)) {
          return NextResponse.json(
            { error: "Purchase limit must be at least one or left blank for unlimited." },
            { status: 400 },
          );
        }

        const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!tournament) {
          return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
        }

        const pack = await prisma.pack.create({
          data: {
            tournamentId,
            name,
            price,
            pullCount,
            purchaseLimit,
            active: asBoolean(body.active, false),
          },
        });

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(pack, { status: 201 });
        }

        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}`, request.url), 303);
      }

      case "updatePack": {
        const id = asString(body.id);
        if (!id) {
          return NextResponse.json({ error: "Pack ID is required." }, { status: 400 });
        }

        const pack = await prisma.pack.findUnique({ where: { id } });
        if (!pack) {
          return NextResponse.json({ error: "Pack not found." }, { status: 404 });
        }

        const updateData: {
          name?: string;
          price?: number;
          pullCount?: number;
          purchaseLimit?: number | null;
          active?: boolean;
        } = {};

        if ("name" in body) {
          const name = asString(body.name).trim();
          if (!name || name.length > 80) {
            return NextResponse.json({ error: "Pack name must be between 1 and 80 characters." }, { status: 400 });
          }
          updateData.name = name;
        }

        if ("price" in body) {
          const price = asStrictInt(body.price) ?? -1;
          if (price < 0 || price > 2_147_483_647) {
            return NextResponse.json({ error: "Pack price must be a non-negative whole number." }, { status: 400 });
          }
          updateData.price = price;
        }

        if ("pullCount" in body) {
          const pullCount = asStrictInt(body.pullCount) ?? -1;
          if (pullCount < 1 || pullCount > 2_147_483_647) {
            return NextResponse.json({ error: "Pull count must be at least one." }, { status: 400 });
          }
          updateData.pullCount = pullCount;
        }

        const effectivePullCount = updateData.pullCount ?? pack.pullCount;
        const guaranteedTierCount = await prisma.packTier.count({
          where: { packId: id, minimumOne: true },
        });
        if (guaranteedTierCount > effectivePullCount) {
          return NextResponse.json(
            { error: "Pull count cannot be lower than the number of tiers guaranteed at least one Pokémon." },
            { status: 400 },
          );
        }

        if ("purchaseLimit" in body) {
          const rawPurchaseLimit = body.purchaseLimit;
          const purchaseLimit =
            rawPurchaseLimit === undefined ||
            rawPurchaseLimit === null ||
            asString(rawPurchaseLimit).trim() === ""
              ? null
              : asStrictInt(rawPurchaseLimit) ?? -1;
          if (purchaseLimit !== null && (purchaseLimit < 1 || purchaseLimit > 2_147_483_647)) {
            return NextResponse.json(
              { error: "Purchase limit must be at least one or left blank for unlimited." },
              { status: 400 },
            );
          }
          updateData.purchaseLimit = purchaseLimit;
        }

        if ("active" in body) {
          updateData.active = asBoolean(body.active, false);
        }

        const updatedPack = await prisma.pack.update({ where: { id }, data: updateData });
        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(updatedPack);
        }

        return NextResponse.redirect(new URL(`/admin/t/${pack.tournamentId}`, request.url), 303);
      }

      case "deletePack": {
        const id = asString(body.id);
        const tournamentId = asString(body.tournamentId);
        if (!id || !tournamentId) {
          return NextResponse.json({ error: "Pack and tournament IDs are required." }, { status: 400 });
        }

        const result = await prisma.pack.deleteMany({
          where: { id, tournamentId, purchases: { none: {} } },
        });
        if (result.count === 0) {
          const pack = await prisma.pack.findFirst({
            where: { id, tournamentId },
            include: { _count: { select: { purchases: true } } },
          });
          if (!pack) {
            return NextResponse.json({ error: "Pack not found." }, { status: 404 });
          }
          return NextResponse.json(
            { error: "A pack cannot be deleted after it has been purchased." },
            { status: 409 },
          );
        }

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json({ success: true });
        }

        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}`, request.url), 303);
      }

      case "saveTiers": {
        const packId = asString(body.packId);
        const tiers = body.tiers;
        if (!packId || !Array.isArray(tiers)) {
          return NextResponse.json({ error: "Pack ID and a tiers array are required." }, { status: 400 });
        }

        const normalizedTiers: Array<{
          id?: string;
          name: string;
          weight: string;
          color: string;
          minimumOne: boolean;
        }> = [];
        for (const tier of tiers) {
          if (typeof tier !== "object" || tier === null) {
            return NextResponse.json({ error: "Each tier must be an object." }, { status: 400 });
          }
          const value = tier as Record<string, unknown>;
          const name = asString(value.name).trim();
          const rawWeight = asString(value.weight).trim();
          const weight = Number(rawWeight);
          const color = asString(value.color).trim();
          const minimumOne =
            value.minimumOne === undefined
              ? false
              : typeof value.minimumOne === "boolean"
                ? value.minimumOne
                : null;
          if (
            !name ||
            name.length > 40 ||
            !/^(?:\d+|\d*\.\d{1,4})$/.test(rawWeight) ||
            !Number.isFinite(weight) ||
            weight < 0 ||
            weight > 999_999.9999 ||
            !/^#[0-9a-fA-F]{6}$/.test(color) ||
            minimumOne === null
          ) {
            return NextResponse.json(
              { error: "Each tier needs a name, a non-negative weight with at most four decimals, and a #RRGGBB color." },
              { status: 400 },
            );
          }
          normalizedTiers.push({
            ...(typeof value.id === "string" && value.id ? { id: value.id } : {}),
            name,
            weight: weight.toFixed(4),
            color,
            minimumOne,
          });
        }

        if (normalizedTiers.length > 0 && !normalizedTiers.some((tier) => Number(tier.weight) > 0)) {
          return NextResponse.json({ error: "At least one tier must have a weight greater than zero." }, { status: 400 });
        }

        if (new Set(normalizedTiers.map((tier) => tier.id).filter(Boolean)).size !==
          normalizedTiers.filter((tier) => tier.id).length) {
          return NextResponse.json({ error: "A tier was included more than once." }, { status: 400 });
        }

        const updatedTiers = await prisma.$transaction(async (tx) => {
          const pack = await tx.pack.findUnique({ where: { id: packId } });
          if (!pack) {
            return { error: "Pack not found.", status: 404 as const };
          }

          const guaranteedTierCount = normalizedTiers.filter((tier) => tier.minimumOne).length;
          if (guaranteedTierCount > pack.pullCount) {
            return {
              error: `This pack has ${pack.pullCount} pull(s), so no more than ${pack.pullCount} tiers can be guaranteed.`,
              status: 400 as const,
            };
          }

          const existingTiers = await tx.packTier.findMany({
            where: { packId },
            include: { _count: { select: { entries: true } } },
          });
          const submittedIds = new Set(normalizedTiers.flatMap((tier) => tier.id ? [tier.id] : []));
          const removedTiers = existingTiers.filter((tier) => !submittedIds.has(tier.id));
          if (removedTiers.some((tier) => tier._count.entries > 0)) {
            return { error: "A tier containing Pokémon cannot be deleted. Move its Pokémon to another tier first.", status: 409 as const };
          }

          if (normalizedTiers.some((tier) => tier.id && !existingTiers.some((existing) => existing.id === tier.id))) {
            return { error: "One or more tiers do not belong to this pack.", status: 400 as const };
          }

          for (const tier of normalizedTiers) {
            const data = {
              name: tier.name,
              weight: tier.weight,
              color: tier.color,
              minimumOne: tier.minimumOne,
            };
            if (tier.id) {
              await tx.packTier.update({ where: { id: tier.id }, data });
            } else {
              await tx.packTier.create({ data: { ...data, packId } });
            }
          }

          if (removedTiers.length > 0) {
            await tx.packTier.deleteMany({ where: { id: { in: removedTiers.map((tier) => tier.id) } } });
          }

          return {
            tiers: await tx.packTier.findMany({ where: { packId }, orderBy: { id: "asc" } }),
          };
        });

        if ("error" in updatedTiers) {
          return NextResponse.json({ error: updatedTiers.error }, { status: updatedTiers.status });
        }
        return NextResponse.json(updatedTiers);
      }

      case "savePool": {
        const packId = asString(body.packId);
        const entries = body.entries;
        if (!packId || !Array.isArray(entries)) {
          return NextResponse.json({ error: "Pack ID and an entries array are required." }, { status: 400 });
        }

        const normalizedEntries: Array<{ speciesDex: number; tierId: string }> = [];
        for (const entry of entries) {
          if (typeof entry !== "object" || entry === null) {
            return NextResponse.json({ error: "Each pool entry must be an object." }, { status: 400 });
          }
          const value = entry as Record<string, unknown>;
          const speciesDex = Number(value.speciesDex);
          const tierId = asString(value.tierId);
          if (!Number.isInteger(speciesDex) || speciesDex < 1 || !tierId) {
            return NextResponse.json({ error: "Each pool entry needs a valid species and tier." }, { status: 400 });
          }
          normalizedEntries.push({ speciesDex, tierId });
        }

        if (new Set(normalizedEntries.map((entry) => entry.speciesDex)).size !== normalizedEntries.length) {
          return NextResponse.json({ error: "A species can only be included once in a pack pool." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
          const pack = await tx.pack.findUnique({ where: { id: packId } });
          if (!pack) {
            return { error: "Pack not found.", status: 404 as const };
          }
          const tierIds = [...new Set(normalizedEntries.map((entry) => entry.tierId))];
          const [species, tiers] = await Promise.all([
            tx.species.findMany({
              where: { dex: { in: normalizedEntries.map((entry) => entry.speciesDex) } },
              select: { dex: true },
            }),
            tx.packTier.findMany({ where: { id: { in: tierIds }, packId }, select: { id: true } }),
          ]);
          if (species.length !== new Set(normalizedEntries.map((entry) => entry.speciesDex)).size) {
            return { error: "One or more selected Pokémon do not exist.", status: 400 as const };
          }
          if (tiers.length !== tierIds.length) {
            return { error: "Every selected Pokémon must use a tier belonging to this pack.", status: 400 as const };
          }

          await tx.packEntry.deleteMany({ where: { packId } });
          if (normalizedEntries.length > 0) {
            await tx.packEntry.createMany({
              data: normalizedEntries.map((entry) => ({ packId, ...entry })),
            });
          }
          return { success: true };
        });

        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json(result);
      }

      default: {
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
      }
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "This record already exists." }, { status: 409 });
    }

    console.error("Admin route error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
