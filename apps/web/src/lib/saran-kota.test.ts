import { describe, expect, it } from 'vitest'
import { SBM_2026 } from '@spjan/shared'

import { peringatanKotaKedudukan, saranKota } from './saran-kota'

describe('saranKota', () => {
  it('Jawa Barat: ibukota (Bandung) paling atas, lalu kab/kota SBM termasuk Kota Bogor, Kota Bekasi, Kota Depok', () => {
    const saran = saranKota(SBM_2026, 'JAWA BARAT')
    expect(saran[0]).toBe('Bandung')
    for (const k of ['Kab. Bandung', 'Kab. Bogor', 'Kota Bogor', 'Kota Bekasi', 'Kota Depok', 'Kota Cimahi']) expect(saran).toContain(k)
  })

  it('Banten: Serang dan tujuh kab/kota SBM tanpa duplikat', () => {
    const saran = saranKota(SBM_2026, 'BANTEN')
    expect(saran).toEqual(['Serang', 'Kab. Lebak', 'Kab. Pandeglang', 'Kab. Serang', 'Kab. Tangerang', 'Kota Cilegon', 'Kota Tangerang', 'Kota Tangerang Selatan'])
    expect(new Set(saran).size).toBe(saran.length)
  })

  it('D.K.I. Jakarta: Jakarta tersedia', () => {
    expect(saranKota(SBM_2026, 'D.K.I. JAKARTA')).toContain('Jakarta')
  })

  it('ibukota memakai nama polos seperti tabel SBM/tiket (cocok dengan pagu tiket)', () => {
    expect(saranKota(SBM_2026, 'BALI')[0]).toBe('Denpasar')
    expect(saranKota(SBM_2026, 'D.I. YOGYAKARTA')[0]).toBe('Yogyakarta')
  })

  it('tanpa provinsi: daftar Jakarta-sekitarnya; tanpa SBM: kosong', () => {
    expect(saranKota(SBM_2026, '')).toEqual(SBM_2026.transportJakarta.map((t) => t.kabKota))
    expect(saranKota(undefined, 'BANTEN')).toEqual([])
  })

  it('setiap provinsi punya saran tanpa duplikat', () => {
    for (const prov of Object.keys(SBM_2026.uangHarian)) {
      const saran = saranKota(SBM_2026, prov)
      expect(new Set(saran).size).toBe(saran.length)
    }
  })
})

describe('peringatanKotaKedudukan', () => {
  it('tanpa peringatan bila kota kosong, ada di daftar (tanpa beda huruf), atau data belum tersedia', () => {
    expect(peringatanKotaKedudukan(SBM_2026, 'BALI', '')).toBeUndefined()
    expect(peringatanKotaKedudukan(SBM_2026, 'BALI', 'denpasar')).toBeUndefined()
    expect(peringatanKotaKedudukan(undefined, 'BALI', 'Makassar')).toBeUndefined()
    expect(peringatanKotaKedudukan(SBM_2026, '', 'Makassar')).toBeUndefined()
  })

  it('memberi peringatan bila kota tidak ada di daftar provinsinya', () => {
    expect(peringatanKotaKedudukan(SBM_2026, 'BALI', 'Makassar')).toMatch(/tidak ada dalam daftar/)
  })
})
