import { Document } from '@react-pdf/renderer'

import { KuitansiPage } from './kuitansi'
import type { DataDokumen } from './data'
import { RincianPage } from './rincian'
import { SptbPage } from './sptb'

export type JenisDokumen = 'sptb' | 'rincian' | 'kuitansi' | 'semua'

/**
 * Satu berkas PDF. `indeks` membatasi Rincian/Kuitansi ke satu pelaksana (0-based);
 * tanpa `indeks` semua pelaksana dicetak berurutan. 'semua' = SPTB lalu Rincian dan Kuitansi tiap pelaksana.
 */
export function SpjDocument({ d, jenis, indeks }: { d: DataDokumen; jenis: JenisDokumen; indeks?: number }) {
  const terpilih = d.pelaksana.map((p, i) => ({ p, i })).filter(({ i }) => indeks === undefined || i === indeks)
  return (
    <Document title={`SPJ ${d.st.nomor}`} author="SPJAN" language="id">
      {jenis === 'sptb' || jenis === 'semua' ? <SptbPage d={d} /> : null}
      {jenis === 'semua'
        ? terpilih.flatMap(({ p, i }) => [<RincianPage key={`r${i}`} d={d} p={p} />, <KuitansiPage key={`k${i}`} d={d} p={p} />])
        : null}
      {jenis === 'rincian' ? terpilih.map(({ p, i }) => <RincianPage key={i} d={d} p={p} />) : null}
      {jenis === 'kuitansi' ? terpilih.map(({ p, i }) => <KuitansiPage key={i} d={d} p={p} />) : null}
    </Document>
  )
}
