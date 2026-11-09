const { loadEnvConfig } = require("@next/env");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

loadEnvConfig(process.cwd());
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for integration tests.");
let url;
try {
  url = new URL(testUrl);
} catch {
  throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
}
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !decodeURIComponent(url.pathname.slice(1)).endsWith("_test")
) {
  throw new Error("TEST_DATABASE_URL must name a PostgreSQL database ending in _test.");
}

const env = { ...process.env, DATABASE_URL: testUrl, DATABASE_URL_UNPOOLED: testUrl };
const prisma = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const migration = spawnSync(process.execPath, [prisma, "migrate", "deploy"], {
  env,
  stdio: "inherit",
});
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);
const tests = spawnSync(process.execPath, [
  "--import", "tsx", "--test", "tests\\integration\\double-elimination.test.ts",
], { env, stdio: "inherit" });
if (tests.error) throw tests.error;
process.exit(tests.status ?? 1);
