import { redirect } from "next/navigation";

export default async function TournamentPackEditorRedirect({
  params,
}: {
  params: Promise<{ id: string; packId: string }>;
}) {
  const { packId } = await params;
  redirect(`/admin/packs/${encodeURIComponent(packId)}`);
}
