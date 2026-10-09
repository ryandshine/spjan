import type { FastifyInstance } from "fastify";

import { AiGalat, type KlienAi, type PermintaanAi } from "../ai/klien.js";
import { buildApp } from "../app.js";
import { ensureAdmin } from "../auth.js";
import type { BerkasStore } from "../berkas/store.js";
import { pool } from "../db.js";
import { seedSbm } from "../seed.js";

export async function siapkanApp(opts: { store?: BerkasStore; klien?: KlienAi } = {}): Promise<FastifyInstance> {
  await seedSbm(pool);
  await ensureAdmin(pool);
  return buildApp(pool, { logger: false, ...opts });
}

export async function bersihkanData(): Promise<void> {
  await pool.query("truncate surat_tugas, pegawai restart identity cascade");
  await pool.query("truncate berkas, ekstraksi restart identity cascade");
  await pool.query("truncate log_audit restart identity");
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
  tahunAnggaran: null,
  sumberDana: "RM" as const,
  pjNama: null,
  pjNip: null,
  pjJabatan: null,
  pelaksana: [
    {
      pegawaiId: null,
      nama: "R Resa Adam Gunawan, S.T.",
      nip: "199508222023211008",
      jabatan: "Surveyor Pemetaan Ahli Pertama",
      status: "ESELON_IV_GOL_III_II_I" as const,
      noSpd: "403/SPD/PPS/2026",
      tanggalSpd: null,
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
          fullboardDates: [],
          hotel30Persen: false,
          dalamKota8Jam: false,
        },
      ],
      biaya: [
        { jenis: "TIKET_PERGI" as const, provinsi: null, uraian: null, qty: null, satuan: null, tarif: 2_260_940, keterangan: null, etapeIndex: null, pengeluaranRiil: false },
        { jenis: "TIKET_KEMBALI" as const, provinsi: null, uraian: null, qty: null, satuan: null, tarif: 2_223_091, keterangan: null, etapeIndex: null, pengeluaranRiil: false },
        { jenis: "TAKSI_KEDUDUKAN" as const, provinsi: null, uraian: null, qty: 2, satuan: null, tarif: 250_000, keterangan: null, etapeIndex: null, pengeluaranRiil: false },
      ],
    },
  ],
};

/** PNG 1x1 yang sah. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

/** PNG sah dengan isi berbeda untuk setiap n (byte tambahan setelah IEND diabaikan pembaca gambar). */
export const pngUnik = (n: number): Buffer => Buffer.concat([PNG_1X1, Buffer.from([n % 256, Math.floor(n / 256)])]);

export function bodyMultipart(nama: string, isi: Buffer): { payload: Buffer; headers: { "content-type": string } } {
  const batas = `----spjantest${Math.random().toString(16).slice(2)}`;
  const kepala = Buffer.from(
    `--${batas}\r\nContent-Disposition: form-data; name="berkas"; filename="${nama}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const ekor = Buffer.from(`\r\n--${batas}--\r\n`);
  return { payload: Buffer.concat([kepala, isi, ekor]), headers: { "content-type": `multipart/form-data; boundary=${batas}` } };
}

/** PDF satu halaman. Teks kosong menghasilkan halaman tanpa lapisan teks (meniru hasil pindai). Teks hanya ASCII. */
export function pdfSederhana(teks: string, ukuranFont?: number): Buffer {
  const bersih = teks.replace(/[()\\]/g, "");
  let isi = "";
  if (bersih && ukuranFont === undefined) {
    isi = `BT /F1 12 Tf 50 750 Td (${bersih}) Tj ET`;
  } else if (bersih && ukuranFont !== undefined) {
    // Teks panjang dibungkus per baris agar tidak terpotong di tepi halaman (pdftotext memangkas yang di luar halaman).
    const perBaris = Math.floor(500 / (ukuranFont * 0.55));
    const baris = bersih.match(new RegExp(`.{1,${perBaris}}`, "g")) ?? [];
    isi = `BT /F1 ${ukuranFont} Tf ${ukuranFont * 1.2} TL 50 800 Td ${baris.map((b) => `(${b}) '`).join(" ")} ET`;
  }
  const objek = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${isi.length} >>\nstream\n${isi}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offset: number[] = [];
  objek.forEach((o, i) => {
    offset.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
  out += offset.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Klien palsu: `balas` menerima permintaan dan mengembalikan teks balasan, atau melempar AiGalat. */
export function klienPalsu(balas: (p: PermintaanAi, panggilanKe: number) => string | Promise<string>): KlienAi & { panggilan: PermintaanAi[] } {
  const panggilan: PermintaanAi[] = [];
  return {
    panggilan,
    async chat(p) {
      panggilan.push(p);
      return balas(p, panggilan.length);
    },
  };
}
export { AiGalat };
