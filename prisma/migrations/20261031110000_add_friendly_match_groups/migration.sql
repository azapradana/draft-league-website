CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");
CREATE UNIQUE INDEX "Group_single_core_key" ON "Group"("isCore") WHERE "isCore" = true;

INSERT INTO "Group" ("id", "name", "isCore")
VALUES ('core-7ds', '7DS', true);

ALTER TABLE "User"
ADD COLUMN "groupId" TEXT,
ADD COLUMN "friendlyMatchParticipationCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Tournament"
ADD COLUMN "friendlyMatchGroupId" TEXT,
ADD COLUMN "friendlyMatchSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "friendlyMatchInviteToken" TEXT;

ALTER TABLE "Participant"
ADD COLUMN "friendlyMatchGroupId" TEXT,
ADD COLUMN "friendlyMatchSubstitute" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "friendlyMatchForcedLineup" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Match"
ADD COLUMN "isDraw" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "player1DrawVote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "player2DrawVote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "friendlyMatchParticipationCounted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Tournament"
ALTER COLUMN "format" SET DEFAULT 'FRIENDLY_MATCH',
ALTER COLUMN "currentStage" SET DEFAULT 'FRIENDLY_MATCH';

CREATE UNIQUE INDEX "Tournament_friendlyMatchInviteToken_key"
ON "Tournament"("friendlyMatchInviteToken");

CREATE INDEX "User_groupId_idx" ON "User"("groupId");

ALTER TABLE "User"
ADD CONSTRAINT "User_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "Group"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Participant_friendlyMatchGroupId_idx"
ON "Participant"("friendlyMatchGroupId");

ALTER TABLE "Participant"
ADD CONSTRAINT "Participant_friendlyMatchGroupId_fkey"
FOREIGN KEY ("friendlyMatchGroupId") REFERENCES "Group"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tournament"
ADD CONSTRAINT "Tournament_friendlyMatchGroupId_fkey"
FOREIGN KEY ("friendlyMatchGroupId") REFERENCES "Group"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
