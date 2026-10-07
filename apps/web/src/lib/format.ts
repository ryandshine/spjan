import { formatAngka, parseTanggal } from '@spjan/shared'

export const rupiah = (n: number) => `Rp${formatAngka(n)}`

/** "2026-09-08" -> "08/09/2026" */
export function tanggalPendek(iso: string | null | undefined): string {
  const t = parseTanggal(iso)
  if (!t) return '-'
  return `${String(t.d).padStart(2, '0')}/${String(t.m).padStart(2, '0')}/${t.y}`
}

/** "2026-09-08" -> "Selasa, 8 September 2026"; string kosong bila tanggal tidak valid. Dipakai sebagai petunjuk di bawah input tanggal agar tidak ambigu antara dd/mm dan mm/dd. */
export function tanggalPanjang(iso: string | null | undefined): string {
  const t = parseTanggal(iso)
  if (!t) return ''
  return new Date(Date.UTC(t.y, t.m - 1, t.d)).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Waktu ISO dari server -> "08/09/2026 14.05" (zona waktu peramban). */
export function waktuPendek(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}.${p(d.getMinutes())}`
}

export function pesanGalat(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan.'
}

export function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
