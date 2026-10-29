import Link from "next/link";

export default async function MatchRoomPlaceholder({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id } = await params;

  return (
    <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
      <Link
        href={`/t/${id}`}
        className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]"
      >
        ← Back to tournament overview
      </Link>
      <h2 className="mt-5 text-2xl font-bold">Match room</h2>
      <p className="mt-2 text-[#9FB0E6]">Match UI coming soon.</p>
    </section>
  );
}
