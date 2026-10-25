/**
 * Tata letak dan taksiran tinggi halaman naskah dinas Surat Tugas (format A4 Kemhut).
 * Memastikan tanda tangan Direktur memiliki ruang vertikal minimal 3x3 cm untuk QR TTE SRIKANDI.
 * Bila isi surat + daftar pelaksana tidak cukup 1 halaman, daftar pelaksana otomatis
 * dipindahkan ke halaman 2 sebagai "DAFTAR TERLAMPIR".
 */

import {
  AMBANG_LAMPIRAN_PELAKSANA,
  formatHariDenganTerbilang,
  formatRentangWaktuSt,
  hitungLamaHariSt,
} from "./naskah-st.js";
import type { NaskahStPayload } from "./schemas.js";

export const SATU_BARIS = 258; // satu baris Bookman Old Style 11 pt (garis tetap 12,9 pt dalam dxa)

/** Tinggi isi halaman A4: 16838 - margin atas 567 - margin bawah 1418 = 14853 dxa (~26,2 cm). */
export const KAPASITAS_HALAMAN = 16838 - 567 - 1418;
export const CADANGAN = 2 * SATU_BARIS; // 516 dxa: cadangan dua baris untuk selisih lebar font Word vs LibreOffice
export const BATAS_MUAT_HALAMAN = KAPASITAS_HALAMAN - CADANGAN; // 14337 dxa

export const KOREKSI_UKUR = 270; // kalibrasi terhadap hasil render riil
export const KEPALA = 328 + 328 + 376 + 20 + 771 + KOREKSI_UKUR; // tiga baris kop, garis ganda, jarak ke judul
export const JARAK_TETAP = SATU_BARIS + 100 + 110; // sebelum "DIREKTUR ...", sekitar "MEMBERI TUGAS,"
export const BARIS_TETAP = 3 + 1 + 5; // judul, nomor, "DIREKTUR ...", "MEMBERI TUGAS,", lima baris blok tanda tangan
export const HURUF_PER_BARIS_KOLOM = 63; // butir dalam kolom isi (setelah label dan nomor)
export const HURUF_PER_BARIS_PENUH = 77; // butir tembusan selebar halaman

export interface JarakHalaman {
  /** Antara Menimbang-Dasar dan Kepada-Untuk. */
  antarBlok: number;
  /** Sebelum baris tanggal tanda tangan dan sebelum "Tembusan:". */
  sebelumTtd: number;
  /**
   * Ruang vertikal tanda tangan (diterapkan sebelum ${ttd_pengirim} dan sebelum nama pejabat).
   * Nilai minimal 750 dxa menjamin total ruang vertikal = 2 * 750 + 258 = 1.758 dxa (~3,10 cm),
   * cukup sempurna untuk stempel QR TTE SRIKANDI ukuran 3x3 cm (1.701 dxa / 3,0 cm).
   */
  ruangTtd: number;
}

export const JARAK_NORMAL: JarakHalaman = { antarBlok: SATU_BARIS, sebelumTtd: SATU_BARIS, ruangTtd: 850 };
export const JARAK_RINGKAS: JarakHalaman = { antarBlok: 129, sebelumTtd: 129, ruangTtd: 800 };
export const JARAK_PADAT: JarakHalaman = { antarBlok: 129, sebelumTtd: 129, ruangTtd: 750 };
/** Pilihan paling rapat: jarak antar blok ditiadakan, ruang TTD tetap aman untuk QR 3x3 cm. */
export const JARAK_SANGAT_PADAT: JarakHalaman = { antarBlok: 0, sebelumTtd: 129, ruangTtd: 750 };

export interface BahanHalaman {
  menimbang: string[];
  dasar: string[];
  kepada: string[];
  untuk: string[];
  tembusan: string[];
}

/** Menghitung perkiraan jumlah baris teks dengan pemenggalan per kata. */
export const barisKata = (teks: string, hurufPerBaris: number): number => {
  let n = 1;
  let isi = 0;
  for (const kata of teks.split(/\s+/).filter(Boolean)) {
    if (isi === 0) isi = kata.length;
    else if (isi + 1 + kata.length <= hurufPerBaris) isi += 1 + kata.length;
    else {
      n += 1;
      isi = kata.length;
    }
  }
  return n;
};

export const jumlahBarisButir = (butir: string[], hurufPerBaris = HURUF_PER_BARIS_KOLOM): number =>
  butir.reduce((n, t) => n + barisKata(t, hurufPerBaris), 0);

/** Membersihkan tanda baca penutup butir: butir terakhir titik '.', sebelumnya titik koma ';'. */
export function rapikanPenutupDinas(daftar: string[]): string[] {
  const bersih = daftar.map((t) => t.trim().replace(/[;.]+$/, "")).filter(Boolean);
  return bersih.map((t, i) => (i === bersih.length - 1 ? `${t}.` : `${t};`));
}

/** Taksiran tinggi halaman 1 dalam dxa. */
export function taksirTinggiHalaman(b: BahanHalaman, j: JarakHalaman): number {
  const adaTembusan = b.tembusan.length > 0;
  const barisIsi =
    BARIS_TETAP +
    jumlahBarisButir(b.menimbang) +
    jumlahBarisButir(b.dasar) +
    Math.max(1, jumlahBarisButir(b.kepada)) +
    jumlahBarisButir(b.untuk) +
    (adaTembusan ? 1 + jumlahBarisButir(b.tembusan, HURUF_PER_BARIS_PENUH) : 0);
  const jarak =
    JARAK_TETAP +
    2 * j.antarBlok +
    j.sebelumTtd +
    (adaTembusan ? j.sebelumTtd : 0) +
    2 * j.ruangTtd;
  return KEPALA + barisIsi * SATU_BARIS + jarak;
}

/** Cek apakah bahan surat muat di halaman 1 dengan kerapatan maksimal (dengan ruang QR 3x3 cm aman). */
export function apakahMuatHalaman1(b: BahanHalaman): boolean {
  return taksirTinggiHalaman(b, JARAK_SANGAT_PADAT) <= BATAS_MUAT_HALAMAN;
}

/** Memilih jarak terlega yang masih muat 1 halaman; bila tidak ada yang muat, kembalikan JARAK_SANGAT_PADAT. */
export function pilihJarakToleran(b: BahanHalaman): JarakHalaman {
  for (const j of [JARAK_NORMAL, JARAK_RINGKAS, JARAK_PADAT]) {
    if (taksirTinggiHalaman(b, j) <= BATAS_MUAT_HALAMAN) return j;
  }
  return JARAK_SANGAT_PADAT;
}

/** Menyusun teks butir halaman 1 berdasarkan data surat dan status lampiran. */
export function susunBahanHalamanSt(data: NaskahStPayload, lampiran: boolean): BahanHalaman {
  const maksud = (data.maksudTugas || "").trim() || "…";
  const lokasi = (data.lokasiTugas || "").trim() || "…";
  const pembebanan = (data.pembebananAnggaran || "").endsWith(".")
    ? data.pembebananAnggaran
    : `${data.pembebananAnggaran || ""}.`;
  const lamaHari = data.lamaHari || hitungLamaHariSt(data.tanggalMulai, data.tanggalSelesai);
  const rentangTanggal = formatRentangWaktuSt(data.tanggalMulai, data.tanggalSelesai);

  const menimbang = [
    `bahwa dalam rangka ${maksud}, diperlukan untuk menugaskan personil;`,
    "bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas.",
  ];
  const dasar = rapikanPenutupDinas([
    ...(data.dasarHukum || []),
    ...(data.dasarSpesifik ? [data.dasarSpesifik] : []),
  ]);
  const kepada = lampiran
    ? ["DAFTAR TERLAMPIR"]
    : (data.pelaksana || []).map((pel) => {
        const jab = (pel.jabatan || "").trim().replace(/^\/\s*/, "");
        return jab ? `${pel.nama} / ${jab}` : pel.nama;
      });
  const untuk = [
    `Melaksanakan perjalanan dinas dalam rangka ${maksud} di ${lokasi};`,
    `Yang bersangkutan melaksanakan perintah tugas selama ${formatHariDenganTerbilang(lamaHari)} hari pada tanggal ${rentangTanggal};`,
    `Selambat-lambatnya ${formatHariDenganTerbilang(data.pelaporanHari || 5)} hari setelah melaksanakan tugas, membuat laporan tertulis kepada Direktur PPS;`,
    `Biaya dibebankan kepada ${pembebanan}`,
  ];
  const tembusan = rapikanPenutupDinas(data.tembusan || []);

  return { menimbang, dasar, kepada, untuk, tembusan };
}

export interface HasilEvaluasiTataLetakSt {
  lampiran: boolean;
  alasanLampiran: "jumlah_pelaksana" | "kapasitas_halaman" | "tidak_ada";
  jarak: JarakHalaman;
  tinggiTaksiran: number;
}

/**
 * Menentukan tata letak Surat Tugas secara otomatis:
 * 1. Jika pelaksana > 3 orang: otomatis memakai lampiran (aturan standar).
 * 2. Jika pelaksana 1 s.d. 3 orang:
 *    - Diuji apakah muat di halaman 1 dengan ruang QR 3x3 cm terjaga.
 *    - Bila tidak muat: otomatis pindah ke lampiran (halaman 2) dengan "DAFTAR TERLAMPIR" di halaman 1.
 * 3. Jika draf kosong (0 pelaksana): tetap di halaman 1.
 */
export function evaluasiTataLetakSt(data: NaskahStPayload): HasilEvaluasiTataLetakSt {
  const pelaksana = data.pelaksana || [];
  const jumlahPelaksana = pelaksana.length;

  if (jumlahPelaksana > AMBANG_LAMPIRAN_PELAKSANA) {
    const bahan = susunBahanHalamanSt(data, true);
    const jarak = pilihJarakToleran(bahan);
    return {
      lampiran: true,
      alasanLampiran: "jumlah_pelaksana",
      jarak,
      tinggiTaksiran: taksirTinggiHalaman(bahan, jarak),
    };
  }

  if (jumlahPelaksana === 0) {
    const bahan = susunBahanHalamanSt(data, false);
    const jarak = pilihJarakToleran(bahan);
    return {
      lampiran: false,
      alasanLampiran: "tidak_ada",
      jarak,
      tinggiTaksiran: taksirTinggiHalaman(bahan, jarak),
    };
  }

  // Uji apakah daftar pelaksana muat di halaman 1 bersama ruang QR 3x3 cm
  const bahanTanpaLampiran = susunBahanHalamanSt(data, false);
  const muat = apakahMuatHalaman1(bahanTanpaLampiran);

  if (muat) {
    const jarak = pilihJarakToleran(bahanTanpaLampiran);
    return {
      lampiran: false,
      alasanLampiran: "tidak_ada",
      jarak,
      tinggiTaksiran: taksirTinggiHalaman(bahanTanpaLampiran, jarak),
    };
  }

  // Tidak cukup ruang di halaman 1 untuk memuat pelaksana + QR 3x3 cm:
  // Pindahkan daftar pelaksana ke lampiran (halaman 2)
  const bahanDenganLampiran = susunBahanHalamanSt(data, true);
  const jarak = pilihJarakToleran(bahanDenganLampiran);
  return {
    lampiran: true,
    alasanLampiran: "kapasitas_halaman",
    jarak,
    tinggiTaksiran: taksirTinggiHalaman(bahanDenganLampiran, jarak),
  };
}

/** Fungsi helper singkat untuk mengecek apakah naskah ST memerlukan lampiran. */
export function perluLampiranSt(data: NaskahStPayload): boolean {
  return evaluasiTataLetakSt(data).lampiran;
}
