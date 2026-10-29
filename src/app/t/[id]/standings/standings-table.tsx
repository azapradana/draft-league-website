import type { SwissStanding } from "@/lib/tournament-standings";

export function SwissStandingsTable({
  standings,
  topCut = 0,
}: {
  standings: SwissStanding[];
  topCut?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#243775] text-xs uppercase tracking-wide text-[#9FB0E6]">
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Player</th>
            <th className="px-3 py-3">Match points</th>
            <th className="px-3 py-3">Record</th>
            <th className="px-3 py-3">OMW%</th>
            <th className="px-3 py-3">Byes</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => {
            const playerName =
              standing.user.name ??
              standing.user.username ??
              standing.user.email ??
              "Unnamed player";
            const isTopCutSeed = topCut > 0 && index < topCut;

            return (
              <tr
                className={`border-b border-[#243775]/60 last:border-0 ${
                  isTopCutSeed ? "bg-[#F5C542]/[0.07]" : ""
                }`}
                key={standing.id}
              >
                <td className="px-3 py-4 font-bold text-[#F5C542]">{index + 1}</td>
                <td className="px-3 py-4 font-semibold">
                  {playerName}
                  {isTopCutSeed && (
                    <span className="ml-2 rounded-full bg-[#F5C542]/15 px-2 py-1 text-[10px] font-bold uppercase text-[#F5C542]">
                      Top {topCut}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4 font-bold">{standing.matchPoints}</td>
                <td className="px-3 py-4 text-[#9FB0E6]">
                  {standing.matchWins}-{standing.matchLosses}
                </td>
                <td className="px-3 py-4 text-[#9FB0E6]">
                  {(standing.opponentMatchWinPercentage * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-4 text-[#9FB0E6]">{standing.byes}</td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-[#9FB0E6]" colSpan={6}>
                Standings will appear once players are checked in.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
