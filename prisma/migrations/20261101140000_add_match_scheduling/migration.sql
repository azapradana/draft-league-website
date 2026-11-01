-- AlterTable
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "scheduledAt" TIMESTAMP(3),
ADD COLUMN "scheduledById" TEXT;

-- CreateTable
CREATE TABLE "MatchTimeOption" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTimeOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchTimeOption_matchId_startsAt_idx" ON "MatchTimeOption"("matchId", "startsAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTimeOption" ADD CONSTRAINT "MatchTimeOption_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTimeOption" ADD CONSTRAINT "MatchTimeOption_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
