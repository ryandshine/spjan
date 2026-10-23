import {
  HasilEkstraksiHotelSchema,
  HasilEkstraksiStSchema,
  HasilEkstraksiTiketSchema,
  HasilEkstraksiTransportSchema,
  type JenisBerkas,
} from "@spjan/shared";
import type { z } from "zod";

import type { KonfigurasiAi } from "../ai/klien.js";
import type { Db } from "../db.js";

/** Skema hasil per jenis; hasil lama yang tidak lolos skema terkini tidak dipakai ulang. */
const SKEMA_PER_JENIS: Partial<Record<JenisBerkas, z.ZodType>> = {
  st: HasilEkstraksiStSchema,
  hotel: HasilEkstraksiHotelSchema,
  tiket: HasilEkstraksiTiketSchema,
  transport: HasilEkstraksiTransportSchema,
};

/**
 * Cari hasil ekstraksi selesai untuk isi berkas yang sama persis (sha256) di berkas lain, supaya dokumen yang
 * sama tidak membayar panggilan model dua kali. Dipakai hanya bila jenisnya sama (atau berkas ini belum
 * berjenis dan berkas lama sudah berjenis), model yang menghasilkannya masih yang dikonfigurasi, dan
 * hasilnya masih lolos skema terkini. Tidak ketemu = null (ekstraksi jalan seperti biasa).
 */
export async function cariHasilSama(
  db: Db,
  berkas: { id: number; sha256: string; jenis: JenisBerkas },
  konf: KonfigurasiAi,
): Promise<{ model: string; hasil: unknown; jenis: JenisBerkas } | null> {
  const modelAktif = [konf.modelTeks, konf.modelGambar].filter((m): m is string => !!m);
  if (modelAktif.length === 0) return null;
  const { rows } = await db.query<{ model: string; hasil: unknown; jenis: JenisBerkas }>(
    `select e.model, e.hasil, b.jenis
       from berkas b join lateral (select * from ekstraksi where berkas_id = b.id order by id desc limit 1) e on true
      where b.sha256 = $1 and b.id <> $2 and b.dihapus_pada is null
        and e.status = 'selesai' and e.hasil is not null and e.model = any($3::text[])
        and b.jenis in ('st', 'hotel', 'tiket', 'transport')
      order by e.id desc`,
    [berkas.sha256, berkas.id, modelAktif],
  );
  for (const r of rows) {
    if (berkas.jenis !== "belum" && berkas.jenis !== "lainnya" && berkas.jenis !== r.jenis) continue;
    if (SKEMA_PER_JENIS[r.jenis]?.safeParse(r.hasil).success) return r;
  }
  return null;
}
