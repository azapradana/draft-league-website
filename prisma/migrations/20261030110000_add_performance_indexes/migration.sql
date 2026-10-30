CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE INDEX "Participant_tournamentId_idx" ON "Participant"("tournamentId");

CREATE INDEX "MatchMessage_matchId_timestamp_idx" ON "MatchMessage"("matchId", "timestamp");

CREATE INDEX "MatchMessage_senderId_idx" ON "MatchMessage"("senderId");

CREATE INDEX "PackTier_packId_idx" ON "PackTier"("packId");

CREATE INDEX "PackEntry_tierId_idx" ON "PackEntry"("tierId");

CREATE INDEX "Purchase_participantId_packId_idx" ON "Purchase"("participantId", "packId");

CREATE INDEX "Purchase_packId_idx" ON "Purchase"("packId");

CREATE INDEX "OwnedPokemon_participantId_speciesDex_idx" ON "OwnedPokemon"("participantId", "speciesDex");

CREATE INDEX "OwnedPokemon_purchaseId_idx" ON "OwnedPokemon"("purchaseId");
