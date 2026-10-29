import {
  ParticipantStatus,
  Prisma,
  TournamentFormat,
  TournamentStage,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_SETTINGS_ID } from "@/lib/site-settings";

const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SWISS_ROUNDS = 20;

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

function isValidImageUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
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
      case "updateSiteSettings": {
        const siteTitle = asString(body.siteTitle).trim();
        const heroHeadline = asString(body.heroHeadline).trim();
        const heroSubheading = asString(body.heroSubheading).trim();
        const heroBackgroundImage = asString(body.heroBackgroundImage).trim();
        const faviconUrl = asString(body.faviconUrl).trim();
        const siteLogoUrl = asString(body.siteLogoUrl).trim();
        const accentColor = asString(body.accentColor).trim();

        if (!siteTitle || siteTitle.length > 80) {
          return NextResponse.json({ error: "Platform title is required and must be 80 characters or fewer." }, { status: 400 });
        }
        if (!heroHeadline || heroHeadline.length > 160) {
          return NextResponse.json({ error: "Hero headline is required and must be 160 characters or fewer." }, { status: 400 });
        }
        if (!heroSubheading || heroSubheading.length > 300) {
          return NextResponse.json({ error: "Hero subheading is required and must be 300 characters or fewer." }, { status: 400 });
        }
        if (
          [heroBackgroundImage, faviconUrl, siteLogoUrl].some(
            (imageUrl) => imageUrl && !isValidImageUrl(imageUrl),
          )
        ) {
          return NextResponse.json(
            { error: "Branding image URLs must be valid HTTPS URLs no longer than 2,048 characters." },
            { status: 400 },
          );
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
          return NextResponse.json({ error: "Accent color must be a six-digit hex color." }, { status: 400 });
        }

        const settings = await prisma.siteSettings.upsert({
          where: { id: SITE_SETTINGS_ID },
          create: {
            id: SITE_SETTINGS_ID,
            siteTitle,
            heroHeadline,
            heroSubheading,
            heroBackgroundImage: heroBackgroundImage || null,
            faviconUrl: faviconUrl || null,
            siteLogoUrl: siteLogoUrl || null,
            accentColor,
          },
          update: {
            siteTitle,
            heroHeadline,
            heroSubheading,
            heroBackgroundImage: heroBackgroundImage || null,
            faviconUrl: faviconUrl || null,
            siteLogoUrl: siteLogoUrl || null,
            accentColor,
          },
        });

        return NextResponse.json({ success: true, settings });
      }

      case "createTournament": {
        const name = asString(body.name).trim();
        const description = asString(body.description);
        const imageUrl = asString(body.imageUrl).trim();
        const cardBackImage = asString(body.cardBackImage).trim();
        const formatValue =
          body.format === undefined ? "SINGLE_ELIMINATION" : asString(body.format);
        const format =
          formatValue === "SINGLE_ELIMINATION" || formatValue === "SWISS"
            ? formatValue
            : null;
        const rawMaxParticipants = body.maxParticipants;
        const maxParticipantsIsEmpty =
          rawMaxParticipants === undefined ||
          rawMaxParticipants === null ||
          (typeof rawMaxParticipants === "string" && rawMaxParticipants.trim() === "");
        const maxParticipants = maxParticipantsIsEmpty
          ? null
          : asStrictInt(rawMaxParticipants);
        const swissRounds =
          format === "SWISS" ? asStrictInt(body.swissRounds) ?? 0 : 4;
        const topCut =
          format === "SWISS"
            ? body.topCut === undefined
              ? 0
              : asStrictInt(body.topCut)
            : 0;

        if (!name) {
          return NextResponse.json({ error: "Tournament name is required." }, { status: 400 });
        }
        if (!format) {
          return NextResponse.json(
            { error: "Choose Single Elimination or Swiss Rounds." },
            { status: 400 },
          );
        }
        if (
          !maxParticipantsIsEmpty &&
          (maxParticipants === null ||
            maxParticipants === undefined ||
            maxParticipants < 2 ||
            maxParticipants > 2_147_483_647)
        ) {
          return NextResponse.json(
            { error: "Maximum participants must be a whole number of at least 2." },
            { status: 400 },
          );
        }
        if (
          format === "SWISS" &&
          (swissRounds < 1 || swissRounds > MAX_SWISS_ROUNDS)
        ) {
          return NextResponse.json(
            { error: `Swiss rounds must be a whole number from 1 to ${MAX_SWISS_ROUNDS}.` },
            { status: 400 },
          );
        }
        if (
          topCut === undefined ||
          (topCut !== 0 && topCut !== 4 && topCut !== 8)
        ) {
          return NextResponse.json(
            { error: "Choose no Top Cut, Top 4, or Top 8." },
            { status: 400 },
          );
        }
        if (
          topCut > 0 &&
          maxParticipants !== null &&
          maxParticipants !== undefined &&
          topCut > maxParticipants
        ) {
          return NextResponse.json(
            { error: `Top Cut cannot exceed the maximum of ${maxParticipants} participants.` },
            { status: 400 },
          );
        }
        if (description.length > MAX_DESCRIPTION_LENGTH) {
          return NextResponse.json({ error: "Tournament description cannot exceed 5,000 characters." }, { status: 400 });
        }
        if ((imageUrl && !isValidImageUrl(imageUrl)) || (cardBackImage && !isValidImageUrl(cardBackImage))) {
          return NextResponse.json({ error: "Tournament image URLs must be valid HTTPS URLs no longer than 2,048 characters." }, { status: 400 });
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
            description,
            format: format as TournamentFormat,
            topCut,
            currentStage:
              format === "SWISS"
                ? TournamentStage.SWISS
                : TournamentStage.SINGLE_ELIMINATION,
            maxParticipants,
            swissRounds,
            imageUrl: imageUrl || null,
            cardBackImage: cardBackImage || null,
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
          description?: string;
          active?: boolean;
          completed?: boolean;
          rostersLocked?: boolean;
          rostersPublic?: boolean;
          checkInOpen?: boolean;
          startingCoins?: number;
          maxCopiesPerPlayer?: number;
          maxCopiesLeague?: number | null;
          format?: TournamentFormat;
          topCut?: number;
          currentStage?: TournamentStage;
          maxParticipants?: number | null;
          swissRounds?: number;
          imageUrl?: string | null;
          cardBackImage?: string | null;
        } = {};

        if ("name" in body) {
          const name = asString(body.name).trim();
          if (!name) {
            return NextResponse.json({ error: "Tournament name cannot be empty." }, { status: 400 });
          }
          updateData.name = name;
        }

        if ("description" in body) {
          const description = asString(body.description);
          if (description.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json({ error: "Tournament description cannot exceed 5,000 characters." }, { status: 400 });
          }
          updateData.description = description;
        }

        if ("format" in body) {
          const formatValue = asString(body.format);
          if (formatValue !== "SINGLE_ELIMINATION" && formatValue !== "SWISS") {
            return NextResponse.json(
              { error: "Choose Single Elimination or Swiss Rounds." },
              { status: 400 },
            );
          }
          updateData.format = formatValue;
        }

        if ("maxParticipants" in body) {
          const rawMaxParticipants = body.maxParticipants;
          const isEmpty =
            rawMaxParticipants === null ||
            (typeof rawMaxParticipants === "string" &&
              rawMaxParticipants.trim() === "");
          const maxParticipants = isEmpty
            ? null
            : asStrictInt(rawMaxParticipants);
          if (
            !isEmpty &&
            (maxParticipants === null ||
              maxParticipants === undefined ||
              maxParticipants < 2 ||
              maxParticipants > 2_147_483_647)
          ) {
            return NextResponse.json(
              { error: "Maximum participants must be a whole number of at least 2." },
              { status: 400 },
            );
          }

          if (maxParticipants !== null && maxParticipants !== undefined) {
            const activeParticipants = await prisma.participant.count({
              where: {
                tournamentId: id,
                status: { in: [ParticipantStatus.PENDING, ParticipantStatus.APPROVED] },
              },
            });
            if (maxParticipants < activeParticipants) {
              return NextResponse.json(
                {
                  error: `Maximum participants cannot be lower than the ${activeParticipants} pending or approved participants.`,
                },
                { status: 400 },
              );
            }
          }
          updateData.maxParticipants = maxParticipants;
        }

        const updatedFormat = updateData.format ?? tournament.format;
        if (updatedFormat === TournamentFormat.SWISS && "swissRounds" in body) {
          const swissRounds = asStrictInt(body.swissRounds);
          if (
            swissRounds === undefined ||
            swissRounds < 1 ||
            swissRounds > MAX_SWISS_ROUNDS
          ) {
            return NextResponse.json(
              { error: `Swiss rounds must be a whole number from 1 to ${MAX_SWISS_ROUNDS}.` },
              { status: 400 },
            );
          }
          updateData.swissRounds = swissRounds;
        }

        const updatedTopCut =
          "topCut" in body
            ? asStrictInt(body.topCut)
            : tournament.topCut;
        if (
          updatedTopCut === undefined ||
          (updatedTopCut !== 0 && updatedTopCut !== 4 && updatedTopCut !== 8)
        ) {
          return NextResponse.json(
            { error: "Choose no Top Cut, Top 4, or Top 8." },
            { status: 400 },
          );
        }
        if (updatedFormat !== TournamentFormat.SWISS && updatedTopCut !== 0) {
          return NextResponse.json(
            { error: "Top Cut playoffs are only available for Swiss tournaments." },
            { status: 400 },
          );
        }

        const configuredTopCut =
          updatedFormat === TournamentFormat.SWISS ? updatedTopCut : 0;
        const configuredMaxParticipants =
          updateData.maxParticipants ?? tournament.maxParticipants;
        if (
          configuredTopCut > 0 &&
          configuredMaxParticipants !== null &&
          configuredTopCut > configuredMaxParticipants
        ) {
          return NextResponse.json(
            {
              error: `Top Cut cannot exceed the maximum of ${configuredMaxParticipants} participants.`,
            },
            { status: 400 },
          );
        }
        if (configuredTopCut > 0) updateData.topCut = configuredTopCut;
        else if (updatedFormat !== tournament.format || "topCut" in body) {
          updateData.topCut = 0;
        }

        const matchCount = await prisma.match.count({ where: { tournamentId: id } });
        if (
          matchCount > 0 &&
          (updatedFormat !== tournament.format ||
            configuredTopCut !== tournament.topCut ||
            (updateData.swissRounds !== undefined &&
              updateData.swissRounds !== tournament.swissRounds))
        ) {
          return NextResponse.json(
            { error: "Tournament format, Top Cut, and Swiss rounds cannot change after matches begin." },
            { status: 409 },
          );
        }

        if (configuredTopCut > 0) {
          const currentPlayers = await prisma.participant.count({
            where: {
              tournamentId: id,
              status: { in: [ParticipantStatus.PENDING, ParticipantStatus.APPROVED] },
            },
          });
          if (configuredTopCut > currentPlayers && currentPlayers > 0) {
            return NextResponse.json(
              { error: `Top Cut cannot exceed the ${currentPlayers} registered players.` },
              { status: 400 },
            );
          }
        }
        if (matchCount === 0 && updatedFormat !== tournament.format) {
          updateData.currentStage =
            updatedFormat === TournamentFormat.SWISS
              ? TournamentStage.SWISS
              : TournamentStage.SINGLE_ELIMINATION;
        }

        if ("imageUrl" in body) {
          const imageUrl = asString(body.imageUrl).trim();
          if (imageUrl && !isValidImageUrl(imageUrl)) {
            return NextResponse.json({ error: "Tournament banner URL must be a valid HTTPS URL no longer than 2,048 characters." }, { status: 400 });
          }
          updateData.imageUrl = imageUrl || null;
        }

        if ("cardBackImage" in body) {
          const cardBackImage = asString(body.cardBackImage).trim();
          if (cardBackImage && !isValidImageUrl(cardBackImage)) {
            return NextResponse.json({ error: "Card back image URL must be a valid HTTPS URL no longer than 2,048 characters." }, { status: 400 });
          }
          updateData.cardBackImage = cardBackImage || null;
        }

        if ("active" in body) {
          updateData.active = asBoolean(body.active, tournament.active);
        }

        if ("completed" in body) {
          updateData.completed = asBoolean(body.completed, tournament.completed);
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

        if (updateData.completed ?? tournament.completed) {
          updateData.active = false;
          updateData.checkInOpen = false;
          updateData.currentStage = TournamentStage.COMPLETED;
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

        const participantUpdate = await prisma.$transaction(
          async (transaction) => {
            if (
              updateData.status === ParticipantStatus.APPROVED &&
              participant.status !== ParticipantStatus.APPROVED
            ) {
              const tournament = await transaction.tournament.findUnique({
                where: { id: tournamentId },
                select: { maxParticipants: true },
              });
              if (!tournament) {
                return { kind: "not-found" as const };
              }
              if (tournament.maxParticipants !== null) {
                const activeParticipants = await transaction.participant.count({
                  where: {
                    tournamentId,
                    id: { not: participant.id },
                    status: {
                      in: [ParticipantStatus.PENDING, ParticipantStatus.APPROVED],
                    },
                  },
                });
                if (activeParticipants >= tournament.maxParticipants) {
                  return { kind: "full" as const };
                }
              }
            }

            const updatedParticipant = await transaction.participant.update({
              where: { id: participant.id },
              data: updateData,
            });
            return { kind: "updated" as const, participant: updatedParticipant };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        if (participantUpdate.kind === "not-found") {
          return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
        }
        if (participantUpdate.kind === "full") {
          return NextResponse.json(
            { error: "This tournament has reached its participant limit." },
            { status: 409 },
          );
        }
        const updatedParticipant = participantUpdate.participant;

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(updatedParticipant);
        }

        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}`, request.url));
      }

      case "createPack": {
        const name = asString(body.name).trim();
        const description = asString(body.description);
        const packImage = asString(body.packImage).trim();
        const pullCount = asStrictInt(body.pullCount) ?? -1;

        if (!name || name.length > 80 || pullCount < 1 || pullCount > 2_147_483_647) {
          return NextResponse.json(
            { error: "Enter a pack name of 1–80 characters and a positive whole-number pull count." },
            { status: 400 },
          );
        }
        if (description.length > MAX_DESCRIPTION_LENGTH) {
          return NextResponse.json({ error: "Pack description cannot exceed 5,000 characters." }, { status: 400 });
        }
        if (packImage && !isValidImageUrl(packImage)) {
          return NextResponse.json({ error: "Pack artwork URL must be a valid HTTPS URL no longer than 2,048 characters." }, { status: 400 });
        }

        const pack = await prisma.pack.create({
          data: {
            name,
            description,
            packImage: packImage || null,
            pullCount,
          },
        });

        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(pack, { status: 201 });
        }

        return NextResponse.redirect(new URL("/admin/packs", request.url), 303);
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
          description?: string;
          pullCount?: number;
          packImage?: string | null;
        } = {};

        if ("name" in body) {
          const name = asString(body.name).trim();
          if (!name || name.length > 80) {
            return NextResponse.json({ error: "Pack name must be between 1 and 80 characters." }, { status: 400 });
          }
          updateData.name = name;
        }

        if ("description" in body) {
          const description = asString(body.description);
          if (description.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json({ error: "Pack description cannot exceed 5,000 characters." }, { status: 400 });
          }
          updateData.description = description;
        }

        if ("packImage" in body) {
          const packImage = asString(body.packImage).trim();
          if (packImage && !isValidImageUrl(packImage)) {
            return NextResponse.json({ error: "Pack artwork URL must be a valid HTTPS URL no longer than 2,048 characters." }, { status: 400 });
          }
          updateData.packImage = packImage || null;
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

        const updatedPack = await prisma.pack.update({ where: { id }, data: updateData });
        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(updatedPack);
        }

        return NextResponse.redirect(new URL("/admin/packs", request.url), 303);
      }

      case "deletePack": {
        const id = asString(body.id);
        if (!id) {
          return NextResponse.json({ error: "Pack ID is required." }, { status: 400 });
        }

        const result = await prisma.pack.deleteMany({
          where: { id, purchases: { none: {} } },
        });
        if (result.count === 0) {
          const pack = await prisma.pack.findFirst({
            where: { id },
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

        return NextResponse.redirect(new URL("/admin/packs", request.url), 303);
      }

      case "attachTournamentPack": {
        const tournamentId = asString(body.tournamentId);
        const packId = asString(body.packId);
        if (!tournamentId || !packId) {
          return NextResponse.json({ error: "Tournament and pack IDs are required." }, { status: 400 });
        }
        const [tournament, pack] = await Promise.all([
          prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } }),
          prisma.pack.findUnique({ where: { id: packId }, select: { id: true } }),
        ]);
        if (!tournament || !pack) {
          return NextResponse.json({ error: "Tournament or global pack not found." }, { status: 404 });
        }
        const attachment = await prisma.tournamentPack.create({
          data: { tournamentId, packId },
        });
        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json(attachment, { status: 201 });
        }
        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}/packs`, request.url), 303);
      }

      case "updateTournamentPack": {
        const tournamentId = asString(body.tournamentId);
        const packId = asString(body.packId);
        const price = asStrictInt(body.price) ?? -1;
        const rawPurchaseLimit = body.purchaseLimit;
        const purchaseLimit =
          rawPurchaseLimit === undefined ||
          rawPurchaseLimit === null ||
          asString(rawPurchaseLimit).trim() === ""
            ? null
            : asStrictInt(rawPurchaseLimit) ?? -1;
        if (!tournamentId || !packId) {
          return NextResponse.json({ error: "Tournament and pack IDs are required." }, { status: 400 });
        }
        if (price < 0 || price > 2_147_483_647) {
          return NextResponse.json({ error: "Pack price must be a non-negative whole number." }, { status: 400 });
        }
        if (purchaseLimit !== null && (purchaseLimit < 1 || purchaseLimit > 2_147_483_647)) {
          return NextResponse.json(
            { error: "Purchase limit must be at least one or left blank for unlimited." },
            { status: 400 },
          );
        }
        const updateData = {
          price,
          purchaseLimit,
          ...("active" in body ? { active: asBoolean(body.active, false) } : {}),
        };
        const result = await prisma.tournamentPack.updateMany({
          where: { tournamentId, packId },
          data: updateData,
        });
        if (result.count === 0) {
          return NextResponse.json({ error: "This pack is not attached to the tournament." }, { status: 404 });
        }
        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json({ success: true });
        }
        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}/packs`, request.url), 303);
      }

      case "detachTournamentPack": {
        const tournamentId = asString(body.tournamentId);
        const packId = asString(body.packId);
        if (!tournamentId || !packId) {
          return NextResponse.json({ error: "Tournament and pack IDs are required." }, { status: 400 });
        }
        const result = await prisma.tournamentPack.deleteMany({
          where: { tournamentId, packId },
        });
        if (result.count === 0) {
          return NextResponse.json({ error: "This pack is not attached to the tournament." }, { status: 404 });
        }
        if (request.headers.get("content-type")?.includes("application/json")) {
          return NextResponse.json({ success: true });
        }
        return NextResponse.redirect(new URL(`/admin/t/${tournamentId}/packs`, request.url), 303);
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Tournament capacity changed while updating. Please try again." },
        { status: 409 },
      );
    }

    console.error("Admin route error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
