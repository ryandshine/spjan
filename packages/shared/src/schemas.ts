import { z } from "zod";
import { JENIS_BIAYA, STATUS_KODE } from "./types.js";
import type { SpjInput } from "./types.js";

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
});

export const PelaksanaPayloadSchema = z.object({
  pegawaiId: z.number().int().positive().nullish(),
  nama: teks(200).min(1),
  nip: teks(30),
  jabatan: teks(200),
  status: StatusKodeSchema.nullable(),
  noSpd: teks(100).nullish(),
  etape: z.array(EtapePayloadSchema).max(20),
  biaya: z.array(BiayaPayloadSchema).max(60),
});

export const SuratTugasPayloadSchema = z.object({
  nomor: teks(200).min(1),
  tanggal: tanggalWajib,
  tanggalSpj: tanggalWajib.nullish(),
  kodeAkun: teks(100),
  catatan: teks(2000),
  pelaksana: z.array(PelaksanaPayloadSchema).max(30),
});
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

export interface SuratTugasDto extends SuratTugasPayload {
  id: number;
  versiSbmId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PegawaiDto extends PegawaiPayload {
  id: number;
  aktif: boolean;
}

export interface SbmVersiDto {
  id: number;
  tahunAnggaran: number;
  dasarHukum: string;
  aktif: boolean;
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
      etape: p.etape,
      biaya: p.biaya,
    })),
  };
}
