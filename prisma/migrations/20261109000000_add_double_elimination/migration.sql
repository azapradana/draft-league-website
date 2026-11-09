ALTER TYPE "TournamentFormat" ADD VALUE 'DOUBLE_ELIMINATION';

CREATE TYPE "MatchBracket" AS ENUM ('WINNERS', 'LOSERS', 'GRAND_FINAL');

ALTER TABLE "Participant" ADD COLUMN "bracketSeed" INTEGER;
ALTER TABLE "Match"
  ADD COLUMN "bracket" "MatchBracket",
  ADD COLUMN "nextWinMatchId" TEXT,
  ADD COLUMN "nextWinSlot" INTEGER,
  ADD COLUMN "nextLoseMatchId" TEXT,
  ADD COLUMN "nextLoseSlot" INTEGER,
  ADD COLUMN "autoResolved" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "Match_nextWinSlot_check" CHECK ("nextWinSlot" IS NULL OR "nextWinSlot" IN (1, 2)),
  ADD CONSTRAINT "Match_nextLoseSlot_check" CHECK ("nextLoseSlot" IS NULL OR "nextLoseSlot" IN (1, 2)),
  ADD CONSTRAINT "Match_nextWin_link_check" CHECK (("nextWinMatchId" IS NULL) = ("nextWinSlot" IS NULL)),
  ADD CONSTRAINT "Match_nextLose_link_check" CHECK (("nextLoseMatchId" IS NULL) = ("nextLoseSlot" IS NULL));

CREATE INDEX "Match_tournamentId_bracket_roundNumber_idx" ON "Match"("tournamentId", "bracket", "roundNumber");
CREATE INDEX "Match_nextWinMatchId_idx" ON "Match"("nextWinMatchId");
CREATE INDEX "Match_nextLoseMatchId_idx" ON "Match"("nextLoseMatchId");
