import { z } from "zod";
import { JENIS_BIAYA, STATUS_KODE } from "./types.js";
import type { Sbm, SpjHasil, SpjInput } from "./types.js";

const teks = (max: number) => z.string().max(max);
const rupiah = z.number().int().min(0).max(1_000_000_000_000);
const tanggalOpsional = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Format tanggal YYYY-MM-DD");
const tanggalWajib = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD");

export const StatusKodeSchema = z.enum(STATUS_KODE);

export const EtapePayloadSchema = z.object({
  provinsi: teks(100),
  kota: teks(100),
  kegiatan: teks(1000),
  berangkat: tanggalOpsional,
  pulang: tanggalOpsional,
  malamOverride: z.number().int().min(0).max(365).nullish(),
  hotelNama: teks(200).nullish(),
  hotelTarif: rupiah.nullish(),
  dinasJabatan: z.boolean().optional(),
  fullboardDates: z.array(tanggalWajib).optional(),
  hotel30Persen: z.boolean().nullish(),
  dalamKota8Jam: z.boolean().nullish(),
});

export const BiayaPayloadSchema = z.object({
  jenis: z.enum(JENIS_BIAYA),
  provinsi: teks(100).nullish(),
  uraian: teks(300).nullish(),
  qty: z.number().int().min(1).max(1000).nullish(),
  satuan: teks(30).nullish(),
  tarif: rupiah,
  keterangan: teks(300).nullish(),
  etapeIndex: z.number().int().min(0).max(19).nullish(),
  pengeluaranRiil: z.boolean().nullish(),
});

/** Instansi bawaan seluruh pegawai Direktorat Pengendalian Perhutanan Sosial. */
export const INSTANSI_BAWAAN = "Direktorat Pengendalian Perhutanan Sosial";

export const PelaksanaPayloadSchema = z.object({
  pegawaiId: z.number().int().positive().nullish(),
  nama: teks(200).min(1),
  nip: teks(30),
  jabatan: teks(200),
  /** Kosong/tidak dikirim = INSTANSI_BAWAAN saat disimpan. */
  instansi: teks(200).optional(),
  /** Teks bebas, mis. "Penata Muda - III/a" atau "Ahli Pertama - IX"; tampil pada butir 3a SPD. */
  pangkatGolongan: teks(100).optional(),
  status: StatusKodeSchema.nullable(),
  noSpd: teks(100).nullish(),
  tanggalSpd: tanggalWajib.nullish(),
  etape: z.array(EtapePayloadSchema).max(20),
  biaya: z.array(BiayaPayloadSchema).max(60),
});

export const SumberDanaSchema = z.enum(["RM", "PNBP"]);
export type SumberDana = z.infer<typeof SumberDanaSchema>;

export const SuratTugasPayloadSchema = z.object({
  nomor: teks(200).min(1),
  tanggal: tanggalWajib,
  tanggalSpj: tanggalWajib.nullish(),
  kodeAkun: teks(100),
  catatan: teks(2000),
  pelaksana: z.array(PelaksanaPayloadSchema).max(30),
  tahunAnggaran: z.number().int().min(2000).max(2100).nullish(),
  sumberDana: SumberDanaSchema.nullish(),
  pjNama: teks(200).nullish(),
  pjNip: teks(60).nullish(),
  pjJabatan: teks(200).nullish(),
});
export type EtapePayload = z.infer<typeof EtapePayloadSchema>;
export type BiayaPayload = z.infer<typeof BiayaPayloadSchema>;
export type PelaksanaPayload = z.infer<typeof PelaksanaPayloadSchema>;
export type SuratTugasPayload = z.infer<typeof SuratTugasPayloadSchema>;

export const PengaturanSchema = z.object({
  kodeSatker: teks(30),
  namaSatker: teks(300),
  dasarDipa: teks(300),
  kodeAkunDefault: teks(100),
  tahunAnggaran: z.number().int().min(2000).max(2100),
  ppkNama: teks(200),
  ppkNip: teks(60),
  bendaharaNama: teks(200),
  bendaharaNip: teks(60),
  pjNama: teks(200),
  pjNip: teks(60),
  pjJabatan: teks(200),
  pembuatDaftarNama: teks(200).nullish(),
  pembuatDaftarNip: teks(60).nullish(),
  kotaKedudukan: teks(100).min(1),
  provinsiKedudukan: teks(100).min(1),
});
export type PengaturanPayload = z.infer<typeof PengaturanSchema>;

export const PegawaiPayloadSchema = z.object({
  nama: teks(200).min(1),
  nip: z.string().regex(/^\d{8,30}$/, "NIP berupa angka (8-30 digit)"),
  jabatan: teks(200),
  /** Tidak dikirim = INSTANSI_BAWAAN saat disimpan. */
  instansi: teks(200).optional(),
  pangkatGolongan: teks(100).optional(),
  status: StatusKodeSchema.nullable(),
});
export type PegawaiPayload = z.infer<typeof PegawaiPayloadSchema>;

const kolomHotel = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const barisRepresentasi = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const StatusKonfigurasiSchema = z.object({
  kolomHotel,
  barisRepresentasi,
  kelasTiket: z.enum(["Bisnis", "Ekonomi"]),
});
export const StatusKonfigurasiMapSchema = z.object({
  PEJABAT_NEGARA_WAMEN: StatusKonfigurasiSchema,
  ESELON_I: StatusKonfigurasiSchema,
  ESELON_II: StatusKonfigurasiSchema,
  ESELON_III_GOL_IV: StatusKonfigurasiSchema,
  ESELON_IV_GOL_III_II_I: StatusKonfigurasiSchema,
});

export const LoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export type StatusSt = "draft" | "final";

export const PERAN = ["admin", "operator"] as const;
export type Peran = (typeof PERAN)[number];

/** Pengguna yang sedang login (GET /api/auth/me dan respons login). */
export interface PenggunaSesiDto {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
}

export interface PenggunaDto extends PenggunaSesiDto {
  aktif: boolean;
  createdAt: string;
}

const PasswordBaru = z.string().min(10, "Minimal 10 karakter.").max(200);

export const BuatPenggunaSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,50}$/, "3-50 karakter: huruf kecil, angka, titik, garis bawah, atau strip."),
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(100),
  peran: z.enum(PERAN),
  password: PasswordBaru,
});
export type BuatPenggunaPayload = z.infer<typeof BuatPenggunaSchema>;

export const UbahPenggunaSchema = z
  .object({ nama: z.string().trim().min(1).max(100), peran: z.enum(PERAN), aktif: z.boolean() })
  .partial();
export type UbahPenggunaPayload = z.infer<typeof UbahPenggunaSchema>;

export const ResetPasswordSchema = z.object({ password: PasswordBaru });
export const GantiPasswordSchema = z.object({ passwordLama: z.string().min(1).max(200), passwordBaru: PasswordBaru });
export type GantiPasswordPayload = z.infer<typeof GantiPasswordSchema>;

/** Konfirmasi aksi berbahaya dengan password pengguna sendiri. */
export const KonfirmasiPasswordSchema = z.object({ password: z.string().min(1).max(200) });
export const BukaKunciSchema = z.object({
  password: z.string().min(1).max(200),
  alasan: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(500),
});
export type BukaKunciPayload = z.infer<typeof BukaKunciSchema>;

export interface LogAuditDto {
  id: number;
  waktu: string;
  username: string;
  aksi: string;
  entitas: string;
  entitasId: number | null;
  stId: number | null;
  alasan: string | null;
  detail: unknown;
}

export interface SampahDto {
  suratTugas: { id: number; nomor: string; tanggal: string; dihapusPada: string; dihapusOleh: string | null; dibuatOleh: string | null }[];
  berkas: { id: number; stId: number | null; namaAsli: string; jenis: string; dihapusPada: string; dihapusOleh: string | null }[];
}

export interface SuratTugasDto extends SuratTugasPayload {
  id: number;
  versiSbmId: number;
  /** `final` = terkunci: tidak bisa diubah/dihapus sampai kunci dibuka. */
  status: StatusSt;
  dikunciPada: string | null;
  dibukaPada: string | null;
  /** Berapa kali kunci dibuka kembali (jejak revisi). */
  jumlahDibuka: number;
  dibuatOleh: number | null;
  dibuatOlehNama: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PegawaiDto extends PegawaiPayload {
  id: number;
  aktif: boolean;
  instansi: string;
  pangkatGolongan: string;
}

export interface SbmVersiDto {
  id: number;
  tahunAnggaran: number;
  dasarHukum: string;
  aktif: boolean;
}

export interface SbmDetailDto {
  versi: SbmVersiDto;
  data: Sbm;
}

export interface SuratTugasRingkasDto {
  id: number;
  nomor: string;
  tanggal: string;
  jumlahPelaksana: number;
  status: StatusSt;
  dibuatOleh: number | null;
  dibuatOlehNama: string | null;
  /** Total SPTB seluruh pelaksana (rupiah), dihitung dengan SBM yang di-pin surat tugas. */
  total: number;
  /** Jumlah peringatan data di semua pelaksana; 0 berarti siap cetak. */
  jumlahPeringatan: number;
  updatedAt: string;
}

/** Respons GET /api/surat-tugas/:id/hasil */
export interface HasilSuratTugasDto {
  suratTugas: SuratTugasDto;
  pengaturan: PengaturanPayload;
  hasil: SpjHasil;
}

/** Menyusun masukan mesin hitung dari data surat tugas dan pengaturan. */
export function toSpjInput(st: SuratTugasPayload, pengaturan: Pick<PengaturanPayload, "kotaKedudukan" | "provinsiKedudukan">): SpjInput {
  return {
    nomorSt: st.nomor,
    tanggalSt: st.tanggal,
    tanggalSpj: st.tanggalSpj ?? null,
    kotaKedudukan: pengaturan.kotaKedudukan,
    provinsiKedudukan: pengaturan.provinsiKedudukan,
    pelaksana: st.pelaksana.map((p) => ({
      nama: p.nama,
      nip: p.nip,
      jabatan: p.jabatan,
      status: p.status,
      noSpd: p.noSpd ?? null,
      tanggalSpd: p.tanggalSpd ?? null,
      etape: p.etape,
      biaya: p.biaya,
    })),
  };
}
