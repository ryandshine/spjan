/**
 * Taksiran tinggi halaman 1 surat tugas. Jarak antar blok dikecilkan bertahap bila isinya panjang,
 * supaya blok tanda tangan dan tembusan tetap di halaman 1. Satuan: dxa (1/20 pt).
 * Lebar baris dikalibrasi terhadap hasil render; selisih font antar aplikasi ditutup oleh CADANGAN.
 */

export const SATU_BARIS = 258; // satu baris Bookman Old Style 11 pt (garis tetap 12,9 pt)

/** Tinggi isi halaman A4: 16838 - margin atas 567 - margin bawah 1418. */
export const KAPASITAS_HALAMAN = 16838 - 567 - 1418;
const CADANGAN = 2 * SATU_BARIS; // cadangan dua baris untuk selisih lebar font (Word vs LibreOffice)
const KOREKSI_UKUR = 270; // selisih taksiran terhadap hasil render (isi contoh ST_CILOTO, 1 pelaksana: 14429 terukur)
const KEPALA = 328 + 328 + 376 + 20 + 771 + KOREKSI_UKUR; // tiga baris kop, garis, jarak ke judul
const JARAK_TETAP = SATU_BARIS + 100 + 110; // sebelum "DIREKTUR ...", sekitar "MEMBERI TUGAS,"
const BARIS_TETAP = 3 + 1 + 5; // judul, nomor, "DIREKTUR ...", "MEMBERI TUGAS,", lima baris blok tanda tangan
const HURUF_PER_BARIS_KOLOM = 63; // butir dalam kolom isi (setelah label dan nomor); cocok dengan hasil render
const HURUF_PER_BARIS_PENUH = 77; // butir tembusan selebar halaman

export interface JarakHalaman {
  /** Antara Menimbang-Dasar dan Kepada-Untuk. */
  antarBlok: number;
  /** Sebelum baris tanggal tanda tangan dan sebelum "Tembusan:". */
  sebelumTtd: number;
  /** Ruang kosong untuk tanda tangan: di atas penanda TTE dan di atas nama (dua kali). */
  ruangTtd: number;
}

export const JARAK_NORMAL: JarakHalaman = { antarBlok: SATU_BARIS, sebelumTtd: SATU_BARIS, ruangTtd: 774 };
export const JARAK_RINGKAS: JarakHalaman = { antarBlok: 129, sebelumTtd: 129, ruangTtd: 645 };
export const JARAK_PADAT: JarakHalaman = { antarBlok: 129, sebelumTtd: 129, ruangTtd: 516 };
/** Pilihan terakhir: jarak antar blok dihapus. */
export const JARAK_SANGAT_PADAT: JarakHalaman = { antarBlok: 0, sebelumTtd: 129, ruangTtd: 516 };

export interface BahanHalaman {
  menimbang: string[];
  dasar: string[];
  kepada: string[];
  untuk: string[];
  tembusan: string[];
}

/** Jumlah baris dengan pemenggalan per kata (kata yang tidak muat pindah ke baris berikutnya). */
const baris = (teks: string, hurufPerBaris: number): number => {
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
const jumlahBaris = (butir: string[], hurufPerBaris = HURUF_PER_BARIS_KOLOM): number =>
  butir.reduce((n, t) => n + baris(t, hurufPerBaris), 0);

export function taksirTinggi(b: BahanHalaman, j: JarakHalaman): number {
  const adaTembusan = b.tembusan.length > 0;
  const barisIsi =
    BARIS_TETAP +
    jumlahBaris(b.menimbang) +
    jumlahBaris(b.dasar) +
    Math.max(1, jumlahBaris(b.kepada)) +
    jumlahBaris(b.untuk) +
    (adaTembusan ? 1 + jumlahBaris(b.tembusan, HURUF_PER_BARIS_PENUH) : 0);
  const jarak = JARAK_TETAP + 2 * j.antarBlok + j.sebelumTtd + (adaTembusan ? j.sebelumTtd : 0) + 2 * j.ruangTtd;
  return KEPALA + barisIsi * SATU_BARIS + jarak;
}

/** Jarak terlega yang masih muat satu halaman; bila tidak ada yang muat, jarak tersempit (usaha terbaik). */
export function pilihJarak(b: BahanHalaman): JarakHalaman {
  for (const j of [JARAK_NORMAL, JARAK_RINGKAS, JARAK_PADAT]) {
    if (taksirTinggi(b, j) <= KAPASITAS_HALAMAN - CADANGAN) return j;
  }
  return JARAK_SANGAT_PADAT;
}
