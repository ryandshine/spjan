import { Document } from '@react-pdf/renderer'
import type { ModelLaporan } from '@spjan/shared'

import { DokumentasiPage } from './dokumentasi'
import { DprPage } from './dpr'
import { KuitansiPage } from './kuitansi'
import { LaporanPages } from './laporan'
import type { DataDokumen } from './data'
import { RincianPage } from './rincian'
import { SpdPage } from './spd'
import { SptbPage } from './sptb'

export type JenisDokumen = 'spd' | 'sptb' | 'rincian' | 'kuitansi' | 'dpr' | 'dokumentasi' | 'laporan' | 'semua'

/**
 * Satu berkas PDF. `indeks` membatasi SPD/Rincian/Kuitansi/DPR ke satu pelaksana (0-based);
 * tanpa `indeks` semua pelaksana dicetak berurutan. 'semua' = SPTB lalu SPD, Rincian, Kuitansi, DPR (bila ada biaya riil) tiap pelaksana, dan Dokumentasi (bila ada).
 */
export function SpjDocument({ d, jenis, indeks, laporan, gambarLaporan }: { d: DataDokumen; jenis: JenisDokumen; indeks?: number; laporan?: ModelLaporan; gambarLaporan?: Record<number, string> }) {
  const terpilih = d.pelaksana.map((p, i) => ({ p, i })).filter(({ i }) => indeks === undefined || i === indeks)
  const adaDokumentasi = d.dokumentasi && d.dokumentasi.length > 0

  return (
    <Document title={`${jenis === 'laporan' ? 'Laporan' : 'SPJ'} ${d.st.nomor}`} author="SPJAN" language="id">
      {jenis === 'sptb' || jenis === 'semua' ? <SptbPage d={d} /> : null}
      {jenis === 'semua'
        ? [
            ...terpilih.flatMap(({ p, i }) => [
              <SpdPage key={`spd${i}`} d={d} p={p} payload={d.st.pelaksana?.[i]} />,
              <RincianPage key={`r${i}`} d={d} p={p} />,
              <KuitansiPage key={`k${i}`} d={d} p={p} />,
              ...(p.pengeluaranRiil && p.pengeluaranRiil.length > 0 ? [<DprPage key={`dpr${i}`} d={d} p={p} />] : []),
            ]),
            ...(adaDokumentasi ? [<DokumentasiPage key="dok" d={d} />] : []),
          ]
        : null}
      {jenis === 'spd' ? terpilih.map(({ p, i }) => <SpdPage key={i} d={d} p={p} payload={d.st.pelaksana?.[i]} />) : null}
      {jenis === 'rincian' ? terpilih.map(({ p, i }) => <RincianPage key={i} d={d} p={p} />) : null}
      {jenis === 'kuitansi' ? terpilih.map(({ p, i }) => <KuitansiPage key={i} d={d} p={p} />) : null}
      {jenis === 'dpr' ? terpilih.map(({ p, i }) => <DprPage key={i} d={d} p={p} />) : null}
      {jenis === 'dokumentasi' ? <DokumentasiPage d={d} /> : null}
      {jenis === 'laporan' && laporan ? <LaporanPages m={laporan} gambar={gambarLaporan} /> : null}
    </Document>
  )
}
