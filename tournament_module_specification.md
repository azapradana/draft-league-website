# Pokémon VGC Gacha Draft League — Tournament Running & Match Module Specification

This document specifies the tournament execution module for the Pokémon VGC Gacha Draft League web application. It builds directly upon the core gacha, shop, and drafting mechanics defined in `SPEC.md`, adding Friendly Match group wars as the default format alongside single-elimination and Swiss-to-Top-Cut formats, plus match rooms with chat, roster inspection, mutual result confirmation, and admin dispute handling.

---

## 1. Database Schema Updates (Prisma)

Add the following models and fields to `prisma/schema.prisma`:

### Updates to Existing Models

- **Tournament**:
  - Add `description` (String, default empty) for a formatted overview of the tournament format, schedule, and rules
  - Add `checkInOpen` (Boolean, default `false`)
  - Add `completed` (Boolean, default `false`) so admins can mark a tournament completed; completion also closes the tournament and check-in
  - Add `rostersPublic` (Boolean, default `false`) to control whether participants can view every approved player's roster
  - Add `topCut` (Int, default `0`) and `currentStage` (`SINGLE_ELIMINATION`, `SWISS`, `TOP_CUT`, or `COMPLETED`) for Swiss-to-playoff tournaments
- **Participant**:
  - Add `checkedIn` (Boolean, default `false`)
- **Pack**:
  - Add `description` (String, default empty) for formatted details about the pack
- **Species**:
  - Add `types` (String array, default empty) so match roster inspectors can display battle types.

### New Models

- **Match**:
  - `id`: String (UUID or cuid)
  - `tournamentId`: String (Foreign Key to Tournament)
  - `roundNumber`: Int (1, 2, 3, etc.)
  - Add nullable `stage` (`SINGLE_ELIMINATION`, `SWISS`, or `TOP_CUT`) and `bracketPosition` to preserve playoff progression order
  - `player1Id`: String (Foreign Key to Participant, nullable for byes)
  - `player2Id`: String (Foreign Key to Participant, nullable for byes)
  - `winnerId`: String (Foreign Key to Participant, nullable)
  - `player1Vote`: String (Foreign Key to Participant, nullable - stores who player 1 voted as winner)
  - `player2Vote`: String (Foreign Key to Participant, nullable - stores who player 2 voted as winner)
  - `player1Score` and `player2Score`: nullable game-win scores recorded for admin-declared results
  - `adminOverrideById` and `adminOverrideAt`: nullable admin and timestamp audit fields for manually overridden results
  - `status`: Enum (`PENDING`, `COMPLETED`, `DISPUTED`), default `PENDING`
  - `createdAt`: DateTime (default now)
  - `updatedAt`: DateTime (updated on vote/status change)
  - *Relations*: Tournament, Player1, Player2, Winner, Messages

- **MatchMessage**:
  - `id`: String (UUID or cuid)
  - `matchId`: String (Foreign Key to Match)
  - `senderId`: String (Foreign Key to User or Participant)
  - `senderName`: String
  - `content`: String
  - `timestamp`: DateTime (default now)
  - *Relations*: Match

---

## 2. Tournament Workflow & States

### Phase 1: Check-in
1. **Admin Control**: The tournament admin toggles `checkInOpen` to `true` from `/admin/t/[id]`.
2. **Player Action**: Approved participants visit `/t/[id]` and click a prominent **"Check In"** button while check-in is open.
3. **Validation**: Only participants with `status = APPROVED` and `checkedIn = true` are eligible for Round 1 entry.

### Phase 2: Round Generation
1. **Admin Action**: Once check-ins close, the admin starts Round 1 at `/admin/t/[id]/matches`.
2. **Single Elimination**: Checked-in approved participants are shuffled and paired; a bye is automatically resolved for an odd field.
3. **Swiss**: All checked-in approved participants play every configured Swiss round. Pairings follow current standings where possible, avoid rematches, and award byes to the lowest-ranked player without a previous bye.
4. Swiss matches award 3 match points for a win and 0 for a loss. Standings rank by match points, opponent match-win percentage (minimum 33.3%), match wins, then player name. Admin-declared results may retain game scores for auditing; game-win tie-breakers are not used.

### Phase 3: Match Room & Interaction (`/t/[id]/matches/[matchId]`)
1. **Match Room Access**: Paired players and admins can access the match room.
2. **Features**:
   - **Match Chat**: Real-time or polled text chat between Player 1, Player 2, and admins.
   - **Roster Inspector**: Side-by-side display of both players' locked 6-Pokémon rosters (sprites, names, types, and collection tiers).

### Phase 4: Mutual Result Confirmation & Disputes
1. **Result Submission**: 
   - Each player selects the winner from a dropdown/button group and clicks "Submit Result".
   - Stored in `player1Vote` or `player2Vote`.
2. **State Evaluation**:
   - **Match**: If both votes match (`player1Vote === player2Vote`), the match automatically transitions to `COMPLETED` and `winnerId` is set. A Swiss loss does not eliminate a player.
   - **Dispute**: If Player 1 votes themselves and Player 2 votes themselves (conflicting votes), the match status immediately updates to `DISPUTED`, locking further automated changes and alerting admins.
3. **Admin Resolution**:
   - Admins see every generated match, its table number, result, score, and room link on `/admin/t/[id]/matches`; the roster refreshes periodically.
   - Admins can confirm a winner and final game score for a match in the latest round. The override records the administering user and timestamp; later rounds and completed tournaments are read-only to protect bracket integrity.

### Phase 5: Subsequent Rounds
1. For Swiss, the admin generates the next standings-based round after every match in the current round is completed. After all configured rounds, the admin can generate the configured Top 4 or Top 8 bracket; the cut must fit the checked-in field.
2. Playoff seeds come from Swiss standings. Top 4 and Top 8 proceed as single-elimination brackets until one champion remains. The tournament closes automatically after the final match.
3. A Swiss-only tournament closes after its final Swiss round. Admins can manually toggle completion in tournament settings. Completed tournaments do not accept match results or generate further rounds.

---

## 3. API Routes Specification

- `POST /api/tournaments/[id]/checkin`: Toggle or submit participant check-in.
- `POST /api/admin/tournaments/[id]/rounds/generate` and `/rounds/start`: Generate Round 1 or subsequent rounds (Admin only).
- `POST /api/admin/tournaments/[id]/top-cut/generate`: Seed and generate the Swiss Top Cut bracket (Admin only).
- `GET /api/tournaments/[id]/matches/[matchId]`: Fetch match details, rosters, chat messages, and vote status.
- `POST /api/tournaments/[id]/matches/[matchId]/chat`: Post a message to match chat.
- `POST /api/tournaments/[id]/matches/[matchId]/result`: Submit a match winner vote.
- `POST /api/admin/tournaments/[id]/matches/[matchId]/resolve`: Admin override for disputed matches.
- Server action at `/admin/t/[id]/matches`: Admin winner and final-score override for the latest round.

---

## 4. UI Pages & Components

1. **Tournament Overview (`/t/[id]/page.tsx`)**:
   - Show the tournament description with rich-text formatting.
   - Participant table with check-in status and saved rosters. Admins can always view approved rosters; participants can view all approved rosters when `rostersPublic` is enabled, otherwise only their own.
   - After the final match is completed, show every approved participant in a unique finishing order from 1 to the participant count. Display gold, silver, and bronze medals beside the first-, second-, and third-place names; rank earlier-round eliminations below later-round eliminations.
   - Check-in status banner and check-in button.
   - Live Swiss round / Top Cut bracket view showing pairings and match statuses; Swiss standings are available at `/t/[id]/standings`.
2. **Match Room (`/t/[id]/matches/[matchId]/page.tsx`)**:
   - Header with Round info and opponent details.
   - Side-by-side Roster Inspector (up to 6 Pokémon cards with sprites, names, types, and collection tiers per player).
   - Match Chat box with message history and input.
   - Result voting panel with confirmation states ("Waiting for opponent", "Votes match! Match completed", "Conflict detected: Admin notified").
3. **Admin Tournament Management (`/admin/t/[id]/page.tsx`)**:
   - Provide rich-text description editors for the tournament and its packs; render the pack description in the shop.
   - Check-in toggle switch.
   - Roster editing lock and roster visibility toggle.
   - Swiss round count and optional Top 4 / Top 8 settings; Top Cut cannot exceed the configured field or the checked-in player count.
   - Round generation buttons, Swiss standings, and Top Cut bracket management at `/admin/t/[id]/matches`.
   - Disputed matches alert queue with manual override controls.

## 5. Final Polish, Loading, and Error Handling

- Show low-profile pulse skeletons while the collection, shop packs, tournament bracket, or match room is loading; respect reduced-motion preferences.
- Use contextual empty states:
  - Shop: "No packs currently available in the store."
  - Collection: "Your roster is empty. Open some packs in the shop to start collecting!"
  - Bracket: "Tournament bracket has not been generated yet. Check in and wait for the admin to start Round 1."
  - Match chat: "No messages yet. Coordinate your match or say glhf!"
- Surface failed actions and refresh errors in accessible inline alerts, including insufficient pack funds, failed check-in, chat/result submission failures, and conflicting match votes.
- Provide an application-level recovery screen with a retry action for unexpected page-rendering failures.