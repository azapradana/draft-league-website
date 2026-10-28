# Draft League: Pokémon VGC Gacha Draft League

A web app for running a draft-league tournament. Players spend coins on packs, pull Pokémon with admin-configured odds, and pick six for their battle roster. Admins configure everything.

---

## 1. Decisions (all confirmed)

| Area | Decision |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js route handlers (Node.js) |
| Database | PostgreSQL + Prisma, Postgres run with Docker |
| Auth | NextAuth v4, username/password and Google OAuth, JWT sessions |
| Images | PokéAPI sprites by National Dex number |
| Pool | Pokémon legal in Pokémon Champions **Regulation M-C** (227 base species) |
| Mega forms | Admin chooses per Pokémon whether it can drop |
| Duplicates | Allowed, with admin-set limits **per player** and **league-wide** (defaults: 3 per player, league-wide no limit) |
| Rarity | Admin defines own tier names and weights, per pack |
| Packs | Each pack has its own pool, tiers and weights |
| Joining | Open signup; admin approves each player into each tournament |
| Coins | Admin sets starting coins per tournament, and can set a player's balance later |
| Purchase limits | Admin can cap purchases per pack, per player |
| Shop timing | Open whenever the tournament is active (no separate window) |
| Roster | Player picks up to 6 distinct species and saves; admin can lock rosters |
| Visibility | Every signed-in user sees every player's pulls and rosters at any time |
| Cap hit during a pull | Roll each Pokémon independently; if capped, re-roll from the remaining pool |
| Theme | Dark mode only, deep blue with gold accents |
| First admin | Created by a seed script from env variables; admins can promote others |
| Missing images | Show a placeholder; admin can set an image URL or upload an image |
| Hosting | Local development first |

## 2. Roles

- **Player:** sign up, request to join tournaments, buy and open packs, pick a roster, view results.
- **Admin:** everything a player can do, plus the admin dashboard below.

## 3. Data model (Prisma)

- **User:** id, username (unique, optional for Google users), name, email, image, passwordHash, role (PLAYER | ADMIN). Plus the standard NextAuth tables: Account, Session, VerificationToken.
- **Tournament:** name, active, regulation ("m-c"), startingCoins, maxCopiesPerPlayer, maxCopiesLeague (null = no limit), rostersLocked.
- **Participant:** user + tournament (unique pair), status (PENDING | APPROVED | REJECTED), coins.
- **Species:** dex number, name (unique), isMega, imageUrl (optional override). Seeded with the 227 M-C species.
- **Pack:** tournament, name, price, pullCount, purchaseLimit (null = unlimited), active.
- **PackTier:** pack, name, weight (decimal), color (hex).
- **PackEntry:** pack + species (unique pair), tier. This is the pack's pool.
- **Purchase:** participant, pack, cost, timestamp.
- **OwnedPokemon:** participant, species, purchase. One row per copy owned.
- **Roster:** participant (one-to-one), speciesIds (int array, max 6).

## 4. Gacha rules

Opening a pack runs in one database transaction:

1. Lock the tournament row (so league-wide caps hold under simultaneous purchases).
2. Check: tournament active, player approved, pack on sale, enough coins, purchase limit not reached.
3. Count copies already owned, per player and league-wide.
4. For each of the pack's pulls:
   - A Pokémon is **eligible** if the player is under the per-player cap and the league is under the league-wide cap (if set).
   - Choose a tier by weight, using only tiers that have an eligible Pokémon and a weight above 0.
   - Choose uniformly among that tier's eligible Pokémon.
   - Update the in-memory counts so later pulls in the same pack respect the caps.
   - If no tier has an eligible Pokémon, abort the whole transaction (no coins spent) with a clear message.
5. Save the Purchase and the OwnedPokemon rows, deduct coins, return the pulls (species + tier name and color).

Use a cryptographic random source (`crypto.randomInt`).

Odds shown in the shop are tier chance = tier weight / total weight of non-empty tiers, and they ignore copy caps. Say so in the UI.

## 5. Pages and routes

| Route | Who | What |
|---|---|---|
| `/` | all | Intro and list of tournaments |
| `/login`, `/signup` | all | Username/password forms plus Google button |
| `/t/[id]` | signed in | Overview: join request or status, tournament rules |
| `/t/[id]/shop` | signed in | Pack cards (price, count, tier odds, "what can drop"), buy button, pack-opening overlay |
| `/t/[id]/roster` | approved | Collection grid with ×N badges; pick up to 6; save; locked notice |
| `/t/[id]/results` | signed in | Every approved player: coins left, roster sprites, expandable full pull list |
| `/admin` | admin | Create tournament, list tournaments, promote/demote users |
| `/admin/t/[id]` | admin | Settings, players, packs (tiers + pool), Mega/image tools |

The tournament layout shows the tournament name, active state, a sub-navigation (Overview, Shop, My roster, Results) and the player's coin balance.

### Admin dashboard sections

1. **Settings:** name, starting coins (affects new joiners only), per-player cap, league-wide cap, open/close shop (active), lock/unlock rosters. Regulation is shown, fixed to M-C.
2. **Players:** approve, decline, set a player's coin balance.
3. **Packs:** create (name, price, Pokémon per pack, per-player purchase limit); edit; put on or off sale; delete only if never bought.
   - **Tier editor:** name, weight, color; show each tier's share of total weight. A tier that still has Pokémon in it can't be removed.
   - **Pool editor:** searchable list of all Pokémon; check to include, choose a tier per Pokémon; "add all shown" and "remove all shown" with a chosen tier.
4. **Mega forms and images:** add a Pokémon (for example "Mega Metagross" with base Dex number and Mega flag); set an image URL or upload an image per Pokémon; clear it.

## 6. API (route handlers)

- `POST /api/signup`: create a username/password account (3–20 chars of a–z, 0–9, `_`; password at least 8).
- `/api/auth/[...nextauth]`: NextAuth.
- `POST /api/tournaments/[id]/join`: create a PENDING participant with the tournament's starting coins.
- `POST /api/tournaments/[id]/open`: body `{ packId }`, runs the gacha transaction.
- `PUT /api/tournaments/[id]/roster`: body `{ speciesIds }`; must be owned, distinct, at most 6, rosters not locked.
- `POST /api/admin`: one admin endpoint taking `{ action, ... }` with actions: createTournament, updateTournament, setParticipant, setRole, createPack, updatePack, deletePack, saveTiers, savePool, createSpecies, setSpeciesImage. Admin only.
- `POST /api/admin/upload`: image upload (PNG, JPG, WebP, GIF, up to 2 MB) saved to `public/uploads`. Admin only.

Every admin route checks the role on the server. The JWT callback re-reads the role from the database so promotions apply without signing out.

## 7. Images

- Official artwork URL pattern:
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dex}.png`
- Image shown = admin override if set, otherwise the artwork for non-Mega species, otherwise a placeholder ("No image yet").
- Each sprite shows a shimmer while loading and falls back to the placeholder on error. Handle the case where a cached image finishes loading before hydration.

## 8. UI and design

- Palette: ink `#070D24`, navy `#0C1638`, panel `#122050`, line `#243775`, gold `#F5C542`, gold-deep `#D9A21B`, mist `#9FB0E6`, snow `#EEF2FF`.
- Type: Bricolage Grotesque for headings, Figtree for body (via `next/font/google`).
- Gold is reserved for coins, primary actions and active states.
- The memorable moment is pack opening: a gold foil pack you tap to tear open, then cards that flip one at a time with a glow in the tier color, plus "Reveal all". Respect `prefers-reduced-motion`.
- Responsive from phone to desktop, visible keyboard focus, clear error messages that say what to do next, sentence-case labels, buttons named for what they do.

## 9. Environment variables

```
DATABASE_URL="postgresql://draft:draft@localhost:5432/draft"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""          # openssl rand -base64 32
GOOGLE_CLIENT_ID=""         # optional
GOOGLE_CLIENT_SECRET=""     # optional
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="change-me-now"
```

Google redirect URI for local development: `http://localhost:3000/api/auth/callback/google`.

## 10. Setup in VS Code

1. Create the project folder and open it in VS Code. Put this file in the folder as `SPEC.md`.
2. Scaffold: `npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*"`.
3. Install: `npm i next-auth @next-auth/prisma-adapter @prisma/client bcryptjs` and `npm i -D prisma tsx @types/bcryptjs`.
4. `docker-compose.yml` with `postgres:16` (user, password and database all `draft`, port 5432); run `docker compose up -d`.
5. `npx prisma init`, write the schema from section 3 in `prisma/schema.prisma`, then `npx prisma db push`.
6. Seed: `prisma/seed.ts` upserts the Species from `prisma/champions-m-c.json` (see appendix) and creates the admin from `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Add `"prisma": { "seed": "tsx prisma/seed.ts" }` to `package.json`, then run `npx prisma db seed`.
7. `npm run dev`.

Common errors: "Could not find Prisma Schema" means there is no `prisma/schema.prisma` yet, or you're running the command outside the project folder.

## 11. Suggested build order

1. Prisma schema, Docker, seed.
2. Auth (NextAuth config, signup, login pages), plus `requireUser` / `requireAdmin` helpers.
3. Tournament pages with join flow and approval.
4. Admin: create tournament, settings, players.
5. Admin: packs, tiers, pool editor.
6. Gacha function and `/open` route, then the shop page.
7. Pack-opening overlay.
8. Collection and roster page, then results page.
9. Mega/image tools and upload.
10. Polish: loading and empty states, mobile pass, error messages.

## 12. Known limits and open items

- Image uploads write to `public/uploads`, which won't work on serverless hosting. Use image URLs or add object storage before deploying.
- Pool data lists base species only. Mega forms are added by hand by an admin.
- The odds model is tier weight first, then uniform within the tier. A per-Pokémon weight is a possible change.
- Google sign-in creates accounts without a username; they show their Google name.
- Changing a tournament's starting coins does not change existing players' balances.

---

## Appendix: Regulation M-C legal species (227, National Dex number : name)

3:Venusaur 6:Charizard 9:Blastoise 15:Beedrill 18:Pidgeot 24:Arbok 25:Pikachu 26:Raichu 36:Clefable 38:Ninetales 40:Wigglytuff 45:Vileplume 53:Persian 59:Arcanine 65:Alakazam 68:Machamp 71:Victreebel 80:Slowbro 94:Gengar 115:Kangaskhan 121:Starmie 127:Pinsir 128:Tauros 130:Gyarados 132:Ditto 134:Vaporeon 135:Jolteon 136:Flareon 142:Aerodactyl 143:Snorlax 149:Dragonite 154:Meganium 157:Typhlosion 160:Feraligatr 168:Ariados 181:Ampharos 184:Azumarill 186:Politoed 196:Espeon 197:Umbreon 199:Slowking 205:Forretress 208:Steelix 211:Qwilfish 212:Scizor 214:Heracross 227:Skarmory 229:Houndoom 248:Tyranitar 254:Sceptile 257:Blaziken 260:Swampert 279:Pelipper 282:Gardevoir 302:Sableye 303:Mawile 306:Aggron 308:Medicham 310:Manectric 317:Swalot 319:Sharpedo 323:Camerupt 324:Torkoal 334:Altaria 350:Milotic 351:Castform 354:Banette 358:Chimecho 359:Absol 362:Glalie 373:Salamence 376:Metagross 389:Torterra 392:Infernape 395:Empoleon 398:Staraptor 405:Luxray 407:Roserade 409:Rampardos 411:Bastiodon 428:Lopunny 442:Spiritomb 445:Garchomp 448:Lucario 450:Hippowdon 454:Toxicroak 460:Abomasnow 461:Weavile 464:Rhyperior 470:Leafeon 471:Glaceon 472:Gliscor 473:Mamoswine 475:Gallade 478:Froslass 479:Rotom 497:Serperior 500:Emboar 503:Samurott 505:Watchog 510:Liepard 512:Simisage 514:Simisear 516:Simipour 518:Musharna 530:Excadrill 531:Audino 534:Conkeldurr 545:Scolipede 547:Whimsicott 553:Krookodile 560:Scrafty 563:Cofagrigus 569:Garbodor 571:Zoroark 579:Reuniclus 584:Vanilluxe 587:Emolga 604:Eelektross 609:Chandelure 614:Beartic 618:Stunfisk 623:Golurk 635:Hydreigon 637:Volcarona 652:Chesnaught 655:Delphox 658:Greninja 660:Diggersby 663:Talonflame 666:Vivillon 668:Pyroar 670:Floette 671:Florges 673:Gogoat 675:Pangoro 676:Furfrou 678:Meowstic 681:Aegislash 683:Aromatisse 685:Slurpuff 687:Malamar 689:Barbaracle 691:Dragalge 693:Clawitzer 695:Heliolisk 697:Tyrantrum 699:Aurorus 700:Sylveon 701:Hawlucha 702:Dedenne 706:Goodra 707:Klefki 709:Trevenant 711:Gourgeist 713:Avalugg 715:Noivern 724:Decidueye 727:Incineroar 730:Primarina 733:Toucannon 740:Crabominable 745:Lycanroc 748:Toxapex 750:Mudsdale 752:Araquanid 758:Salazzle 763:Tsareena 765:Oranguru 766:Passimian 768:Golisopod 778:Mimikyu 780:Drampa 784:Kommo-o 812:Rillaboom 815:Cinderace 818:Inteleon 823:Corviknight 828:Thievul 841:Flapple 842:Appletun 844:Sandaconda 849:Toxtricity 853:Grapploct 855:Polteageist 858:Hatterene 861:Grimmsnarl 863:Perrserker 867:Runerigus 869:Alcremie 870:Falinks 871:Pincurchin 876:Indeedee 877:Morpeko 887:Dragapult 899:Wyrdeer 900:Kleavor 902:Basculegion 903:Sneasler 904:Overqwil 908:Meowscarada 911:Skeledirge 914:Quaquaval 923:Pawmot 925:Maushold 930:Arboliva 931:Squawkabilly 934:Garganacl 936:Armarouge 937:Ceruledge 939:Bellibolt 943:Mabosstiff 952:Scovillain 956:Espathra 959:Tinkaton 964:Palafin 968:Orthworm 970:Glimmora 972:Houndstone 979:Annihilape 981:Farigiraf 983:Kingambit 998:Baxcalibur 1000:Gholdengo 1013:Sinistcha 1018:Archaludon 1019:Hydrapple

To turn this into `prisma/champions-m-c.json`, convert each `dex:name` pair into `{ "dex": 3, "name": "Venusaur" }` inside one JSON array. The zip from the earlier build already contains that file.