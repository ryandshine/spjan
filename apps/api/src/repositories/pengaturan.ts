import type { PengaturanPayload } from "@spjan/shared";

import type { Db } from "../db.js";

interface Row {
  kode_satker: string;
  nama_satker: string;
  dasar_dipa: string;
  kode_akun_default: string;
  tahun_anggaran: number;
  ppk_nama: string;
  ppk_nip: string;
  bendahara_nama: string;
  bendahara_nip: string;
  pj_nama: string;
  pj_nip: string;
  pj_jabatan: string;
  pembuat_daftar_nama: string | null;
  pembuat_daftar_nip: string | null;
  kota_kedudukan: string;
  provinsi_kedudukan: string;
}

function map(r: Row): PengaturanPayload {
  return {
    kodeSatker: r.kode_satker,
    namaSatker: r.nama_satker,
    dasarDipa: r.dasar_dipa,
    kodeAkunDefault: r.kode_akun_default,
    tahunAnggaran: r.tahun_anggaran,
    ppkNama: r.ppk_nama,
    ppkNip: r.ppk_nip,
    bendaharaNama: r.bendahara_nama,
    bendaharaNip: r.bendahara_nip,
    pjNama: r.pj_nama,
    pjNip: r.pj_nip,
    pjJabatan: r.pj_jabatan,
    pembuatDaftarNama: r.pembuat_daftar_nama,
    pembuatDaftarNip: r.pembuat_daftar_nip,
    kotaKedudukan: r.kota_kedudukan,
    provinsiKedudukan: r.provinsi_kedudukan,
  };
}

export async function getPengaturan(db: Db): Promise<PengaturanPayload> {
  const { rows } = await db.query<Row>("select * from pengaturan where id = 1");
  const row = rows[0];
  if (!row) throw new Error("Baris pengaturan tidak ada (migrasi belum dijalankan?)");
  return map(row);
}

export async function savePengaturan(db: Db, p: PengaturanPayload): Promise<PengaturanPayload> {
  const { rows } = await db.query<Row>(
    `update pengaturan set
       kode_satker = $1, nama_satker = $2, dasar_dipa = $3, kode_akun_default = $4, tahun_anggaran = $5,
       ppk_nama = $6, ppk_nip = $7, bendahara_nama = $8, bendahara_nip = $9,
       pj_nama = $10, pj_nip = $11, pj_jabatan = $12,
       pembuat_daftar_nama = $13, pembuat_daftar_nip = $14,
       kota_kedudukan = $15, provinsi_kedudukan = $16, updated_at = now()
     where id = 1 returning *`,
    [
      p.kodeSatker, p.namaSatker, p.dasarDipa, p.kodeAkunDefault, p.tahunAnggaran,
      p.ppkNama, p.ppkNip, p.bendaharaNama, p.bendaharaNip,
      p.pjNama, p.pjNip, p.pjJabatan,
      p.pembuatDaftarNama ?? null, p.pembuatDaftarNip ?? null,
      p.kotaKedudukan, p.provinsiKedudukan,
    ],
  );
  return map(rows[0] as Row);
}
