# Pokémon VGC Gacha Draft League — Tournament Running & Match Module Specification

This document specifies the tournament execution module for the Pokémon VGC Gacha Draft League web application. It builds directly upon the core gacha, shop, and drafting mechanics defined in `SPEC.md`, adding tournament check-ins, randomized single-elimination brackets, match rooms with chat, roster inspection, mutual result confirmation, and admin dispute handling.

---

## 1. Database Schema Updates (Prisma)

Add the following models and fields to `prisma/schema.prisma`:

### Updates to Existing Models

- **Tournament**:
  - Add `checkInOpen` (Boolean, default `false`)
  - Add `rostersPublic` (Boolean, default `false`) to control whether participants can view every approved player's roster
- **Participant**:
  - Add `checkedIn` (Boolean, default `false`)

### New Models

- **Match**:
  - `id`: String (UUID or cuid)
  - `tournamentId`: String (Foreign Key to Tournament)
  - `roundNumber`: Int (1, 2, 3, etc.)
  - `player1Id`: String (Foreign Key to Participant, nullable for byes)
  - `player2Id`: String (Foreign Key to Participant, nullable for byes)
  - `winnerId`: String (Foreign Key to Participant, nullable)
  - `player1Vote`: String (Foreign Key to Participant, nullable - stores who player 1 voted as winner)
  - `player2Vote`: String (Foreign Key to Participant, nullable - stores who player 2 voted as winner)
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

### Phase 2: Round 1 Bracket Generation
1. **Admin Action**: Once check-ins close, the admin clicks **"Generate Round 1 Pairings"**.
2. **Backend Logic**:
   - Gathers all participants where `checkedIn = true`.
   - Randomly shuffles the array securely.
   - If the count of checked-in players is odd, one random player receives a **Bye** (automatically advances to Round 2, with a dummy match or pre-resolved match record).
   - Pairs remaining players sequentially into `Match` records for `roundNumber = 1`.

### Phase 3: Match Room & Interaction (`/t/[id]/matches/[matchId]`)
1. **Match Room Access**: Paired players and admins can access the match room.
2. **Features**:
   - **Match Chat**: Real-time or polled text chat between Player 1, Player 2, and admins.
   - **Roster Inspector**: Side-by-side display of both players' locked 6-Pokémon rosters (sprites, types, names).

### Phase 4: Mutual Result Confirmation & Disputes
1. **Result Submission**: 
   - Each player selects the winner from a dropdown/button group and clicks "Submit Result".
   - Stored in `player1Vote` or `player2Vote`.
2. **State Evaluation**:
   - **Match**: If both votes match (`player1Vote === player2Vote`), the match automatically transitions to `COMPLETED`, `winnerId` is set, and the loser is eliminated.
   - **Dispute**: If Player 1 votes themselves and Player 2 votes themselves (conflicting votes), the match status immediately updates to `DISPUTED`, locking further automated changes and alerting admins.
3. **Admin Resolution**:
   - Admins see a **Dispute Panel** on `/admin/t/[id]`.
   - The admin can override votes, manually select the winner, and force-complete the match.

### Phase 5: Subsequent Rounds
1. Once all matches in the current round have a `COMPLETED` status, the admin can click **"Start Next Round"**.
2. Winners from the current round are paired randomly into the next round (`roundNumber + 1`) until a Grand Final determines the champion.

---

## 3. API Routes Specification

- `POST /api/tournaments/[id]/checkin`: Toggle or submit participant check-in.
- `POST /api/admin/tournaments/[id]/rounds/generate` and `/rounds/start`: Generate Round 1 or subsequent rounds (Admin only).
- `GET /api/tournaments/[id]/matches/[matchId]`: Fetch match details, rosters, chat messages, and vote status.
- `POST /api/tournaments/[id]/matches/[matchId]/chat`: Post a message to match chat.
- `POST /api/tournaments/[id]/matches/[matchId]/vote`: Submit a match winner vote.
- `POST /api/admin/tournaments/[id]/matches/[matchId]/resolve`: Admin override for disputed or stuck matches.

---

## 4. UI Pages & Components

1. **Tournament Overview (`/t/[id]/page.tsx`)**:
   - Participant table with check-in status and saved rosters. Admins can always view approved rosters; participants can view all approved rosters when `rostersPublic` is enabled, otherwise only their own.
   - Check-in status banner and check-in button.
   - Live bracket tree view showing current rounds, pairings, and match statuses.
2. **Match Room (`/t/[id]/matches/[matchId]/page.tsx`)**:
   - Header with Round info and opponent details.
   - Side-by-side Roster Inspector (6 Pokémon cards with sprites per player).
   - Match Chat box with message history and input.
   - Result voting panel with confirmation states ("Waiting for opponent", "Votes match! Match completed", "Conflict detected: Admin notified").
3. **Admin Tournament Management (`/admin/t/[id]/page.tsx`)**:
   - Check-in toggle switch.
   - Roster editing lock and roster visibility toggle.
   - Round generation buttons and bracket management at `/admin/t/[id]/matches`.
   - Disputed matches alert queue with manual override controls.