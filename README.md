# Pokémon VGC Gacha Draft League

A local-first web app for organizing Pokémon VGC draft leagues and tournaments. Players use tournament coins to open Pokémon packs, build a roster of up to six Pokémon, and compete in a tournament. Admins manage tournaments, players, pack contents, and tournament matches.

## What the website does

- Players can create an account, request to join a tournament, and—once approved—spend tournament coins on packs.
- Pack contents, rarity tiers, pull odds, and duplicate limits are configured by tournament admins.
- Players collect Pokémon and choose up to six distinct species for their battle roster.
- Tournament pages show player and roster information, pack shops, and results.
- Admins can manage tournament settings, approve players, adjust coin balances, configure packs, and lock rosters.
- The tournament module adds check-in, randomized elimination brackets, match rooms with chat and roster inspection, result confirmation, and admin dispute resolution.
- Sign-in uses username and password. Google sign-in can also be enabled with Google OAuth credentials.

See [spec.md](./spec.md) for the core league rules and [tournament_module_specification.md](./tournament_module_specification.md) for the tournament workflow.

## Run locally

### Requirements

- Node.js 20.9 or later and npm
- Docker Desktop (or Docker Engine with the Compose plugin) to run PostgreSQL
- Git

### 1. Get the project and install dependencies

Clone the repository, then enter its directory:

```bash
git clone <repository-url>
cd draft-league-website
npm ci
```

Replace `<repository-url>` with the URL of your Git repository.

### 2. Start PostgreSQL

The included Compose file starts a local PostgreSQL database on port `5432`:

```bash
docker compose up -d db
```

### 3. Configure local environment

Create a `.env` file in the project root and set the following values:

```dotenv
DATABASE_URL="postgresql://draft:draft@localhost:5432/draft?schema=public"
DATABASE_URL_UNPOOLED="<same local PostgreSQL connection string as DATABASE_URL>"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="replace-with-a-strong-local-password"
```

Generate a secret, for example, with `openssl rand -base64 32`, and use the result for `NEXTAUTH_SECRET`. Choose a strong `ADMIN_PASSWORD`; these credentials create the initial local administrator when you seed the database. Keep `.env` private and do not commit it.

For local PostgreSQL, set `DATABASE_URL_UNPOOLED` to the same connection string as `DATABASE_URL`. For Neon, use the pooled connection string as `DATABASE_URL` for the app and the direct connection string as `DATABASE_URL_UNPOOLED` for Prisma CLI operations. The Prisma schema uses the direct URL for schema changes and the pooled URL for application queries.

Google sign-in is optional. To enable it, also set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` using credentials configured for `http://localhost:3000`. Leave both unset to use username and password sign-in only.

### 4. Set up the database and initial data

```bash
npx prisma db push
npx prisma db seed
```

The first command creates or updates the local database schema. The seed command loads the Pokémon species data and creates or updates the administrator account using `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

### 5. Start the website

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the administrator credentials from your `.env` file to create and manage tournaments. Players can sign up from the site.

To stop the local database when you are finished:

```bash
docker compose down
```

Your database data is kept in the Docker volume between restarts. To remove the database and its data, run `docker compose down -v` (this permanently deletes the local `pgdata` volume).
