import type { PelaksanaHasil, Peringatan } from '@spjan/shared'

/** Id elemen isian yang perlu diperbaiki untuk satu peringatan (nomor pelaksana mulai dari 1; id dipasang di PelaksanaCard dan EtapeForm). */
export function sasaranPeringatan(w: Peringatan, nomorPelaksana: number): string {
  const tujuan = (w.etape ?? 0) + 1
  switch (w.kode) {
    case 'NO_SPD_KOSONG':
      return `pel-${nomorPelaksana}-spd`
    case 'NIP_KOSONG':
      return `pel-${nomorPelaksana}-nip`
    case 'STATUS_PEGAWAI_KOSONG':
      return `pel-${nomorPelaksana}-status`
    case 'TARIF_HOTEL_KOSONG':
    case 'HOTEL_MELEBIHI_BATAS':
    case 'MALAM_BERLEBIH':
    case 'MALAM_BELUM_TERISI':
      return `etape-${nomorPelaksana}-${tujuan}-tarif`
    case 'TANGGAL_SALAH':
      return `etape-${nomorPelaksana}-${tujuan}-brkt`
    case 'UANG_HARIAN_MELEBIHI_SBM':
      return `etape-${nomorPelaksana}-${tujuan}-uang-harian`
    default:
      return w.etape !== undefined ? `etape-${nomorPelaksana}-${tujuan}-kota` : `pel-${nomorPelaksana}-nama`
  }
}

/** Bagian pelaksana (sub-tab) yang memuat isian. */
export type BagianPelaksana = 'perjalanan' | 'transport' | 'penginapan' | 'uang_harian'
export function bagianUntukSasaran(sasaranId: string): BagianPelaksana {
  if (sasaranId.endsWith('-uang-harian')) return 'uang_harian'
  return sasaranId.endsWith('-tarif') ? 'penginapan' : 'perjalanan'
}

/** Menggulir ke isian, memberinya fokus, dan menyorotnya sebentar; mencoba sekali lagi bila panelnya baru saja dibuka. */
export function lompatKeIsian(sasaranId: string): void {
  const sorot = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    el.classList.add('ring-2', 'ring-warning', 'ring-offset-2')
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-warning', 'ring-offset-2'), 2200)
  }
  const el = document.getElementById(sasaranId)
  if (el) return sorot(el)
  window.setTimeout(() => {
    const lagi = document.getElementById(sasaranId)
    if (lagi) sorot(lagi)
  }, 120)
}

/** Berpindah ke isian yang bermasalah (id elemen, nomor pelaksana mulai dari 1). */
export type PerbaikiIsian = (sasaranId: string, nomorPelaksana: number) => void

export interface ItemPeriksa {
  pesan: string
  nomorPelaksana: number
  namaPelaksana: string
  sasaranId: string
}

/** Meratakan peringatan semua pelaksana menjadi satu daftar berurutan, lengkap dengan isian yang harus diperbaiki. */
export function kumpulkanPeriksa(pelaksana: ReadonlyArray<Pick<PelaksanaHasil, 'nama' | 'peringatan'>>): ItemPeriksa[] {
  return pelaksana.flatMap((p, i) =>
    p.peringatan.map((w) => ({
      pesan: w.pesan,
      nomorPelaksana: i + 1,
      namaPelaksana: p.nama || `Pelaksana ${i + 1}`,
      sasaranId: sasaranPeringatan(w, i + 1),
    })),
  )
}

/**
 * Kelompokkan peringatan banyak pelaksana menurut masalahnya, agar daftar panjang tidak mengulang kalimat yang sama.
 * Nomor etape dan jumlah malam dilepas dari pesan; tujuan ke-2 dan seterusnya ditandai di samping nama.
 */
export function ringkasPeringatan(
  pelaksana: Array<{ nama: string; peringatan: Peringatan[] }>,
): Array<{ masalah: string; nama: string[] }> {
  const grup = new Map<string, string[]>()
  for (const p of pelaksana) {
    for (const w of p.peringatan) {
      const bersih = w.pesan.replace(/^Etape \d+:\s*/, '').replace(/\s*\(\d+ malam\)/, '').replace(/\.$/, '')
      const masalah = bersih.charAt(0).toUpperCase() + bersih.slice(1)
      const nama = (w.etape ?? 0) > 0 ? `${p.nama} (Tujuan ${(w.etape ?? 0) + 1})` : p.nama
      const daftar = grup.get(masalah) ?? []
      if (!daftar.includes(nama)) daftar.push(nama)
      grup.set(masalah, daftar)
    }
  }
  return [...grup].map(([masalah, nama]) => ({ masalah, nama }))
}
