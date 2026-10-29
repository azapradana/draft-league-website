import { randomInt } from "node:crypto";
import { ParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

class GachaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function chooseUniformly<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

function chooseWeighted<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  const roll = randomInt(totalWeight);
  let cumulativeWeight = 0;

  for (const item of items) {
    cumulativeWeight += item.weight;
    if (roll < cumulativeWeight) return item;
  }

  throw new Error("Unable to select a weighted pack tier.");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("Pack opening authentication error:", error);
    return NextResponse.json(
      { error: "The pack could not be opened due to a server error. Please try again." },
      { status: 500 },
    );
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to open a pack." }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const packId =
    typeof body === "object" && body !== null && "packId" in body &&
    typeof body.packId === "string"
      ? body.packId
      : "";
  if (!packId) {
    return NextResponse.json({ error: "Choose a pack to open." }, { status: 400 });
  }

  const { id: tournamentId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lockedTournament = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE
      `;
      if (lockedTournament.length === 0) {
        throw new GachaError("Tournament not found.", 404);
      }

      const tournament = await tx.tournament.findUniqueOrThrow({
        where: { id: tournamentId },
        select: { active: true, maxCopiesPerPlayer: true, maxCopiesLeague: true },
      });
      if (!tournament.active) {
        throw new GachaError("This tournament is not active, so its shop is closed.", 409);
      }

      const participant = await tx.participant.findUnique({
        where: {
          userId_tournamentId: {
            userId,
            tournamentId,
          },
        },
        select: { id: true, status: true, coins: true },
      });
      if (!participant || participant.status !== ParticipantStatus.APPROVED) {
        throw new GachaError(
          "You need an approved tournament place before you can open packs.",
          403,
        );
      }

      const pack = await tx.pack.findFirst({
        where: { id: packId, tournamentId, active: true },
        include: {
          tiers: {
            include: {
              entries: {
                include: { species: { select: { dex: true, name: true, isMega: true, imageUrl: true } } },
              },
            },
          },
        },
      });
      if (!pack) {
        throw new GachaError("That pack is not on sale in this tournament.", 404);
      }
      if (participant.coins < pack.price) {
        throw new GachaError("You do not have enough coins to buy this pack.", 409);
      }

      if (pack.purchaseLimit !== null) {
        const purchaseCount = await tx.purchase.count({
          where: { participantId: participant.id, packId: pack.id },
        });
        if (purchaseCount >= pack.purchaseLimit) {
          throw new GachaError("You have reached this pack’s purchase limit.", 409);
        }
      }

      const speciesDexes = pack.tiers.flatMap((tier) =>
        tier.entries.map((entry) => entry.speciesDex),
      );
      const uniqueSpeciesDexes = [...new Set(speciesDexes)];
      const [playerCopies, leagueCopies] = await Promise.all([
        tx.ownedPokemon.groupBy({
          by: ["speciesDex"],
          where: {
            participantId: participant.id,
            speciesDex: { in: uniqueSpeciesDexes },
          },
          _count: { _all: true },
        }),
        tx.ownedPokemon.groupBy({
          by: ["speciesDex"],
          where: {
            speciesDex: { in: uniqueSpeciesDexes },
            participant: { is: { tournamentId } },
          },
          _count: { _all: true },
        }),
      ]);
      const playerCounts = new Map(
        playerCopies.map((copy) => [copy.speciesDex, copy._count._all]),
      );
      const leagueCounts = new Map(
        leagueCopies.map((copy) => [copy.speciesDex, copy._count._all]),
      );

      const isEligible = (speciesDex: number) =>
        (playerCounts.get(speciesDex) ?? 0) < tournament.maxCopiesPerPlayer &&
        (tournament.maxCopiesLeague === null ||
          (leagueCounts.get(speciesDex) ?? 0) < tournament.maxCopiesLeague);
      const pulls: Array<{
        species: { dex: number; name: string; isMega: boolean; imageUrl: string | null };
        tier: { name: string; color: string };
      }> = [];
      const addPull = (tier: (typeof pack.tiers)[number], entry: (typeof tier.entries)[number]) => {
        pulls.push({ species: entry.species, tier: { name: tier.name, color: tier.color } });
        playerCounts.set(entry.speciesDex, (playerCounts.get(entry.speciesDex) ?? 0) + 1);
        leagueCounts.set(entry.speciesDex, (leagueCounts.get(entry.speciesDex) ?? 0) + 1);
      };

      const guaranteedTiers = pack.tiers.filter((tier) => tier.minimumOne);
      if (guaranteedTiers.length > pack.pullCount) {
        throw new GachaError("This pack’s guarantees exceed its pull count. Contact an admin.", 409);
      }
      for (const tier of guaranteedTiers) {
        const eligibleEntries = tier.entries.filter((entry) => isEligible(entry.speciesDex));
        if (eligibleEntries.length === 0) {
          throw new GachaError(
            `No eligible Pokémon remain in the guaranteed ${tier.name} tier. No coins were spent.`,
            409,
          );
        }
        addPull(tier, chooseUniformly(eligibleEntries));
      }

      while (pulls.length < pack.pullCount) {
        const eligibleTiers = pack.tiers
          .map((tier) => ({
            tier,
            entries: tier.entries.filter((entry) => isEligible(entry.speciesDex)),
            weight: Math.round(Number(tier.weight) * 10_000),
          }))
          .filter((tier) => tier.entries.length > 0 && tier.weight > 0);
        if (eligibleTiers.length === 0) {
          throw new GachaError(
            "No eligible Pokémon remain in any weighted tier. No coins were spent.",
            409,
          );
        }
        const selectedTier = chooseWeighted(eligibleTiers);
        addPull(selectedTier.tier, chooseUniformly(selectedTier.entries));
      }

      const purchase = await tx.purchase.create({
        data: {
          participantId: participant.id,
          packId: pack.id,
          cost: pack.price,
        },
        select: { id: true },
      });
      await tx.ownedPokemon.createMany({
        data: pulls.map((pull) => ({
          participantId: participant.id,
          speciesDex: pull.species.dex,
          purchaseId: purchase.id,
          tierName: pull.tier.name,
          tierColor: pull.tier.color,
        })),
      });

      const debit = await tx.participant.updateMany({
        where: { id: participant.id, coins: { gte: pack.price } },
        data: { coins: { decrement: pack.price } },
      });
      if (debit.count !== 1) {
        throw new GachaError(
          "Your coin balance changed before the purchase completed. Please try again.",
          409,
        );
      }
      const updatedParticipant = await tx.participant.findUniqueOrThrow({
        where: { id: participant.id },
        select: { coins: true },
      });

      return { pulls, coins: updatedParticipant.coins };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GachaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Pack opening route error:", error);
    return NextResponse.json(
      { error: "The pack could not be opened due to a server error. Please try again." },
      { status: 500 },
    );
  }
}
