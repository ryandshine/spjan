import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.js";
import { ensureAdmin } from "../auth.js";
import { pool } from "../db.js";
import { seedSbm } from "../seed.js";

export async function siapkanApp(): Promise<FastifyInstance> {
  await seedSbm(pool);
  await ensureAdmin(pool);
  return buildApp(pool, { logger: false });
}

export async function bersihkanData(): Promise<void> {
  await pool.query("truncate surat_tugas, pegawai restart identity cascade");
  await pool.query("truncate berkas, ekstraksi restart identity cascade");
  await pool.query("update model_ai set llm_url = null, model_teks = 'gpt-oss:120b-cloud', model_gambar = null where id = 1");
  await pool.query(
    `update pengaturan set kode_satker = '', nama_satker = '', ppk_nama = '', kota_kedudukan = 'Jakarta',
       provinsi_kedudukan = 'D.K.I. JAKARTA', pembuat_daftar_nama = null, pembuat_daftar_nip = null where id = 1`,
  );
}

/** Login sebagai admin uji dan kembalikan header Cookie. */
export async function loginCookie(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "admin", password: "sandi-uji-12345" },
  });
  const set = res.headers["set-cookie"];
  const raw = Array.isArray(set) ? set[0] : set;
  if (res.statusCode !== 200 || !raw) throw new Error(`login uji gagal: ${res.statusCode} ${res.body}`);
  return raw.split(";")[0] as string;
}

export const stResa = {
  nomor: "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026",
  tanggal: "2026-09-08",
  tanggalSpj: null,
  kodeAkun: "7288.QDD.001.052.A.524111",
  catatan: "",
  pelaksana: [
    {
      pegawaiId: null,
      nama: "R Resa Adam Gunawan, S.T.",
      nip: "199508222023211008",
      jabatan: "Surveyor Pemetaan Ahli Pertama",
      status: "ESELON_IV_GOL_III_II_I" as const,
      noSpd: "403/SPD/PPS/2026",
      etape: [
        {
          provinsi: "BALI",
          kota: "Denpasar",
          kegiatan: "Pendampingan Audiensi",
          berangkat: "2026-09-10",
          pulang: "2026-09-11",
          malamOverride: null,
          hotelNama: "Kuto Paradiso Hotel",
          hotelTarif: 1_021_948,
          dinasJabatan: false,
        },
      ],
      biaya: [
        { jenis: "TIKET_PERGI" as const, provinsi: null, uraian: null, qty: null, satuan: null, tarif: 2_260_940, keterangan: null, etapeIndex: null },
        { jenis: "TIKET_KEMBALI" as const, provinsi: null, uraian: null, qty: null, satuan: null, tarif: 2_223_091, keterangan: null, etapeIndex: null },
        { jenis: "TAKSI_KEDUDUKAN" as const, provinsi: null, uraian: null, qty: 2, satuan: null, tarif: 250_000, keterangan: null, etapeIndex: null },
      ],
    },
  ],
};
