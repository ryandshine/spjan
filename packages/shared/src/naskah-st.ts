import { parseTanggal, rentangSptb, selisihHari, tanggalIndonesia, angkaKata } from "./teks.js";
import type { ModeNomorSt } from "./types.js";
import type { NaskahStPayload } from "./schemas.js";


export const DASAR_HUKUM_BAWAAN_ST: readonly string[] = [
  "Keputusan Presiden Nomor 42 Tahun 2002 tentang Pedoman Pelaksanaan Anggaran dan Belanja Negara (APBN);",
  "Peraturan Menteri Kehutanan Nomor 1 Tahun 2024 tentang Organisasi dan Tata Kerja Kementerian Kehutanan;",
  "Peraturan Menteri Keuangan Nomor P.113/PMK.05/2012 tentang Perjalanan dinas dalam negeri bagi Pejabat Negara, Pegawai Negeri, dan Pegawai tidak tetap;",
];

export const TEMBUSAN_BAWAAN_ST: readonly string[] = [
  "Sekretaris Direktorat Jenderal Perhutanan Sosial;",
  "Yang Bersangkutan.",
];

export const PEMBEBANAN_DIPA_BAWAAN = (tahun: number = new Date().getFullYear()): string =>
  `Anggaran DIPA Kantor Pusat Direktorat Jenderal Perhutanan Sosial Tahun Anggaran ${tahun}.`;

export function hitungLamaHariSt(tanggalMulai: string, tanggalSelesai: string): number {
  const a = parseTanggal(tanggalMulai);
  const b = parseTanggal(tanggalSelesai);
  if (!a || !b) return 1;
  const selisih = selisihHari(a, b) + 1;
  return selisih > 0 ? selisih : 1;
}

export function formatHariDenganTerbilang(n: number): string {
  try {
    return `${n} (${angkaKata(n)})`;
  } catch {
    return `${n}`;
  }
}

export function formatRentangWaktuSt(tanggalMulai: string, tanggalSelesai: string): string {
  const a = parseTanggal(tanggalMulai);
  const b = parseTanggal(tanggalSelesai);
  if (!a) return tanggalMulai;
  if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) {
    return tanggalIndonesia(tanggalMulai);
  }
  return rentangSptb(a, b);
}

export function buatNaskahStAwal(opts?: {
  pjNama?: string;
  pjNip?: string;
  pjJabatan?: string;
  tahunAnggaran?: number;
}): NaskahStPayload {
  const tahun = opts?.tahunAnggaran ?? new Date().getFullYear();
  const hariIni = new Date().toISOString().slice(0, 10);
  return {
    nomor: "${nomor_naskah}",
    modeNomor: "srikandi" as ModeNomorSt,
    tanggal: null,
    tempatNaskah: "Jakarta",
    maksudTugas: "",
    lokasiTugas: "",
    tanggalMulai: hariIni,
    tanggalSelesai: hariIni,
    lamaHari: 1,
    dasarHukum: [...DASAR_HUKUM_BAWAAN_ST],
    dasarSpesifik: "",
    pelaporanHari: 5,
    pembebananAnggaran: PEMBEBANAN_DIPA_BAWAAN(tahun),
    penandatanganJabatan: opts?.pjJabatan || "Direktur,",
    penandatanganNama: opts?.pjNama || "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
    penandatanganNip: opts?.pjNip || "196810191998031001",
    tembusan: [...TEMBUSAN_BAWAAN_ST],
    pelaksana: [],
  };
}
