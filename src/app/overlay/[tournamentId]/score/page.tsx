import { notFound } from "next/navigation";
import { getOverlayData } from "@/lib/overlay";
import { ScoreBarOverlay } from "../overlay-views";

export const metadata = { title: "Score bar overlay" };

export default async function ScoreOverlayPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const data = await getOverlayData(tournamentId);
  if (!data) notFound();
  return <ScoreBarOverlay tournamentId={tournamentId} initial={data} />;
}
