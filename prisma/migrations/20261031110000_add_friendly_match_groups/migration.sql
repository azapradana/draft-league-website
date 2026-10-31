CREATE TABLE IF NOT EXISTS "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Group_name_key" ON "Group"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Group_single_core_key" ON "Group"("isCore") WHERE "isCore" = true;

INSERT INTO "Group" ("id", "name", "isCore", "updatedAt")
VALUES ('core-7ds', '7DS', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "groupId" TEXT,
ADD COLUMN IF NOT EXISTS "friendlyMatchParticipationCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Tournament"
ADD COLUMN IF NOT EXISTS "friendlyMatchGroupId" TEXT,
ADD COLUMN IF NOT EXISTS "friendlyMatchSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "friendlyMatchInviteToken" TEXT;

ALTER TABLE "Participant"
ADD COLUMN IF NOT EXISTS "friendlyMatchGroupId" TEXT,
ADD COLUMN IF NOT EXISTS "friendlyMatchSubstitute" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "friendlyMatchForcedLineup" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Match"
ADD COLUMN IF NOT EXISTS "isDraw" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "player1DrawVote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "player2DrawVote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "friendlyMatchParticipationCounted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Tournament"
ALTER COLUMN "format" SET DEFAULT 'FRIENDLY_MATCH',
ALTER COLUMN "currentStage" SET DEFAULT 'FRIENDLY_MATCH';

CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_friendlyMatchInviteToken_key"
ON "Tournament"("friendlyMatchInviteToken");

CREATE INDEX IF NOT EXISTS "User_groupId_idx" ON "User"("groupId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'User_groupId_fkey' AND conrelid = '"User"'::regclass
    ) THEN
        ALTER TABLE "User"
        ADD CONSTRAINT "User_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "Group"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Participant_friendlyMatchGroupId_idx"
ON "Participant"("friendlyMatchGroupId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Participant_friendlyMatchGroupId_fkey'
          AND conrelid = '"Participant"'::regclass
    ) THEN
        ALTER TABLE "Participant"
        ADD CONSTRAINT "Participant_friendlyMatchGroupId_fkey"
        FOREIGN KEY ("friendlyMatchGroupId") REFERENCES "Group"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Tournament_friendlyMatchGroupId_fkey'
          AND conrelid = '"Tournament"'::regclass
    ) THEN
        ALTER TABLE "Tournament"
        ADD CONSTRAINT "Tournament_friendlyMatchGroupId_fkey"
        FOREIGN KEY ("friendlyMatchGroupId") REFERENCES "Group"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
