-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "startedAt" TIMESTAMP(3);

-- Friendly Match has no check-in: every existing participant counts as checked in.
UPDATE "Participant" SET "checkedIn" = true
WHERE "tournamentId" IN (SELECT "id" FROM "Tournament" WHERE "format" = 'FRIENDLY_MATCH');
