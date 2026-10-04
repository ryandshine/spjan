import { Document } from '@react-pdf/renderer'

import type { DataDokumen } from './data'
import { RincianPage } from './rincian'
import { SptbPage } from './sptb'

export type JenisDokumen = 'sptb' | 'rincian' | 'kuitansi' | 'semua'

/** Versi tugas 2: SPTB dan Rincian. Kuitansi ditambahkan pada tugas berikutnya. */
export function SpjDocument({ d, jenis, indeks }: { d: DataDokumen; jenis: JenisDokumen; indeks?: number }) {
  const terpilih = d.pelaksana.map((p, i) => ({ p, i })).filter(({ i }) => indeks === undefined || i === indeks)
  return (
    <Document title={`SPJ ${d.st.nomor}`} author="SPJAN" language="id">
      {jenis === 'sptb' || jenis === 'semua' ? <SptbPage d={d} /> : null}
      {jenis === 'rincian' || jenis === 'semua' ? terpilih.map(({ p, i }) => <RincianPage key={i} d={d} p={p} />) : null}
    </Document>
  )
}
