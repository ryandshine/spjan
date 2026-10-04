import path from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

/**
 * Terapkan migrations/*.sql yang belum tercatat di tabel pgmigrations.
 * Idempoten dan memakai advisory lock bawaan node-pg-migrate, jadi aman
 * dipanggil di setiap boot container. Tidak membaca config agar bisa dipakai
 * dari global setup tes.
 */
export async function runMigrations(databaseUrl: string, opts: { senyap?: boolean } = {}): Promise<string[]> {
  const applied = await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    migrationsTable: "pgmigrations",
    direction: "up",
    log: (msg: string) => {
      if (!opts.senyap) console.log(`[migrate] ${msg}`);
    },
  });
  return applied.map((m) => m.name);
}

export { MIGRATIONS_DIR };
