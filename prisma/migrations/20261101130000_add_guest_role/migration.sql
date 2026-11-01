-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GUEST';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "boundTournamentId" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "friendlyMatchInviteActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_boundTournamentId_idx" ON "User"("boundTournamentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_boundTournamentId_fkey" FOREIGN KEY ("boundTournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
