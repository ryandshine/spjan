import type { SampahDto } from "@spjan/shared";

import type { Db } from "../db.js";

export async function daftarSampah(db: Db): Promise<SampahDto> {
  const st = await db.query<{ id: number; nomor: string; tanggal: string; dihapus_pada: Date; dihapus_oleh: string | null; dibuat_oleh: string | null }>(
    `select s.id, s.nomor, s.tanggal, s.dihapus_pada, d.nama as dihapus_oleh, p.nama as dibuat_oleh
       from surat_tugas s left join users d on d.id = s.dihapus_oleh left join users p on p.id = s.dibuat_oleh
      where s.dihapus_pada is not null order by s.dihapus_pada desc`,
  );
  // Berkas milik ST yang sendiri sudah di tempat sampah ikut dipulihkan/dihapus bersama STnya, jadi tidak dicantumkan terpisah.
  const berkas = await db.query<{ id: number; st_id: number | null; nama_asli: string; jenis: string; dihapus_pada: Date; dihapus_oleh: string | null }>(
    `select b.id, b.st_id, b.nama_asli, b.jenis, b.dihapus_pada, d.nama as dihapus_oleh
       from berkas b left join users d on d.id = b.dihapus_oleh left join surat_tugas s on s.id = b.st_id
      where b.dihapus_pada is not null and (s.id is null or s.dihapus_pada is null) order by b.dihapus_pada desc`,
  );
  return {
    suratTugas: st.rows.map((r) => ({ id: r.id, nomor: r.nomor, tanggal: r.tanggal, dihapusPada: r.dihapus_pada.toISOString(), dihapusOleh: r.dihapus_oleh, dibuatOleh: r.dibuat_oleh })),
    berkas: berkas.rows.map((r) => ({ id: r.id, stId: r.st_id, namaAsli: r.nama_asli, jenis: r.jenis, dihapusPada: r.dihapus_pada.toISOString(), dihapusOleh: r.dihapus_oleh })),
  };
}
