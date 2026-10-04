import { Document } from '@react-pdf/renderer'

import type { DataDokumen } from './data'
import { SptbPage } from './sptb'

export type JenisDokumen = 'sptb' | 'rincian' | 'kuitansi' | 'semua'

/** Versi tugas 1: hanya SPTB. Rincian dan Kuitansi ditambahkan pada tugas berikutnya. */
export function SpjDocument({ d, jenis }: { d: DataDokumen; jenis: JenisDokumen; indeks?: number }) {
  return (
    <Document title={`SPJ ${d.st.nomor}`} author="SPJAN" language="id">
      {jenis === 'sptb' || jenis === 'semua' ? <SptbPage d={d} /> : null}
    </Document>
  )
}
