import { describe, expect, it } from 'vitest'

import { lamaPerjalanan } from './lama-perjalanan'

const e = (berangkat: string, pulang: string) => ({ berangkat, pulang })

describe('lamaPerjalanan', () => {
  it('satu tujuan lengkap', () => {
    expect(lamaPerjalanan([e('2026-10-26', '2026-10-27')])).toEqual({ lama: '2 (dua) hari', berangkat: '26 Oktober 2026', kembali: '27 Oktober 2026' })
  })
  it('tujuan terakhir tanpa tanggal: kembali memakai tanggal pulang terakhir yang valid, bukan strip', () => {
    expect(lamaPerjalanan([e('2026-10-26', '2026-10-27'), e('', '')])).toEqual({ lama: '2 (dua) hari', berangkat: '26 Oktober 2026', kembali: '27 Oktober 2026' })
  })
  it('lama dihitung dari tanggal, bukan dari jumlah tujuan', () => {
    expect(lamaPerjalanan([e('2026-10-26', '2026-10-26'), e('', '')]).lama).toBe('1 (satu) hari')
  })
  it('tanpa tanggal sama sekali', () => {
    expect(lamaPerjalanan([e('', ''), e('', '')])).toEqual({ lama: '-', berangkat: '-', kembali: '-' })
  })
})
