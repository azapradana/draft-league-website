"use client";

import Link from "next/link";
import { memo, useMemo } from "react";

type Player = { id: string; name: string };
export type BracketMatch = {
  id: string;
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL";
  round: number;
  position: number;
  player1: Player | null;
  player2: Player | null;
  winnerId: string | null;
  status: string;
  nextWinMatchId: string | null;
  nextLoseMatchId: string | null;
};

const CARD_WIDTH = 208;
const CARD_HEIGHT = 90;
const COLUMN_WIDTH = 286;
const ROW_HEIGHT = 116;

const MatchCard = memo(function MatchCard({
  match,
  tournamentId,
  ownId,
  isAdmin,
}: {
  match: BracketMatch;
  tournamentId: string;
  ownId: string | null;
  isAdmin: boolean;
}) {
  const own = !!ownId && (match.player1?.id === ownId || match.player2?.id === ownId);
  const content = (
    <>
      <div className="flex justify-between text-xs text-[#9FB0E6]">
        <span>Match {match.position}</span>
        <span>{match.status === "COMPLETED" ? "Complete" : match.status === "DISPUTED" ? "Disputed" : "Pending"}</span>
      </div>
      {[match.player1, match.player2].map((player, index) => (
        <div key={index} className={`mt-1 truncate text-sm ${player?.id === match.winnerId ? "font-bold text-[#F5C542]" : "text-[#EEF2FF]"}`}>
          {player?.name ?? "TBD"}
        </div>
      ))}
    </>
  );
  const className = `block h-full rounded-lg border p-2 ${own ? "border-[#F5C542] bg-[#F5C542]/10" : "border-[#243775] bg-[#070D24]"}`;
  return isAdmin || own ? (
    <Link href={`/t/${tournamentId}/matches/${match.id}`} className={className}>{content}</Link>
  ) : (
    <div className={className}>{content}</div>
  );
});

export default function DoubleEliminationBracket({
  matches,
  tournamentId,
  ownId,
  isAdmin,
}: {
  matches: BracketMatch[];
  tournamentId: string;
  ownId: string | null;
  isAdmin: boolean;
}) {
  const layout = useMemo(() => {
    const winners = matches.filter((match) => match.bracket === "WINNERS");
    const losers = matches.filter((match) => match.bracket === "LOSERS");
    const final = matches.find((match) => match.bracket === "GRAND_FINAL");
    const winRounds = Math.max(0, ...winners.map((match) => match.round));
    const loseRounds = Math.max(0, ...losers.map((match) => match.round));
    const firstWinners = winners.filter((match) => match.round === 1).length;
    const firstLosers = losers.filter((match) => match.round === 1).length;
    const winHeight = Math.max(1, firstWinners) * ROW_HEIGHT;
    const loseHeight = Math.max(1, firstLosers) * ROW_HEIGHT;
    const loseTop = winHeight + 112;
    const finalX = Math.max(winRounds, loseRounds) * COLUMN_WIDTH;
    const nodes = [...winners, ...losers, ...(final ? [final] : [])].map((match) => {
      const roundMatches = (match.bracket === "WINNERS" ? winners : losers).filter((entry) => entry.round === match.round);
      const rowCount = match.bracket === "WINNERS" ? firstWinners : firstLosers;
      const blockHeight = Math.max(1, rowCount) * ROW_HEIGHT;
      const y = match.bracket === "GRAND_FINAL"
        ? Math.floor((winHeight + loseTop + loseHeight) / 2) - CARD_HEIGHT / 2
        : (match.bracket === "WINNERS" ? 48 : loseTop + 48) +
          ((match.position - 0.5) * blockHeight / Math.max(1, roundMatches.length)) - CARD_HEIGHT / 2;
      return { match, x: match.bracket === "GRAND_FINAL" ? finalX : (match.round - 1) * COLUMN_WIDTH, y };
    });
    const byId = new Map(nodes.map((node) => [node.match.id, node]));
    const edges = nodes.flatMap((source) =>
      [source.match.nextWinMatchId, source.match.nextLoseMatchId].flatMap((id, index) => {
        const target = id ? byId.get(id) : undefined;
        if (!target) return [];
        const startX = source.x + CARD_WIDTH;
        const endX = target.x;
        const midX = (startX + endX) / 2;
        const startY = source.y + CARD_HEIGHT / 2;
        const endY = target.y + CARD_HEIGHT / 2;
        return [{ key: `${source.match.id}-${index}`, path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}` }];
      }),
    );
    return { nodes, edges, winRounds, loseRounds, loseTop, finalX, width: finalX + CARD_WIDTH, height: loseTop + loseHeight + 70 };
  }, [matches]);

  if (matches.length === 0) {
    return <p className="mt-6 rounded-xl border border-dashed border-[#243775] p-5 text-[#9FB0E6]">The bracket has not been generated yet.</p>;
  }
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <h4 className="absolute left-0 top-0 font-bold text-[#F5C542]">Winners bracket</h4>
        <h4 className="absolute left-0 font-bold text-[#F5C542]" style={{ top: layout.loseTop }}>Losers bracket</h4>
        {Array.from({ length: layout.winRounds }, (_, index) => <span key={`w${index}`} className="absolute text-xs text-[#9FB0E6]" style={{ left: index * COLUMN_WIDTH, top: 24 }}>Round {index + 1}</span>)}
        {Array.from({ length: layout.loseRounds }, (_, index) => <span key={`l${index}`} className="absolute text-xs text-[#9FB0E6]" style={{ left: index * COLUMN_WIDTH, top: layout.loseTop + 24 }}>Round {index + 1}</span>)}
        <span className="absolute text-sm font-bold text-[#F5C542]" style={{ left: layout.finalX, top: 24 }}>Grand Final</span>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
          {layout.edges.map((edge) => <path key={edge.key} d={edge.path} fill="none" stroke="#5267a6" strokeWidth="1.5" />)}
        </svg>
        {layout.nodes.map(({ match, x, y }) => (
          <div key={match.id} className="absolute" style={{ left: x, top: y, width: CARD_WIDTH, height: CARD_HEIGHT }}>
            <MatchCard match={match} tournamentId={tournamentId} ownId={ownId} isAdmin={isAdmin} />
          </div>
        ))}
      </div>
    </div>
  );
}
