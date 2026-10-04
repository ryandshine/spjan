import { z } from "zod";
import type { PegawaiDto, PengaturanPayload, SuratTugasPayload } from "./schemas.js";
import { norm } from "./teks.js";
import type { StatusKode } from "./types.js";

export const EtapeEkstraksiStSchema = z.object({
  tujuan: z.string().trim().min(1).max(200),
  tanggalBerangkat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tanggalKembali: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
});
export type EtapeEkstraksiSt = z.infer<typeof EtapeEkstraksiStSchema>;

export const PelaksanaEkstraksiStSchema = z.object({
  nama: z.string().trim().min(1).max(200),
  nip: z.string().trim().nullable(),
  jabatan: z.string().trim().nullable(),
  pangkatGolongan: z.string().trim().nullable().optional(),
  etape: z.array(EtapeEkstraksiStSchema).min(1).max(20),
});
export type PelaksanaEkstraksiSt = z.infer<typeof PelaksanaEkstraksiStSchema>;

export const HasilEkstraksiStSchema = z.object({
  nomor: z.string().trim().min(1).max(200),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  kegiatan: z.string().trim().min(1).max(1000),
  pelaksana: z.array(PelaksanaEkstraksiStSchema).min(1).max(30),
});
export type HasilEkstraksiSt = z.infer<typeof HasilEkstraksiStSchema>;

export interface PelaksanaStatus {
  nama: string;
  nip: string | null;
  pegawaiId: number | null;
  status: StatusKode | null;
  baru: boolean;
}

export interface UsulanStHasil {
  payload: SuratTugasPayload;
  pelaksanaStatus: PelaksanaStatus[];
  peringatan: string[];
}

/** Hapus gelar depan/belakang umum untuk perbandingan nama pelaksana. */
export function bersihkanGelarNama(nama: string): string {
  let n = nama.split(",")[0] ?? nama;
  n = n.replace(/^(?:Dr|Dra|Drs|Ir|Prof)\.?\s+/i, "");
  return norm(n);
}

/** Mencocokkan teks tujuan penugasan ke daftar provinsi SBM yang sah. */
export function cariProvinsiSbm(tujuan: string, daftarProvinsi: string[]): string | null {
  const t = norm(tujuan);
  const langsung = daftarProvinsi.find((p) => norm(p) === t);
  if (langsung) return langsung;

  if (t.includes("YOGYAKARTA") || t.includes("JOGJA") || t.includes("DIY")) {
    const p = daftarProvinsi.find((x) => norm(x) === "D.I. YOGYAKARTA");
    if (p) return p;
  }
  if (t.includes("JAKARTA") || t.includes("DKI")) {
    const p = daftarProvinsi.find((x) => norm(x) === "D.K.I. JAKARTA");
    if (p) return p;
  }
  if (t.includes("DENPASAR") || t.includes("BALI")) {
    const p = daftarProvinsi.find((x) => norm(x) === "BALI");
    if (p) return p;
  }

  // Cari substring nama provinsi dari yang terpanjang ke terpendek
  const urut = [...daftarProvinsi].sort((a, b) => b.length - a.length);
  for (const prov of urut) {
    if (t.includes(norm(prov))) return prov;
  }
  return null;
}

/** Memetakan hasil ekstraksi ST dari model AI menjadi usulan SuratTugasPayload dan status pencocokan master data. */
export function petakanStKeUsulan(
  ekstraksi: HasilEkstraksiSt,
  masterPegawai: PegawaiDto[],
  daftarProvinsiSbm: string[],
  pengaturan?: Pick<PengaturanPayload, "kodeAkunDefault"> | null,
): UsulanStHasil {
  const peringatan: string[] = [];
  const pelaksanaStatus: PelaksanaStatus[] = [];

  const pelaksanaPayload = ekstraksi.pelaksana.map((pel) => {
    const nipDigit = pel.nip ? pel.nip.replace(/\D/g, "") : null;
    let match: PegawaiDto | undefined;

    if (nipDigit && nipDigit.length >= 8) {
      match = masterPegawai.find((p) => p.nip.replace(/\D/g, "") === nipDigit);
    }
    if (!match) {
      const namaBersih = bersihkanGelarNama(pel.nama);
      match = masterPegawai.find((p) => bersihkanGelarNama(p.nama) === namaBersih);
    }

    const baru = !match;
    pelaksanaStatus.push({
      nama: pel.nama,
      nip: match?.nip ?? pel.nip,
      pegawaiId: match?.id ?? null,
      status: match?.status ?? null,
      baru,
    });

    if (baru) {
      peringatan.push(`Pelaksana "${pel.nama}" belum terdaftar di Master Pegawai.`);
    }

    const etapePayload = pel.etape.map((et) => {
      const prov = cariProvinsiSbm(et.tujuan, daftarProvinsiSbm);
      if (!prov) {
        peringatan.push(`Tujuan "${et.tujuan}" pada pelaksana "${pel.nama}" tidak cocok dengan daftar provinsi SBM.`);
      }
      if (et.tanggalKembali < et.tanggalBerangkat) {
        peringatan.push(
          `Tanggal pulang (${et.tanggalKembali}) lebih awal dari tanggal berangkat (${et.tanggalBerangkat}) pada pelaksana "${pel.nama}".`,
        );
      }
      return {
        provinsi: prov ?? et.tujuan,
        kota: et.tujuan,
        kegiatan: ekstraksi.kegiatan,
        berangkat: et.tanggalBerangkat,
        pulang: et.tanggalKembali,
        malamOverride: null,
        hotelNama: null,
        hotelTarif: null,
        dinasJabatan: false,
      };
    });

    return {
      pegawaiId: match?.id ?? null,
      nama: match?.nama ?? pel.nama,
      nip: match?.nip ?? (pel.nip ? pel.nip.trim() : ""),
      jabatan: match?.jabatan ?? pel.jabatan ?? "",
      status: match?.status ?? null,
      noSpd: null,
      etape: etapePayload,
      biaya: [],
    };
  });

  return {
    payload: {
      nomor: ekstraksi.nomor,
      tanggal: ekstraksi.tanggal,
      tanggalSpj: null,
      kodeAkun: pengaturan?.kodeAkunDefault ?? "",
      catatan: "",
      pelaksana: pelaksanaPayload,
    },
    pelaksanaStatus,
    peringatan,
  };
}
