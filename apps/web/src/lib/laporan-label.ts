import type { Bagian } from '@spjan/shared'

/** Nama bagian di kerangka dan judul panel; bagian tanpa judul disebut Tanpa judul. */
export const labelBagian = (b: Bagian): string => (b.jenis === 'sampul' ? 'Sampul' : b.judul.trim() || 'Tanpa judul')
