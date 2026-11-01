import { notFound } from "next/navigation";
import { getOverlayData } from "@/lib/overlay";
import { MatchesOverlay } from "../overlay-views";

export const metadata = { title: "Matches overlay" };

export default async function MatchesOverlayPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const data = await getOverlayData(tournamentId);
  if (!data) notFound();
  return <MatchesOverlay tournamentId={tournamentId} initial={data} />;
}
