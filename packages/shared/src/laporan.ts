import { z } from "zod";

const judulPendek = z.string().max(300);
const teksPanjang = z.string().max(10_000);
const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idBagian = z.string().min(1).max(40);

export const BlokSchema = z.discriminatedUnion("tipe", [
  z.object({ tipe: z.literal("paragraf"), teks: teksPanjang }),
  z.object({ tipe: z.literal("subjudul"), teks: judulPendek }),
  z.object({ tipe: z.literal("daftar"), butir: z.array(teksPanjang).max(100) }),
  z.object({ tipe: z.literal("nomor"), butir: z.array(teksPanjang).max(100) }),
]);
export type Blok = z.infer<typeof BlokSchema>;
const DaftarBlok = z.array(BlokSchema).max(200);

const BarisTataWaktu = z.object({ kegiatan: z.array(judulPendek).max(20), tanggal: judulPendek });
export type BarisTataWaktuLaporan = z.infer<typeof BarisTataWaktu>;

const teksOtomatis = <J extends "dasar" | "maksud" | "tempat" | "lama">(jenis: J) =>
  z.object({ id: idBagian, jenis: z.literal(jenis), judul: judulPendek, ganti: DaftarBlok.nullable() });

export const BagianSchema = z.discriminatedUnion("jenis", [
  z.object({ id: idBagian, jenis: z.literal("sampul"), judul: judulPendek.nullish(), tanggal: tanggalIso.nullish() }),
  z.object({
    id: idBagian,
    jenis: z.literal("petugas"),
    judul: judulPendek,
    instansi: z.array(z.object({ kunci: judulPendek, instansi: judulPendek })).max(30),
  }),
  z.object({ id: idBagian, jenis: z.literal("dokumentasi"), judul: judulPendek }),
  teksOtomatis("dasar"),
  teksOtomatis("maksud"),
  teksOtomatis("tempat"),
  teksOtomatis("lama"),
  z.object({ id: idBagian, jenis: z.literal("tatawaktu"), judul: judulPendek, ganti: z.array(BarisTataWaktu).max(100).nullable() }),
  z.object({ id: idBagian, jenis: z.literal("teks"), judul: judulPendek, blok: DaftarBlok }),
]);
export type Bagian = z.infer<typeof BagianSchema>;

export const LaporanIsiSchema = z
  .object({ versi: z.literal(1), bagian: z.array(BagianSchema).min(1).max(40) })
  .refine((v) => new Set(v.bagian.map((b) => b.id)).size === v.bagian.length, { message: "id bagian harus unik" });
export type LaporanIsi = z.infer<typeof LaporanIsiSchema>;

const p = (teks = ""): Blok => ({ tipe: "paragraf", teks });
const sj = (teks: string): Blok => ({ tipe: "subjudul", teks });

/** Template "Pengawasan PS": semua bagian otomatis belum ditimpa (`ganti: null`), bagian narasi kosong. */
export function buatLaporanAwal(): LaporanIsi {
  return {
    versi: 1,
    bagian: [
      { id: "sampul", jenis: "sampul", judul: null, tanggal: null },
      { id: "dasar", jenis: "dasar", judul: "Dasar Penugasan", ganti: null },
      { id: "petugas", jenis: "petugas", judul: "Petugas yang Melaksanakan Perjalanan Dinas", instansi: [] },
      { id: "maksud", jenis: "maksud", judul: "Maksud dan Tujuan Perjalanan Dinas", ganti: null },
      { id: "tempat", jenis: "tempat", judul: "Tempat yang Dikunjungi", ganti: null },
      { id: "lama", jenis: "lama", judul: "Lama Perjalanan Dinas", ganti: null },
      { id: "tatawaktu", jenis: "tatawaktu", judul: "Tata Waktu Pelaksanaan", ganti: null },
      {
        id: "hasil",
        jenis: "teks",
        judul: "Hasil Kegiatan",
        blok: [
          sj("Pelaksanaan Pengawasan"), p(),
          sj("Hasil Pengawasan"), p(),
          sj("Pemenuhan Hak"), p(),
          sj("Pelaksanaan Kewajiban Pengelolaan"), p(),
          sj("Kepatuhan terhadap Larangan"), p(),
          sj("Perlindungan Hutan dan Pengendalian Kebakaran"), p(),
        ],
      },
      {
        id: "simpulan",
        jenis: "teks",
        judul: "Kesimpulan dan Rekomendasi Tindak Lanjut",
        blok: [sj("Simpulan"), p(), sj("Saran dan Tindak Lanjut"), { tipe: "nomor", butir: [""] }],
      },
      { id: "penutup", jenis: "teks", judul: "", blok: [p("Demikian laporan ini dibuat, semoga bermanfaat.")] },
      { id: "dokumentasi", jenis: "dokumentasi", judul: "Dokumentasi Kegiatan" },
    ],
  };
}
