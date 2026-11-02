import { describe, expect, it } from 'vitest'
import { etapeKosong } from '@spjan/shared'

import { tanggalBentrokStatus, tetapkanStatusHari } from './uang-harian'

const etape = (p: Partial<ReturnType<typeof etapeKosong>> = {}) => ({ ...etapeKosong(), ...p })

describe('tetapkanStatusHari', () => {
  it('memindahkan tanggal dari status lain tanpa menyentuh tanggal lain', () => {
    const e = etape({ uangHarian60Dates: ['2026-10-26', '2026-10-27'], fullboardDates: ['2026-10-28'] })
    expect(tetapkanStatusHari(e, 'tanpaUangHarianDates', ['2026-10-27', '2026-10-28'])).toEqual({
      tanpaUangHarianDates: ['2026-10-27', '2026-10-28'],
      uangHarian60Dates: ['2026-10-26'],
      fullboardDates: [],
    })
  })
  it('tidak menambah kunci bila tidak ada yang bentrok', () => {
    expect(tetapkanStatusHari(etape(), 'fullboardDates', ['2026-10-26'])).toEqual({ fullboardDates: ['2026-10-26'] })
  })
})

describe('tanggalBentrokStatus', () => {
  it('mendeteksi tanggal di dua status', () => {
    const e = etape({ uangHarian60Dates: ['2026-10-26', '2026-10-27'], fullboardDates: ['2026-10-27'] })
    expect(tanggalBentrokStatus(e, ['2026-10-26', '2026-10-27', '2026-10-28'])).toEqual(['2026-10-27'])
  })
  it('kosong bila tidak ada yang bentrok', () => {
    expect(tanggalBentrokStatus(etape({ fullboardDates: ['2026-10-26'] }), ['2026-10-26'])).toEqual([])
  })
})
