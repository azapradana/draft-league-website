import { prisma } from "@/lib/prisma";

export default async function WarScoreboard({ tournamentId }: { tournamentId: string }) {
  const war = await prisma.friendlyWar.findUnique({
    where: { tournamentId },
    select: {
      status: true,
      isDraw: true,
      winnerGroupId: true,
      pairingsSeeded: true,
      groups: {
        orderBy: { group: { isCore: "desc" } },
        select: {
          groupId: true,
          wins: true,
          losses: true,
          draws: true,
          group: { select: { name: true, logoUrl: true } },
        },
      },
    },
  });
  if (!war || !war.pairingsSeeded) return null;

  const completed = war.status === "COMPLETED";
  const winner = war.groups.find((g) => g.groupId === war.winnerGroupId);

  return (
    <section aria-label="War scoreboard" className="space-y-4">
      {completed && (
        <div
          className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${
            war.isDraw
              ? "border-slate-400 bg-slate-500/10"
              : "border-[#F5C542] bg-gradient-to-r from-[#F5C542]/25 via-[#F5C542]/10 to-transparent"
          }`}
        >
          <span aria-hidden="true" className="text-3xl">
            {war.isDraw ? "🤝" : "🏆"}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F5C542]">
              {war.isDraw ? "War ends in a draw" : "War Champions"}
            </p>
            <p className="text-xl font-bold">
              {war.isDraw
                ? war.groups.map((g) => g.group.name).join(" & ")
                : (winner?.group.name ?? "Winner")}
            </p>
            <p className="text-sm text-[#9FB0E6]">
              Final score {war.groups.map((g) => g.wins).join(" – ")}
            </p>
          </div>
        </div>
      )}
      <p
        data-testid="war-score-line"
        className="text-center text-sm font-bold tracking-wide text-[#EEF2FF]"
      >
        {war.groups.map((g) => `${g.group.name}: ${g.wins}`).join(" | ")}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        {war.groups.flatMap((g, index) => {
          const card = (
            <div
              className={`rounded-xl border p-4 text-center ${
                completed && g.groupId === war.winnerGroupId
                  ? "border-[#F5C542] bg-[#F5C542]/10"
                  : "border-[#243775] bg-[#0C1638]"
              }`}
              key={g.groupId}
            >
              {g.group.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.group.logoUrl}
                  alt={`${g.group.name} logo`}
                  className="mx-auto mb-2 h-12 w-12 rounded-full object-cover"
                />
              )}
              <p className="font-semibold">
                {g.group.name}
                {completed && g.groupId === war.winnerGroupId && " 🏆"}
              </p>
              <p className="text-3xl font-bold">{g.wins}</p>
              <p className="text-xs text-[#9FB0E6]">
                {g.wins}W · {g.losses}L · {g.draws}D
              </p>
            </div>
          );
          return index === 0
            ? [
                card,
                <span
                  aria-hidden="true"
                  className="flex items-center text-sm font-black text-[#F5C542]"
                  key="vs"
                >
                  VS
                </span>,
              ]
            : [card];
        })}
      </div>
    </section>
  );
}
