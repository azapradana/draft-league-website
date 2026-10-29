# Pokémon VGC Gacha Draft League

A web app for organizing Pokémon VGC draft leagues and tournaments. Players use tournament coins to open Pokémon packs, build a roster, and compete. Admins manage tournaments, players, pack contents, and matches.

## What the website does

- Players can create an account, request to join a tournament, and—once approved—spend tournament coins on packs.
- Global admins manage reusable pack artwork, rarity tiers, pull odds, and Pokémon pools; tournament admins choose packs and configure event-specific prices and purchase limits.
- Players collect Pokémon and choose up to six distinct species for their battle roster.
- Tournament pages show player and roster information, pack shops, and results.
- Admins can manage tournament settings, approve players, adjust coin balances, configure packs, and lock rosters.
- The tournament module adds check-in, randomized elimination brackets, match rooms with chat and roster inspection, result confirmation, and admin dispute resolution.
- Sign-in uses username and password. Google sign-in can also be enabled with Google OAuth credentials.
- Players can change their password and manage linked Google sign-in from **Profile & settings**.

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

Image uploads require a public Vercel Blob store. Connect the store to your Vercel project to use Vercel's OIDC authentication in deployments. For local development, run `vercel env pull` from the linked project to load its Blob credentials, or set `BLOB_READ_WRITE_TOKEN` from the store's read/write token settings in `.env`. Never commit the token.

Google sign-in and sign-up are optional. To enable them, create a Google OAuth client and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` (or your deployment's environment variables). See [Connect Google sign-in](#connect-google-sign-in) below.

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

Follow these steps in order. You will need accounts on GitHub (or the Git provider holding this repository), [Neon](https://neon.tech/), and [Vercel](https://vercel.com/).

### 1. Check in the deployment code

1. Make sure the latest version of this repository, including `package.json`, `package-lock.json`, and this README, is pushed to the Git branch you want to deploy.
2. Confirm you can sign in to your Git hosting account and that the repository is accessible to Vercel.
3. Use Node.js **20.19 or later** for local setup commands. In Vercel, choose Node.js **22.x** in the project settings.

### 2. Create the production database in Neon

1. Sign in to Neon and create a project. Choose a project name and region close to your expected users. Keep the default PostgreSQL database and branch unless you have a reason to change them.
2. Open the project's **Connect** dialog and select the production branch and database.
3. Copy both connection strings and keep them private:
   - **Pooled** connection string (the hostname usually contains `-pooler`). This will be `DATABASE_URL` in Vercel and is used by the running website.
   - **Direct / unpooled** connection string. This will be `DATABASE_URL_UNPOOLED` in Vercel and is used by Prisma for schema operations.
4. Do not paste either connection string into source files, chat, or a Git commit. They contain database credentials.

### 3. Initialize the Neon schema and administrator

Do this once, from your own computer, before using the website. These commands connect to the production Neon database, so double-check that you copied the correct project and branch.

1. In the repository folder, install dependencies:

   ```bash
   npm ci
   ```

2. Copy the sample environment file and edit it. In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the **direct / unpooled** Neon connection string for this one-time initialization. Set `ADMIN_USERNAME` to a new username and `ADMIN_PASSWORD` to a unique, strong password of at least 8 characters. Replace `NEXTAUTH_SECRET` too if you will run the app locally. Do not use the example credentials.

   For a production database, do not use the sample `.env.example` database URL: it points to local PostgreSQL. `.env` is ignored by Git; never force-add it.
3. Create the tables and load the species list plus the first administrator:

   ```bash
   npx prisma db push
   npx prisma db seed
   ```

   Wait for both commands to finish successfully. The seed command creates the `ADMIN_USERNAME` account with the `ADMIN` role. If seeding fails, fix the reported issue and rerun `npx prisma db seed`; the species and admin upserts can be safely repeated, and you do not need to rerun `db push` unless the schema itself has changed. Running the seed again with the same username **resets that account's password** to the current `ADMIN_PASSWORD`.
4. Keep a safe record of the admin username/password. Do not add `ADMIN_USERNAME` or `ADMIN_PASSWORD` to Vercel; they are only needed for the seed command.

This repository currently has no baseline Prisma migration. Use `prisma db push` to initialize this database; do not use `prisma migrate deploy`. Do not run `db push` against an existing database containing data unless you have reviewed the schema changes and have a backup.

### 4. Import the app into Vercel

1. In Vercel, choose **Add New → Project**, connect the Git provider if prompted, find this repository, and select **Import**.
2. Set the project/root directory to the repository root (the folder containing `package.json`).
3. Confirm Vercel detects **Next.js**. Use these build settings:
   - Install command: `npm ci` (default is fine).
   - Build command: `npm run build`.
   - Output directory: leave the default; do not override it.
   - Node.js version: `22.x`.
4. Before deploying, add these environment variables under **Environment Variables**, with the **Production** environment selected:
   - `DATABASE_URL`: the Neon **pooled** connection string.
   - `DATABASE_URL_UNPOOLED`: the Neon **direct / unpooled** connection string.
   - `NEXTAUTH_SECRET`: a newly generated random secret. You can generate one in PowerShell with:

     ```powershell
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

   - Connect a public Vercel Blob store to the project from the store's **Projects** tab. Vercel configures OIDC authentication for deployments. For local uploads, run `vercel env pull` from the linked project, or set `BLOB_READ_WRITE_TOKEN` using the store's read/write token.
   - `NEXTAUTH_URL`: the complete production URL, including `https://`, for example `https://your-project.vercel.app`. Use the Vercel project name/domain you selected.
5. Add each variable with the exact spelling above. Do not include surrounding quotes in Vercel's value field. Do not add `ADMIN_PASSWORD` or the database URL to a `NEXT_PUBLIC_` variable.
6. Select **Deploy** and wait for the deployment to finish. A successful build should show `prisma generate` and `next build` completing successfully.

If you change an environment variable after deploying, go to **Deployments**, redeploy the latest production deployment, and ensure the redeploy uses the latest build.

### 5. Open the deployed site and verify administrator access

1. Open the production URL from Vercel. The home page should load without a server error.
2. Select **Sign in**, then sign in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` used when seeding Neon.
3. Open **Admin**. If the dashboard loads, the app can authenticate and read the production database.
4. If you land on the home page as a non-admin, confirm you seeded the correct Neon project and used the exact username. If login fails, check the Vercel runtime logs and the `NEXTAUTH_SECRET` / database environment variables before reseeding.

### 6. Set up and test a tournament

To make the website usable by players, finish the in-app setup:

1. In **Admin**, create a tournament. Fill in its name, rules/description, starting coins, and copy limits.
2. In **Admin → Global packs**, create reusable packs with artwork and pull counts, then configure each pack's rarity tiers and eligible Pokémon species. In a tournament's **Packs / Gacha** section, attach the global packs you want to offer and set each tournament's own price, sale status, and optional per-player purchase limit. A pack needs configured tiers and entries to offer useful pulls.
3. Open the tournament settings and enable **Open / active** when you are ready for players to join. Keep check-in closed until the event is ready.
4. In a separate browser or private window, create a normal player account using **Sign up**. Usernames must be 3–20 lowercase letters, numbers, or underscores; passwords must be at least 8 characters.
5. As that player, open the tournament and request to join. Return to the admin page and approve the participant. Repeat for the real players.
6. As an approved player, confirm the shop shows the configured pack, open a pack, and set a roster from the collection page. Test this with a test account before inviting the whole group.
7. When ready for the event, open check-in in the tournament admin settings. Players check in on the tournament page. Close check-in, then use the admin matches page to generate round one. In Swiss tournaments, the admin generates each standings-based Swiss round; after all configured rounds, generate the optional Top 4 / Top 8 playoff. Players can view public Swiss standings at `/t/[id]/standings`. Participants submit match results in their match rooms; admins can resolve disputes and advance the bracket.
8. Test sign-out and sign-in again, and verify tournament, shop, roster, and match pages still load after a page refresh. This confirms the data persists in Neon rather than only in a browser session.

### 7. Optional custom domain and Google sign-in

- **Custom domain:** Add the domain in Vercel's **Settings → Domains** and follow Vercel's DNS instructions. After Vercel confirms the domain, update `NEXTAUTH_URL` in the Production environment to the exact canonical `https://` URL, then redeploy.
- **Google sign-in:** Follow [Connect Google sign-in](#connect-google-sign-in) below. Username/password sign-in works without Google OAuth.
- **Preview deployments:** Do not connect Vercel Preview deployments to production Neon data. If previews are needed, create a separate Neon branch/database and set its pooled and direct URLs under Vercel's **Preview** environment.

### Connect Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project. Configure the OAuth consent screen (Google Auth Platform → **Branding** and **Audience**). For an external app still in testing, add the Google accounts that should be able to sign in as test users.
2. Go to **Google Auth Platform → Clients → Create client**, choose **Web application**, and create an OAuth 2.0 Client ID.
3. Add your app origins as **Authorized JavaScript origins**:
   - Local development: `http://localhost:3000`
   - Production: `https://your-production-domain`
4. Add these **Authorized redirect URIs** (the callback path must match exactly):
   - Local development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-production-domain/api/auth/callback/google`
5. Copy the client ID and client secret. In local `.env`, set:

   ```dotenv
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

   For Vercel, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **Settings → Environment Variables** for Production, and confirm `NEXTAUTH_URL` is your production `https://` URL. Keep the secret private and never use a `NEXT_PUBLIC_` variable for it.
6. Restart the local dev server or redeploy Vercel after setting the variables. Open **Sign in** or **Sign up**; the Google button appears when both credentials are configured. Google sign-up creates a regular player account and applies the configured initial player coins.

Both Google variables must be set together. To use Google on a Vercel Preview deployment, add that deployment's exact callback URL to the OAuth client's authorized redirect URIs and configure both variables for the Preview environment as well.

### Troubleshooting

- **Build fails before Next.js starts:** Confirm the latest commit is deployed, Node.js is set to 22.x, and the install/build commands are `npm ci` and `npm run build`.
- **App returns a database error:** Check that both Neon URLs are present in Vercel Production, have no missing characters/quotes, and refer to the same Neon project/branch. Use the pooled URL for `DATABASE_URL` and the direct URL for `DATABASE_URL_UNPOOLED`.
- **Prisma reports missing tables:** Run `npx prisma db push` locally with the correct production Neon URLs, then run `npx prisma db seed`.
- **Admin cannot sign in:** Confirm the seed completed, use the seeded username (not the database password), and rerun `npx prisma db seed` with the intended admin credentials if needed. Reseeding that username resets its password.
- **Changes to environment variables have no effect:** Redeploy after editing the Vercel environment variables.
- **Need to inspect a runtime failure:** In Vercel, open the failed deployment or **Logs** and check the server/runtime error. Never paste secrets into a public issue or log excerpt.
