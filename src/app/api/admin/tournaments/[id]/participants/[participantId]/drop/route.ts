import { NextResponse, type NextRequest } from "next/server";
import { authFailure, requireAdmin } from "@/lib/api-auth";
import { dropParticipant } from "@/lib/participant-drop";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return authFailure(auth);

  const { id: tournamentId, participantId } = await params;
  const result = await prisma.$transaction((tx) =>
    dropParticipant(tx, tournamentId, participantId, auth.userId),
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
