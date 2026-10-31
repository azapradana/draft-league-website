CREATE TYPE "TournamentMode" AS ENUM ('GACHA', 'REGULAR');

ALTER TABLE "Tournament" ADD COLUMN "mode" "TournamentMode" NOT NULL DEFAULT 'GACHA';

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "rawPaste" TEXT NOT NULL,
    "parsed" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_participantId_key" ON "Team"("participantId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
