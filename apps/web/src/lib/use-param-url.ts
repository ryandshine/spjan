import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type PerubahanParam = Record<string, string | null>

/** Terapkan perubahan pada query string; null menghapus parameter. */
export function gabungParam(search: string, perubahan: PerubahanParam): string {
  const hasil = new URLSearchParams(search)
  for (const [nama, nilai] of Object.entries(perubahan)) {
    if (nilai === null) hasil.delete(nama)
    else hasil.set(nama, nilai)
  }
  return hasil.toString()
}

// Bersama antar pemanggil: beberapa perubahan dalam satu klik (tab + pelaksana) harus jadi satu entri riwayat.
let tertunda: PerubahanParam | null = null

/**
 * Posisi tampilan (tab, pelaksana) disimpan di alamat halaman, sehingga bertahan saat refresh
 * dan tombol back/forward kembali ke posisi sebelumnya.
 */
export function useParamUrl() {
  const [params, setParams] = useSearchParams()
  const ubah = useCallback(
    (perubahan: PerubahanParam) => {
      if (!tertunda) {
        tertunda = {}
        queueMicrotask(() => {
          const isi = tertunda ?? {}
          tertunda = null
          const sekarang = window.location.search.replace(/^\?/, '')
          const baru = gabungParam(sekarang, isi)
          if (baru !== new URLSearchParams(sekarang).toString()) setParams(baru)
        })
      }
      Object.assign(tertunda, perubahan)
    },
    [setParams],
  )
  return { params, ubah }
}
