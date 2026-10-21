import { parseTanggal } from '@spjan/shared'

/** Tanggal ISO sebagai label pendek ("Sen, 5 Okt"); dikembalikan apa adanya bila bukan tanggal valid. */
export function labelTanggal(iso: string): string {
  const t = parseTanggal(iso)
  if (!t) return iso
  const dt = new Date(Date.UTC(t.y, t.m - 1, t.d))
  return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}
