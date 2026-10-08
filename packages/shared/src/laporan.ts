import { z } from "zod";

import { DokSchema, dokDariBlok, dokKosong } from "./laporan-dokumen.js";

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
  z.object({ id: idBagian, jenis: z.literal(jenis), judul: judulPendek, ganti: DokSchema.nullable() });

const instansiBagian = z.array(z.object({ kunci: judulPendek, instansi: judulPendek })).max(30);

export const BagianSchema = z.discriminatedUnion("jenis", [
  z.object({ id: idBagian, jenis: z.literal("sampul"), judul: judulPendek.nullish(), tanggal: tanggalIso.nullish() }),
  z.object({ id: idBagian, jenis: z.literal("petugas"), judul: judulPendek, instansi: instansiBagian }),
  z.object({ id: idBagian, jenis: z.literal("dokumentasi"), judul: judulPendek }),
  teksOtomatis("dasar"),
  teksOtomatis("maksud"),
  teksOtomatis("tempat"),
  teksOtomatis("lama"),
  z.object({ id: idBagian, jenis: z.literal("tatawaktu"), judul: judulPendek, ganti: z.array(BarisTataWaktu).max(100).nullable() }),
  z.object({ id: idBagian, jenis: z.literal("teks"), judul: judulPendek, isi: DokSchema }),
]);
export type Bagian = z.infer<typeof BagianSchema>;

export const LaporanIsiSchema = z
  .object({ versi: z.literal(2), bagian: z.array(BagianSchema).min(1).max(40) })
  .refine((v) => new Set(v.bagian.map((b) => b.id)).size === v.bagian.length, { message: "id bagian harus unik" });
export type LaporanIsi = z.infer<typeof LaporanIsiSchema>;

// Bentuk lama (versi 1): blok sederhana. Hanya dibaca untuk dikonversi ke versi 2.
const teksOtomatisV1 = <J extends "dasar" | "maksud" | "tempat" | "lama">(jenis: J) =>
  z.object({ id: idBagian, jenis: z.literal(jenis), judul: judulPendek, ganti: DaftarBlok.nullable() });
const LaporanIsiV1Schema = z.object({
  versi: z.literal(1),
  bagian: z.array(
    z.discriminatedUnion("jenis", [
      z.object({ id: idBagian, jenis: z.literal("sampul"), judul: judulPendek.nullish(), tanggal: tanggalIso.nullish() }),
      z.object({ id: idBagian, jenis: z.literal("petugas"), judul: judulPendek, instansi: instansiBagian }),
      z.object({ id: idBagian, jenis: z.literal("dokumentasi"), judul: judulPendek }),
      teksOtomatisV1("dasar"),
      teksOtomatisV1("maksud"),
      teksOtomatisV1("tempat"),
      teksOtomatisV1("lama"),
      z.object({ id: idBagian, jenis: z.literal("tatawaktu"), judul: judulPendek, ganti: z.array(BarisTataWaktu).max(100).nullable() }),
      z.object({ id: idBagian, jenis: z.literal("teks"), judul: judulPendek, blok: DaftarBlok }),
    ]),
  ),
});

/** Membaca laporan tersimpan (versi 2, atau versi 1 yang dikonversi); null bila bentuknya tidak dikenal. */
export function naikkanLaporan(mentah: unknown): LaporanIsi | null {
  const baru = LaporanIsiSchema.safeParse(mentah);
  if (baru.success) return baru.data;
  const lama = LaporanIsiV1Schema.safeParse(mentah);
  if (!lama.success) return null;
  const bagian = lama.data.bagian.map((b): Bagian => {
    if (b.jenis === "teks") return { id: b.id, jenis: "teks", judul: b.judul, isi: dokDariBlok(b.blok) };
    if (b.jenis === "dasar" || b.jenis === "maksud" || b.jenis === "tempat" || b.jenis === "lama") {
      return { id: b.id, jenis: b.jenis, judul: b.judul, ganti: b.ganti ? dokDariBlok(b.ganti) : null };
    }
    return b;
  });
  const hasil = LaporanIsiSchema.safeParse({ versi: 2, bagian });
  return hasil.success ? hasil.data : null;
}


/** Template "Pengawasan PS": semua bagian otomatis belum ditimpa (`ganti: null`); bagian narasi dikosongkan agar pengguna bebas menulis. */
export function buatLaporanAwal(): LaporanIsi {
  return {
    versi: 2,
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
        isi: dokKosong(),
      },
      {
        id: "simpulan",
        jenis: "teks",
        judul: "Kesimpulan dan Rekomendasi Tindak Lanjut",
        isi: dokKosong(),
      },
      { id: "penutup", jenis: "teks", judul: "", isi: dokKosong() },
      { id: "dokumentasi", jenis: "dokumentasi", judul: "Dokumentasi Kegiatan" },
    ],
  };
}
