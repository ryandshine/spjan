import type { SuratTugasRingkasDto } from '@spjan/shared'

/** Huruf kecil tanpa spasi, agar "1980 0120" cocok dengan "19800120". */
export const rapat = (s: string) => s.toLowerCase().replace(/\s+/g, '')

export interface PelaksanaCocok {
  nomor: number
  nama: string
  total: number
}

/** Pelaksana yang nama, NIP, atau nomor SPD-nya cocok dengan kata pencarian (minimal 3 huruf). */
export function pelaksanaCocok(b: SuratTugasRingkasDto, kata: string): PelaksanaCocok[] {
  const q = rapat(kata)
  if (q.length < 3) return []
  return b.pelaksana.flatMap((p, i) =>
    [p.nama, p.nip, p.noSpd].some((x) => rapat(x).includes(q)) ? [{ nomor: i + 1, nama: p.nama, total: p.total }] : [],
  )
}

/** Ringkasan pencarian orang: berapa SPJ dan total yang diterima orang yang cocok. Null bila tidak ada orang yang cocok. */
export function ringkasCariOrang(daftar: SuratTugasRingkasDto[], kata: string): { jumlahSpj: number; total: number; nama: string[] } | null {
  const cocok = daftar.map((b) => pelaksanaCocok(b, kata)).filter((c) => c.length > 0)
  if (cocok.length === 0) return null
  const semua = cocok.flat()
  return { jumlahSpj: cocok.length, total: semua.reduce((n, c) => n + c.total, 0), nama: [...new Set(semua.map((c) => c.nama))] }
}
