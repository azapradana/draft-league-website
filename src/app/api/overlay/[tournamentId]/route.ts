import { NextResponse } from "next/server";
import { getOverlayData } from "@/lib/overlay";

export const dynamic = "force-dynamic";

// Public endpoint for OBS overlays: no session required, only non-account data is returned.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const { tournamentId } = await params;
  const data = await getOverlayData(tournamentId);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
