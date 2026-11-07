import { describe, expect, it } from 'vitest'
import type { SuratTugasRingkasDto } from '@spjan/shared'

import { pelaksanaCocok, ringkasCariOrang } from './cari-st'

const st = (id: number, pelaksana: { nama: string; nip: string; noSpd: string; total: number }[]) =>
  ({ id, pelaksana }) as unknown as SuratTugasRingkasDto
const riandi = { nama: 'Riandi Eko Priantoro, S.Kom', nip: '198404212023211020', noSpd: '404/SPD', total: 1_000 }
const lain = { nama: 'Aisyah', nip: '198411262009012001', noSpd: '405/SPD', total: 5_000 }

describe('pencarian orang di daftar ST', () => {
  it('menemukan nomor pelaksana lewat nama atau NIP berspasi', () => {
    expect(pelaksanaCocok(st(1, [lain, riandi]), 'riandi')).toEqual([{ nomor: 2, nama: riandi.nama, total: 1_000 }])
    expect(pelaksanaCocok(st(1, [lain, riandi]), '1984 0421')).toHaveLength(1)
  })
  it('kata terlalu pendek tidak dicocokkan', () => {
    expect(pelaksanaCocok(st(1, [riandi]), 'ri')).toEqual([])
  })
  it('ringkasan menjumlahkan bagian orang yang cocok saja', () => {
    expect(ringkasCariOrang([st(1, [lain, riandi]), st(2, [riandi]), st(3, [lain])], 'riandi')).toEqual({
      jumlahSpj: 2,
      total: 2_000,
      nama: [riandi.nama],
    })
    expect(ringkasCariOrang([st(3, [lain])], 'riandi')).toBeNull()
  })
})
