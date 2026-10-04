import type { Sbm, SbmVersiDto, StatusKonfigurasi, StatusKode } from "@spjan/shared";

import type { Db } from "../db.js";

interface VersiRow {
  id: number;
  tahun_anggaran: number;
  dasar_hukum: string;
  aktif: boolean;
}

const mapVersi = (r: VersiRow): SbmVersiDto => ({ id: r.id, tahunAnggaran: r.tahun_anggaran, dasarHukum: r.dasar_hukum, aktif: r.aktif });

export async function listVersiSbm(db: Db): Promise<SbmVersiDto[]> {
  const { rows } = await db.query<VersiRow>(
    "select id, tahun_anggaran, dasar_hukum, aktif from sbm_versi order by tahun_anggaran desc, id desc",
  );
  return rows.map(mapVersi);
}

export async function getVersiSbm(db: Db, id: number): Promise<{ versi: SbmVersiDto; data: Sbm } | null> {
  const { rows } = await db.query<VersiRow & { data: Sbm }>(
    "select id, tahun_anggaran, dasar_hukum, aktif, data from sbm_versi where id = $1",
    [id],
  );
  const row = rows[0];
  return row ? { versi: mapVersi(row), data: row.data } : null;
}

/** Versi aktif terbaru; dipakai sebagai versi yang di-pin pada surat tugas baru. */
export async function versiAktifTerbaru(db: Db): Promise<number | null> {
  const { rows } = await db.query<{ id: number }>(
    "select id from sbm_versi where aktif order by tahun_anggaran desc, id desc limit 1",
  );
  return rows[0]?.id ?? null;
}

export async function simpanStatusKonfigurasi(
  db: Db,
  id: number,
  konfigurasi: Record<StatusKode, StatusKonfigurasi>,
): Promise<boolean> {
  const { rowCount } = await db.query(
    "update sbm_versi set data = jsonb_set(data, '{statusKonfigurasi}', $2::jsonb) where id = $1",
    [id, JSON.stringify(konfigurasi)],
  );
  return (rowCount ?? 0) > 0;
}
