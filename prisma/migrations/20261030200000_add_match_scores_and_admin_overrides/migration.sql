ALTER TABLE "Match"
ADD COLUMN "player1Score" INTEGER,
ADD COLUMN "player2Score" INTEGER,
ADD COLUMN "adminOverrideById" TEXT,
ADD COLUMN "adminOverrideAt" TIMESTAMP(3);

ALTER TABLE "Match"
ADD CONSTRAINT "Match_adminOverrideById_fkey"
FOREIGN KEY ("adminOverrideById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
