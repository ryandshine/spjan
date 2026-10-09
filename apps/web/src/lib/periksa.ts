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
      return `etape-${nomorPelaksana}-${tujuan}-tarif`
    case 'TANGGAL_SALAH':
      return `etape-${nomorPelaksana}-${tujuan}-brkt`
    default:
      return w.etape !== undefined ? `etape-${nomorPelaksana}-${tujuan}-kota` : `pel-${nomorPelaksana}-nama`
  }
}

/** Menggulir ke isian, memberinya fokus, dan menyorotnya sebentar; membuka kartu pelaksana bila sedang dilipat. */
export function lompatKeIsian(sasaranId: string, nomorPelaksana: number): void {
  const cari = () => document.getElementById(sasaranId)
  const sorot = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    el.classList.add('ring-2', 'ring-warning', 'ring-offset-2')
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-warning', 'ring-offset-2'), 2200)
  }
  const el = cari()
  if (el) return sorot(el)
  document.getElementById(`pel-${nomorPelaksana}-toggle`)?.click()
  window.setTimeout(() => {
    const lagi = cari()
    if (lagi) sorot(lagi)
  }, 80)
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
