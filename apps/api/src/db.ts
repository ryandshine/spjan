import pg from "pg";

import { config } from "./config.js";

// DATE dikembalikan sebagai "YYYY-MM-DD", int8/numeric sebagai number.
pg.types.setTypeParser(1082, (value: string) => value);
pg.types.setTypeParser(20, (value: string) => Number(value));
pg.types.setTypeParser(1700, (value: string) => Number(value));

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Jaga koneksi idle tetap hidup lewat NAT/firewall; server PostgreSQL dipakai bersama proyek lain.
  keepAlive: true,
  // Batas aman agar satu kueri macet atau transaksi menggantung tidak menahan koneksi pool selamanya.
  // Hanya berlaku untuk pool ini: migrasi (node-pg-migrate) membuka koneksi sendiri lewat DATABASE_URL
  // sehingga tidak terkena batas. Kueri terberat aplikasi (seed SBM, daftar ST) jauh di bawah 30 dtk,
  // dan tidak ada transaksi yang menunggu jaringan/AI di dalamnya.
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 60_000,
});

// Tanpa listener ini, galat pada koneksi idle (DB restart, koneksi diputus) menjadi
// 'error' tak tertangani dan mematikan proses. Pool membuang klien itu dan membuat yang baru.
pool.on("error", (error) => {
  console.error("[db] galat pada koneksi idle (koneksi dibuang, pool tetap jalan):", error.message);
});

export type Db = Pick<pg.Pool, "query">;

export async function closePool(): Promise<void> {
  await pool.end();
}

/** Jalankan fungsi di dalam transaksi; rollback bila melempar galat. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let rusak = false;
  try {
    await client.query("begin");
    const hasil = await fn(client);
    await client.query("commit");
    return hasil;
  } catch (error) {
    // Bila rollback sendiri gagal (koneksi putus), buang klien dari pool dan pertahankan galat asli.
    rusak = await client.query("rollback").then(() => false, () => true);
    throw error;
  } finally {
    client.release(rusak ? true : undefined);
  }
}
