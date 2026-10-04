import { SBM_2026 } from "@spjan/shared";

import type { Db } from "./db.js";

export const SBM_DASAR_HUKUM_2026 = "PMK Nomor 32 Tahun 2025";

/** Isi versi SBM 2026 bila belum ada. Tidak menimpa data yang sudah ada (konfigurasi status bisa diedit). */
export async function seedSbm(db: Db): Promise<boolean> {
  const { rowCount } = await db.query(
    `insert into sbm_versi (tahun_anggaran, dasar_hukum, aktif, data)
     values ($1, $2, true, $3::jsonb)
     on conflict (tahun_anggaran, dasar_hukum) do nothing`,
    [SBM_2026.tahunAnggaran, SBM_DASAR_HUKUM_2026, JSON.stringify(SBM_2026)],
  );
  return (rowCount ?? 0) > 0;
}
