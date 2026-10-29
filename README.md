# Pokémon VGC Gacha Draft League

A web app for organizing Pokémon VGC draft leagues and tournaments. Players use tournament coins to open Pokémon packs, build a roster, and compete. Admins manage tournaments, players, pack contents, and matches.

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

- Node.js 20.19 or later and npm
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

### 2. Configure local environment

Copy `.env.example` to `.env`. The example values work with the local PostgreSQL container; keep `.env` private and do not commit it. Generate a strong `NEXTAUTH_SECRET` (for example, with `openssl rand -base64 32`) and replace the example administrator password before seeding.

Google sign-in is optional. To enable it, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

### 3. Start PostgreSQL

```bash
docker compose up -d db
```

### 4. Set up the database and initial data

```bash
npx prisma db push
npx prisma db seed
```

`db push` creates or updates the schema. `db seed` loads the Pokémon species data and creates or updates the administrator account using `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

### 5. Start the website

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the administrator credentials from `.env` to create and manage tournaments. Players can sign up from the site.

To stop the local database, run `docker compose down`. Data persists in the Docker volume; `docker compose down -v` permanently removes it.

## Deploy to Vercel with Neon

1. Create a PostgreSQL project in [Neon](https://neon.tech/) and import this repository into [Vercel](https://vercel.com/). Select the Next.js framework preset and use the default build command (`npm run build`).
2. In Vercel project settings, add these environment variables for **Production**:
   - `DATABASE_URL`: Neon pooled connection string.
   - `DATABASE_URL_UNPOOLED`: Neon direct, unpooled connection string.
   - `NEXTAUTH_SECRET`: a newly generated, long random secret.
   - `NEXTAUTH_URL`: your production site URL, such as `https://your-project.vercel.app`. Do not set the production URL for Preview deployments; NextAuth can infer the preview URL from Vercel.

   If you enable Preview deployments, use a separate Neon branch/database and set its connection strings for Vercel's **Preview** environment rather than pointing previews at production data.
3. Before opening the deployed site, initialize Neon from a trusted local machine. Put the two Neon connection strings and a strong `ADMIN_USERNAME` / `ADMIN_PASSWORD` in a local, untracked `.env`, then run:

   ```bash
   npx prisma db push
   npx prisma db seed
   ```

   `DATABASE_URL_UNPOOLED` is used for schema operations; the seed connects with `DATABASE_URL`. Keep these credentials private and never add them to source control.
4. Deploy from Vercel or push a commit to the connected Git branch. Vercel will generate Prisma Client and build the Next.js app. Future pushes to the production branch deploy automatically.
5. If enabling Google sign-in, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the appropriate Vercel environments and allow the callback URL `https://your-production-domain/api/auth/callback/google` in Google OAuth settings.

The repository does not yet have a baseline Prisma migration. Initialize a new Neon database with `prisma db push` as above; do not use `prisma migrate deploy` until a baseline migration has been created.
