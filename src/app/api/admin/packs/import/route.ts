import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePackDataCache } from "@/lib/pack-data";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_PACK_ROWS = 5000;
const MAX_DROP_ITEMS = 5000;
const REQUIRED_HEADERS = ["packName", "description", "price", "isGlobal", "pokemonList"] as const;
const OPTIONAL_HEADERS = ["spriteUrl", "showInPractice"] as const;

type CsvRecord = { line: number; values: string[] };
type CsvPackItem = {
  pokemonName: string;
  rarity: string;
  rarityKey: string;
  dropWeight: string;
};
type CsvPack = {
  line: number;
  name: string;
  description: string;
  spriteUrl: string;
  showInPractice: boolean;
  items: CsvPackItem[];
};

function parseCsv(input: string): { records?: CsvRecord[]; error?: string } {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let value = "";
  let line = 1;
  let recordLine = 1;
  let inQuotes = false;
  let afterQuote = false;
  let hasContent = false;

  function finishField() {
    values.push(value);
    value = "";
    afterQuote = false;
  }

  function finishRecord() {
    finishField();
    if (values.some((cell) => cell.trim() !== "")) {
      records.push({ line: recordLine, values });
    }
    values = [];
    hasContent = false;
    recordLine = line + 1;
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (character === "\r" || character === "\n") {
        value += "\n";
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        line += 1;
      } else {
        value += character;
      }
      hasContent = true;
      continue;
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n" && character !== " " && character !== "\t") {
      return { error: `Line ${line}: unexpected character after a quoted CSV value.` };
    }
    if (afterQuote && (character === " " || character === "\t")) continue;

    if (character === '"') {
      if (value.length > 0) {
        return { error: `Line ${line}: quote found inside an unquoted CSV value.` };
      }
      inQuotes = true;
      hasContent = true;
    } else if (character === ",") {
      finishField();
      hasContent = true;
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      recordLine = line;
    } else {
      value += character;
      if (character.trim() !== "") hasContent = true;
    }
  }

  if (inQuotes) return { error: `Line ${recordLine}: quoted CSV value was not closed.` };
  if (hasContent || values.length > 0 || value.length > 0) finishRecord();
  if (records.length === 0) return { error: "The CSV file is empty." };
  return { records };
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function validHttpsUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function rowValue(record: CsvRecord, headerIndexes: Map<string, number>, header: string): string {
  const index = headerIndexes.get(header);
  return index === undefined ? "" : record.values[index]?.trim() ?? "";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid CSV file." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a non-empty CSV file." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "CSV files must be 2 MB or smaller." }, { status: 413 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Choose a file with the .csv extension." }, { status: 400 });
  }
  const mode = formData.get("mode") ?? "import";
  if (mode !== "preview" && mode !== "import") {
    return NextResponse.json({ error: "Choose a valid import action." }, { status: 400 });
  }

  const parsedCsv = parseCsv(await file.text());
  if (!parsedCsv.records) {
    return NextResponse.json({ errors: [parsedCsv.error ?? "The CSV could not be parsed."] }, { status: 400 });
  }
  const [headerRecord, ...dataRecords] = parsedCsv.records;
  const headers = headerRecord.values.map((header) => header.trim().toLowerCase());
  const errors: string[] = [];
  const headerIndexes = new Map<string, number>();
  headers.forEach((header, index) => {
    if (!header) errors.push(`Line ${headerRecord.line}: column ${index + 1} has no header.`);
    else if (headerIndexes.has(header)) errors.push(`Line ${headerRecord.line}: duplicate column "${header}".`);
    else headerIndexes.set(header, index);
  });
  for (const header of REQUIRED_HEADERS) {
    if (!headerIndexes.has(header.toLowerCase())) errors.push(`Missing required column "${header}".`);
  }
  for (const header of headers) {
    if (
      header &&
      ![
        ...REQUIRED_HEADERS.map((required) => required.toLowerCase()),
        ...OPTIONAL_HEADERS.map((optional) => optional.toLowerCase()),
      ].includes(header)
    ) {
      errors.push(`Unexpected column "${header}".`);
    }
  }
  if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });
  if (dataRecords.length === 0) {
    return NextResponse.json({ errors: ["Add at least one pack row after the header."] }, { status: 400 });
  }
  if (dataRecords.length > MAX_PACK_ROWS) {
    return NextResponse.json({ errors: [`The CSV may contain no more than ${MAX_PACK_ROWS} pack rows.`] }, { status: 400 });
  }

  const packs: CsvPack[] = [];
  const seenPackNames = new Set<string>();
  let totalItems = 0;

  for (const record of dataRecords) {
    if (record.values.length !== headers.length) {
      errors.push(`Line ${record.line}: expected ${headers.length} columns but found ${record.values.length}.`);
      continue;
    }

    const name = rowValue(record, headerIndexes, "packname");
    const description = rowValue(record, headerIndexes, "description");
    const rawPrice = rowValue(record, headerIndexes, "price");
    const isGlobal = parseBoolean(rowValue(record, headerIndexes, "isglobal"));
    const pokemonList = rowValue(record, headerIndexes, "pokemonlist");
    const spriteUrl = rowValue(record, headerIndexes, "spriteurl");
    const showInPractice = headerIndexes.has("showinpractice")
      ? parseBoolean(rowValue(record, headerIndexes, "showinpractice"))
      : true;
    const price = /^\d+$/.test(rawPrice) ? Number(rawPrice) : Number.NaN;

    if (!name || name.length > 80) errors.push(`Line ${record.line}: pack name must contain 1–80 characters.`);
    if (description.length > 5000) errors.push(`Line ${record.line}: description cannot exceed 5,000 characters.`);
    if (!Number.isSafeInteger(price) || price < 0 || price > 2_147_483_647) {
      errors.push(`Line ${record.line}: price must be a non-negative whole number.`);
    }
    if (isGlobal !== true) errors.push(`Line ${record.line}: isGlobal must be true for a global pack import.`);
    if (showInPractice === undefined) {
      errors.push(`Line ${record.line}: showInPractice must be true or false.`);
    }
    if (spriteUrl && !validHttpsUrl(spriteUrl)) {
      errors.push(`Line ${record.line}: spriteUrl must be an HTTPS URL no longer than 2,048 characters.`);
    }

    const normalizedPackName = name.toLowerCase();
    if (normalizedPackName) {
      if (seenPackNames.has(normalizedPackName)) {
        errors.push(`Line ${record.line}: pack "${name}" appears more than once; use one row per pack.`);
      }
      seenPackNames.add(normalizedPackName);
    }

    const items: CsvPackItem[] = [];
    const seenPokemon = new Set<string>();
    const tierWeights = new Map<string, string>();
    const rawItems = pokemonList.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
    if (rawItems.length === 0) {
      errors.push(`Line ${record.line}: pokemonList must contain at least one Pokémon drop.`);
    }

    for (const rawItem of rawItems) {
      const parts = rawItem.split(":").map((part) => part.trim());
      if (parts.length !== 3) {
        errors.push(`Line ${record.line}: invalid drop "${rawItem}"; use pokemonName:rarity:dropWeight.`);
        continue;
      }
      const [pokemonName, rarity, rawDropWeight] = parts;
      const rarityKey = rarity.toLowerCase();
      const validWeightFormat = /^\d+(?:\.\d{1,4})?$/.test(rawDropWeight);
      const dropWeight = Number(rawDropWeight);

      if (!pokemonName || pokemonName.length > 80) {
        errors.push(`Line ${record.line}: Pokémon name must contain 1–80 characters.`);
      }
      if (!rarity || rarity.length > 40) errors.push(`Line ${record.line}: rarity must contain 1–40 characters.`);
      if (!validWeightFormat) {
        errors.push(`Line ${record.line}: dropWeight must be a positive number with no more than 4 decimal places.`);
      } else if (dropWeight <= 0 || dropWeight >= 1_000_000) {
        errors.push(`Line ${record.line}: dropWeight must be greater than 0 and less than 1,000,000.`);
      }

      const normalizedPokemon = pokemonName.toLowerCase();
      if (normalizedPokemon) {
        if (seenPokemon.has(normalizedPokemon)) {
          errors.push(`Line ${record.line}: Pokémon "${pokemonName}" appears more than once in this pack.`);
        }
        seenPokemon.add(normalizedPokemon);
      }
      if (rarityKey && validWeightFormat && dropWeight > 0 && dropWeight < 1_000_000) {
        const normalizedWeight = dropWeight.toFixed(4);
        const existingWeight = tierWeights.get(rarityKey);
        if (existingWeight !== undefined && existingWeight !== normalizedWeight) {
          errors.push(`Line ${record.line}: rarity "${rarity}" must use the same dropWeight throughout this pack.`);
        } else {
          tierWeights.set(rarityKey, normalizedWeight);
        }
      }
      items.push({
        pokemonName,
        rarity,
        rarityKey,
        dropWeight: Number.isFinite(dropWeight) ? dropWeight.toFixed(4) : "0",
      });
    }

    totalItems += items.length;
    if (totalItems > MAX_DROP_ITEMS) {
      errors.push(`The CSV may contain no more than ${MAX_DROP_ITEMS} Pokémon drops in total.`);
      break;
    }
    packs.push({
      line: record.line,
      name,
      description,
      spriteUrl,
      showInPractice: showInPractice ?? true,
      items,
    });
  }

  if (errors.length > 0) return NextResponse.json({ errors: errors.slice(0, 100) }, { status: 400 });

  const species = await prisma.species.findMany({ select: { dex: true, name: true, isMega: true } });
  const speciesByName = new Map(species.map((entry) => [entry.name.toLowerCase(), entry]));
  const resolvedPacks = packs.map((pack) => ({
    ...pack,
    items: pack.items.map((item) => {
      const pokemon = speciesByName.get(item.pokemonName.toLowerCase());
      if (!pokemon) {
        errors.push(`Line ${pack.line}: Pokémon "${item.pokemonName}" was not found in the species catalog.`);
      }
      return { ...item, speciesDex: pokemon?.dex, isMega: pokemon?.isMega ?? false };
    }),
  }));
  if (errors.length > 0) return NextResponse.json({ errors: errors.slice(0, 100) }, { status: 400 });

  const megaFormCount = resolvedPacks.reduce(
    (count, pack) => count + pack.items.filter((item) => item.isMega).length,
    0,
  );
  if (mode === "preview") {
    return NextResponse.json({
      success: true,
      preview: { packCount: resolvedPacks.length, dropItemCount: totalItems, megaFormCount },
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const packData of resolvedPacks) {
        const pack = await tx.pack.create({
          data: {
            name: packData.name,
            description: packData.description,
            pullCount: 1,
            showInPractice: packData.showInPractice,
          },
        });
        const tierIds = new Map<string, string>();
        const tierWeights = new Map<string, string>();

        for (const item of packData.items) {
          if (!tierWeights.has(item.rarityKey)) tierWeights.set(item.rarityKey, item.dropWeight);
        }
        for (const [rarityKey, weight] of tierWeights) {
          const item = packData.items.find((entry) => entry.rarityKey === rarityKey)!;
          const tier = await tx.packTier.create({
            data: {
              packId: pack.id,
              name: item.rarity,
              weight: new Prisma.Decimal(weight),
              color: "#9FB0E6",
              minimumOne: false,
            },
          });
          tierIds.set(rarityKey, tier.id);
        }

        await tx.packEntry.createMany({
          data: packData.items.map((item) => ({
            packId: pack.id,
            speciesDex: item.speciesDex!,
            tierId: tierIds.get(item.rarityKey)!,
          })),
        });

        if (packData.spriteUrl) {
          for (const item of packData.items) {
            await tx.species.update({
              where: { dex: item.speciesDex! },
              data: { imageUrl: packData.spriteUrl },
            });
          }
        }
      }
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    console.error("Pack CSV import failed:", error);
    return NextResponse.json({ error: "The packs could not be saved. No changes were committed; please try again." }, { status: 500 });
  }

  revalidatePackDataCache();
  return NextResponse.json({
    success: true,
    imported: { packCount: resolvedPacks.length, dropItemCount: totalItems, megaFormCount },
  }, { status: 201 });
}
