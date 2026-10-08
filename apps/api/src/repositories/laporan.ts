import type { LaporanIsi } from "@spjan/shared";

import type { Db } from "../db.js";

export interface LaporanDto {
  isi: LaporanIsi | null;
  updatedAt: string | null;
}

export async function stAda(db: Db, stId: number): Promise<boolean> {
  const { rows } = await db.query("select 1 from surat_tugas where id = $1", [stId]);
  return rows.length > 0;
}

export async function getLaporan(db: Db, stId: number): Promise<LaporanDto> {
  const { rows } = await db.query<{ isi: LaporanIsi; updated_at: Date }>("select isi, updated_at from laporan where st_id = $1", [stId]);
  const r = rows[0];
  return r ? { isi: r.isi, updatedAt: r.updated_at.toISOString() } : { isi: null, updatedAt: null };
}

export async function simpanLaporan(db: Db, stId: number, isi: LaporanIsi): Promise<LaporanDto> {
  const { rows } = await db.query<{ isi: LaporanIsi; updated_at: Date }>(
    `insert into laporan (st_id, isi) values ($1, $2)
     on conflict (st_id) do update set isi = excluded.isi, updated_at = now()
     returning isi, updated_at`,
    [stId, JSON.stringify(isi)],
  );
  const r = rows[0] as { isi: LaporanIsi; updated_at: Date };
  return { isi: r.isi, updatedAt: r.updated_at.toISOString() };
}
