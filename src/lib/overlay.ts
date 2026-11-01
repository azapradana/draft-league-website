import { prisma } from "@/lib/prisma";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function parseAccentColor(value: string | null | undefined): string | null {
  return value && HEX_COLOR.test(value) ? value.toLowerCase() : null;
}

export type OverlayResult = "win" | "loss" | "draw" | "in_progress";

// Public data: never add emails, user ids, teams, chat or votes here.
export type OverlayData = {
  groups: {
    name: string;
    logoUrl: string | null;
    accentColor: string | null;
    score: number;
    isWinner: boolean;
  }[];
  winner: string | null;
  matches: {
    round: number;
    player1: { name: string; group: number };
    player2: { name: string; group: number };
    // From player1's perspective.
    result: OverlayResult;
  }[];
};

type Named = { name: string | null; username: string | null };
const displayName = (user: Named) => user.name?.trim() || user.username?.trim() || "Player";

// Returns null for unknown tournaments and for tournaments that are not Friendly Match.
export async function getOverlayData(tournamentId: string): Promise<OverlayData | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      format: true,
      friendlyMatchGroup: {
        select: { id: true, name: true, logoUrl: true, accentColor: true },
      },
      friendlyWar: {
        select: {
          id: true,
          status: true,
          winnerGroupId: true,
          groups: { select: { groupId: true, wins: true } },
          entries: { select: { userId: true, groupId: true } },
        },
      },
      matches: {
        orderBy: [{ roundNumber: "asc" }, { bracketPosition: "asc" }],
        select: {
          roundNumber: true,
          status: true,
          winnerId: true,
          isDraw: true,
          player1Id: true,
          player1: {
            select: {
              userId: true,
              friendlyMatchGroupId: true,
              user: { select: { name: true, username: true } },
            },
          },
          player2: {
            select: {
              userId: true,
              friendlyMatchGroupId: true,
              user: { select: { name: true, username: true } },
            },
          },
        },
      },
    },
  });
  if (!tournament || tournament.format !== "FRIENDLY_MATCH") return null;

  const core = await prisma.group.findFirst({
    where: { isCore: true },
    select: { id: true, name: true, logoUrl: true, accentColor: true },
  });
  const sources = [core, tournament.friendlyMatchGroup].filter(
    (group): group is NonNullable<typeof group> => group !== null,
  );

  const war = tournament.friendlyWar;
  const completed = war?.status === "COMPLETED";
  const winnerId = completed ? (war?.winnerGroupId ?? null) : null;
  const groups = sources.map((group) => ({
    id: group.id,
    name: group.name,
    logoUrl: group.logoUrl,
    accentColor: parseAccentColor(group.accentColor),
    score: war?.groups.find((g) => g.groupId === group.id)?.wins ?? 0,
    isWinner: winnerId === group.id,
  }));

  const entryGroup = new Map((war?.entries ?? []).map((e) => [e.userId, e.groupId]));
  const groupIndex = (p: { userId: string; friendlyMatchGroupId: string | null }) => {
    const id = entryGroup.get(p.userId) ?? p.friendlyMatchGroupId;
    return Math.max(0, groups.findIndex((g) => g.id === id));
  };

  const matches: OverlayData["matches"] = [];
  for (const match of tournament.matches) {
    if (!match.player1 || !match.player2) continue;
    const a = { name: displayName(match.player1.user), group: groupIndex(match.player1) };
    const b = { name: displayName(match.player2.user), group: groupIndex(match.player2) };
    const p1Won = match.winnerId === match.player1Id;
    let result: OverlayResult = "in_progress";
    if (match.status === "COMPLETED") {
      result = match.winnerId === null ? "draw" : p1Won ? "win" : "loss";
    }
    // Keep the first group on the left; a swapped pair also flips the result.
    if (a.group > b.group) {
      const flipped = result === "win" ? "loss" : result === "loss" ? "win" : result;
      matches.push({ round: match.roundNumber, player1: b, player2: a, result: flipped });
    } else {
      matches.push({ round: match.roundNumber, player1: a, player2: b, result });
    }
  }

  return {
    groups: groups.map(({ id: _id, ...rest }) => rest),
    winner: groups.find((g) => g.isWinner)?.name ?? null,
    matches,
  };
}
