import type { EtapePayload } from '@spjan/shared'

/** Status uang harian per hari selain "penuh" (bawaan). Urutan = prioritas mesin hitung: pihak lain, paket rapat, lalu 60%. */
export type KolomStatusHari = 'tanpaUangHarianDates' | 'fullboardDates' | 'uangHarian60Dates'

const SEMUA: KolomStatusHari[] = ['tanpaUangHarianDates', 'fullboardDates', 'uangHarian60Dates']

/** Patch untuk menetapkan tanggal pada satu status: tanggal itu keluar dari status lain agar satu hari hanya punya satu status. */
export function tetapkanStatusHari(etape: EtapePayload, kolom: KolomStatusHari, tanggal: string[]): Partial<EtapePayload> {
  const patch: Partial<EtapePayload> = { [kolom]: tanggal }
  for (const k of SEMUA) {
    if (k === kolom) continue
    const lama = etape[k] ?? []
    const baru = lama.filter((t) => !tanggal.includes(t))
    if (baru.length !== lama.length) patch[k] = baru
  }
  return patch
}

/** Tanggal yang tercatat pada lebih dari satu status (data lama); mesin hitung memakai prioritas, tetapi pengguna perlu tahu. */
export function tanggalBentrokStatus(etape: EtapePayload, listHari: string[]): string[] {
  return listHari.filter((t) => SEMUA.filter((k) => (etape[k] ?? []).includes(t)).length > 1)
}
