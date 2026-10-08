import { z } from "zod";
import { SBM_2026 } from "./data/sbm-2026.js";
import { INSTANSI_BAWAAN } from "./schemas.js";
import type { BiayaPayload, PegawaiDto, PengaturanPayload, SuratTugasPayload } from "./schemas.js";
import { cocokkanKotaJakartaSekitar, isKotaJabodetabek, provinsiDariKotaJabodetabek } from "./st-model.js";
import { norm, parseTanggal, selisihHari } from "./teks.js";
import type { Sbm, StatusKode } from "./types.js";

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
  n = n.replace(/^(?:MR|MRS|MS|MSTR)\.?\s+/i, "");
  n = n.replace(/\s+(?:MR|MRS|MS|MSTR)$/i, "");
  return norm(n);
}

/** Mencocokkan teks tujuan penugasan ke daftar provinsi SBM yang sah. */
export function cariProvinsiSbm(tujuan: string, daftarProvinsi: string[]): string | null {
  const t = norm(tujuan);
  const langsung = daftarProvinsi.find((p) => norm(p) === t);
  if (langsung) return langsung;

  const provJkt = provinsiDariKotaJabodetabek(tujuan);
  if (provJkt) {
    const p = daftarProvinsi.find((x) => norm(x) === norm(provJkt));
    if (p) return p;
  }

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
  sbmDetail?: Sbm | null,
): UsulanStHasil {
  const peringatan: string[] = [];
  const pelaksanaStatus: PelaksanaStatus[] = [];
  const sbm = sbmDetail ?? SBM_2026;

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

    const biayaAwal: BiayaPayload[] = [];

    const etapePayload = pel.etape.map((et, idx) => {
      const prov = cariProvinsiSbm(et.tujuan, daftarProvinsiSbm);
      if (!prov) {
        peringatan.push(`Tujuan "${et.tujuan}" pada pelaksana "${pel.nama}" tidak cocok dengan daftar provinsi SBM.`);
      }
      if (et.tanggalKembali < et.tanggalBerangkat) {
        peringatan.push(
          `Tanggal pulang (${et.tanggalKembali}) lebih awal dari tanggal berangkat (${et.tanggalBerangkat}) pada pelaksana "${pel.nama}".`,
        );
      }

      const tAwal = parseTanggal(et.tanggalBerangkat);
      const tAkhir = parseTanggal(et.tanggalKembali);
      const isSatuHari = tAwal && tAkhir && selisihHari(tAwal, tAkhir) === 0;
      const isJkt = isKotaJabodetabek(et.tujuan);
      const dalamKota = isSatuHari && isJkt;

      // Standarisasi nama kota jika Jabodetabek
      const cocokTransport = isJkt ? cocokkanKotaJakartaSekitar(et.tujuan, sbm.transportJakarta) : null;
      const namaKotaStandard = cocokTransport ? cocokTransport.kabKota : et.tujuan;

      // Jika perjalanan dinas 1 hari ke Jabodetabek, otomatis tambahkan biaya Transport Jakarta - Sekitar (PP)
      if (dalamKota) {
        biayaAwal.push({
          jenis: "TRANSPORT_JAKARTA_SEKITAR",
          provinsi: null,
          uraian: cocokTransport ? cocokTransport.kabKota : "Kota Tangerang",
          qty: 2,
          satuan: "kali",
          tarif: cocokTransport ? cocokTransport.besaran : 258000,
          keterangan: "Bukti terlampir",
          etapeIndex: idx,
          pengeluaranRiil: false,
        });
      }

      return {
        provinsi: prov ?? et.tujuan,
        kota: namaKotaStandard,
        kegiatan: ekstraksi.kegiatan,
        berangkat: et.tanggalBerangkat,
        pulang: et.tanggalKembali,
        malamOverride: isSatuHari ? 0 : null,
        hotelNama: null,
        hotelTarif: null,
        dinasJabatan: false,
        fullboardDates: [],
        hotel30Persen: false,
        dalamKota8Jam: dalamKota,
      };
    });

    return {
      pegawaiId: match?.id ?? null,
      nama: match?.nama ?? pel.nama,
      nip: match?.nip ?? (pel.nip ? pel.nip.trim() : ""),
      jabatan: match?.jabatan ?? pel.jabatan ?? "",
      instansi: match?.instansi ?? INSTANSI_BAWAAN,
      pangkatGolongan: match?.pangkatGolongan ?? "",
      status: match?.status ?? null,
      noSpd: null,
      etape: etapePayload,
      biaya: biayaAwal,
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
