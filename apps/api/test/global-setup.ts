import pg from "pg";

import { runMigrations } from "../src/migrate.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/spjan_test";

/** Buat ulang skema `public` di database tes, lalu terapkan semua migrasi. */
export default async function setup(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Database tes tidak bisa dihubungi (${TEST_DATABASE_URL}). Jalankan: docker compose -f docker-compose.dev.yml up -d dan buat database spjan_test. Asal galat: ${(error as Error).message}`,
    );
  }
  await client.query("drop schema public cascade; create schema public;");
  await client.end();
  await runMigrations(TEST_DATABASE_URL, { senyap: true });
}
