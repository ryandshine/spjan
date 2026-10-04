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
});

export type Db = Pick<pg.Pool, "query">;

export async function closePool(): Promise<void> {
  await pool.end();
}

/** Jalankan fungsi di dalam transaksi; rollback bila melempar galat. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const hasil = await fn(client);
    await client.query("commit");
    return hasil;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
