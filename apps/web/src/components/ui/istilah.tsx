import type { ReactNode } from 'react'

/** Kamus istilah yang sering muncul di aplikasi, agar penjelasannya konsisten di semua halaman. */
export const ARTI_ISTILAH = {
  SBM: 'Standar Biaya Masukan: batas tarif resmi (uang harian, hotel, transport) per provinsi.',
  SPTB: 'Surat Pernyataan Tanggung Jawab Belanja.',
  DPR: 'Daftar Pengeluaran Riil: lembar untuk biaya yang tidak punya bukti resmi (Lampiran IX PMK 113).',
  Fullboard: 'Paket rapat di hotel yang sudah termasuk penginapan dan makan, sehingga pelaksana menerima uang saku, bukan uang harian penuh.',
} as const

/** Menampilkan singkatan dengan garis titik-titik; arti muncul saat kursor diarahkan atau elemen disentuh. */
export function Istilah({ kata, children }: { kata: keyof typeof ARTI_ISTILAH; children?: ReactNode }) {
  return (
    <abbr title={ARTI_ISTILAH[kata]} className="cursor-help underline decoration-dotted underline-offset-2">
      {children ?? kata}
    </abbr>
  )
}
