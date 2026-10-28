import { ParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to manage participants." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const { id, participantId } = await params;
  const body: unknown = await request.json();
  const status =
    typeof body === "object" && body !== null && "status" in body
      ? body.status
      : undefined;

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json(
      { error: "Choose an approval or decline status." },
      { status: 400 },
    );
  }

  const result = await prisma.participant.updateMany({
    where: {
      id: participantId,
      tournamentId: id,
      status: ParticipantStatus.PENDING,
    },
    data: { status },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Pending join request not found. It may already have been reviewed." },
      { status: 404 },
    );
  }

  return NextResponse.json({ status });
}
