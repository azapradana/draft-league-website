import { NextResponse, type NextRequest } from "next/server";
import { authFailure, requireUser } from "@/lib/api-auth";
import { dropParticipant } from "@/lib/participant-drop";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;
  const auth = await requireUser(tournamentId);
  if (!auth.ok) return authFailure(auth);

  const result = await prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({
      where: { userId_tournamentId: { userId: auth.userId, tournamentId } },
      select: { id: true },
    });
    if (!participant) {
      return {
        ok: false as const,
        statusCode: 403,
        error: "Only approved participants can drop from this tournament.",
      };
    }
    return dropParticipant(tx, tournamentId, participant.id, auth.userId);
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
