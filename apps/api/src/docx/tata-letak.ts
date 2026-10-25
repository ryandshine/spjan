/**
 * Taksiran tinggi halaman 1 surat tugas.
 * Menjamin ruang tanda tangan cukup untuk QR TTE SRIKANDI ukuran 3x3 cm.
 * Implementasi inti berada di @spjan/shared agar konsisten antara backend DOCX dan frontend web.
 */

export {
  SATU_BARIS,
  KAPASITAS_HALAMAN,
  CADANGAN,
  BATAS_MUAT_HALAMAN,
  KEPALA,
  JARAK_TETAP,
  BARIS_TETAP,
  HURUF_PER_BARIS_KOLOM,
  HURUF_PER_BARIS_PENUH,
  JARAK_NORMAL,
  JARAK_RINGKAS,
  JARAK_PADAT,
  JARAK_SANGAT_PADAT,
  type JarakHalaman,
  type BahanHalaman,
  barisKata as baris,
  jumlahBarisButir as jumlahBaris,
  rapikanPenutupDinas as rapikanPenutup,
  taksirTinggiHalaman as taksirTinggi,
  pilihJarakToleran as pilihJarak,
  apakahMuatHalaman1 as apakahMuatSatuHalaman,
  susunBahanHalamanSt as susunBahanHalaman,
  evaluasiTataLetakSt,
  perluLampiranSt,
  type HasilEvaluasiTataLetakSt,
} from "@spjan/shared";
