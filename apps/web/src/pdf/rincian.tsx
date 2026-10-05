import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { BarisBiaya, PelaksanaHasil } from '@spjan/shared'

import { angka, nipCetak, type DataDokumen } from './data'
import { PDF_FONT } from './fonts'

const B = '0.75pt solid #000'
const COL = { no: 24, jumlah: 90, ket: 120 }

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 28, paddingHorizontal: 30, fontFamily: PDF_FONT, fontSize: 9.5, lineHeight: 1.25 },
  bingkai: { border: B },
  judul: { textAlign: 'center', fontWeight: 700, fontSize: 11.5, paddingVertical: 6 },
  info: { flexDirection: 'row', paddingHorizontal: 22 },
  infoLabel: { width: 96 },
  infoTitik: { width: 14 },
  baris: { flexDirection: 'row' },
  kanan: { textAlign: 'right' },
})

const strip = (n: number): string => (n === 0 ? '-' : angka(n))

function Baris({
  no,
  jumlah,
  ket,
  children,
  atas,
  bawah,
  tinggi,
}: {
  no?: string
  jumlah?: string
  ket?: string
  children?: React.ReactNode
  atas?: boolean
  bawah?: boolean
  tinggi?: number
}) {
  const garis = { ...(atas ? { borderTop: B } : {}), ...(bawah ? { borderBottom: B } : {}) }
  return (
    <View style={[s.baris, garis, tinggi ? { height: tinggi } : {}]} wrap={false}>
      <View style={{ width: COL.no, paddingLeft: 4 }}>
        <Text>{no}</Text>
      </View>
      <View style={{ flex: 1, borderLeft: B, paddingHorizontal: 4 }}>{children}</View>
      <View style={{ width: COL.jumlah, borderLeft: B, paddingHorizontal: 4 }}>
        <Text style={s.kanan}>{jumlah}</Text>
      </View>
      <View style={{ width: COL.ket, borderLeft: B, paddingHorizontal: 4 }}>
        <Text>{ket}</Text>
      </View>
    </View>
  )
}

function Uraian({ b, tanda }: { b: BarisBiaya; tanda?: boolean }) {
  return (
    <View style={s.baris}>
      {tanda ? <Text style={{ width: 10 }}>-</Text> : null}
      <Text style={{ flex: 1 }}>{b.uraian}</Text>
      {b.qty ? (
        <View style={s.baris}>
          <Text style={{ width: 18, textAlign: 'right' }}>{b.qty}</Text>
          <Text style={{ width: 36, textAlign: 'center' }}>{b.satuan}</Text>
          <Text style={{ width: 12, textAlign: 'center' }}>@</Text>
          <Text style={{ width: 20 }}>Rp.</Text>
          <Text style={{ width: 50, textAlign: 'right' }}>{angka(b.tarif ?? 0)}</Text>
        </View>
      ) : null}
    </View>
  )
}

function Bagian({ no, judul, baris, jumlah, tanda }: { no: string; judul: string; baris: BarisBiaya[]; jumlah: number; tanda: boolean }) {
  return (
    <>
      <Baris no={no}>
        <Text>{judul}</Text>
      </Baris>
      {baris.map((b, i) => (
        <Baris key={i} jumlah={angka(b.jumlah)} ket={b.keterangan}>
          <Uraian b={b} tanda={tanda && b.uraian !== 'selama :' && b.uraian !== 'Representasi selama :' && !b.uraian.startsWith('Uang saku')} />
        </Baris>
      ))}
      <Baris jumlah={strip(jumlah)}>
        <Text style={[s.kanan, { fontWeight: 700 }]}>JUMLAH</Text>
      </Baris>
      <Baris tinggi={5} />
    </>
  )
}

export function RincianPage({ d, p }: { d: DataDokumen; p: PelaksanaHasil }) {
  const pp = d.pengaturan
  const uangHarian = [...p.uangHarian, ...p.representasi]
  return (
    <Page size="A4" style={s.page}>
      <View style={s.bingkai}>
        <Text style={s.judul}>RINCIAN  BIAYA  PERJALANAN  DINAS</Text>
        <View style={s.info}>
          <Text style={s.infoLabel}>Lampiran SPD No.</Text>
          <Text style={s.infoTitik}>:</Text>
          <Text>{p.noSpd}</Text>
        </View>
        <View style={[s.info, { marginBottom: 4 }]}>
          <Text style={s.infoLabel}>Tanggal</Text>
          <Text style={s.infoTitik}>:</Text>
          <Text>{p.teksTanggalSpd || d.teksTanggalSt}</Text>
        </View>

        <Baris no="No." jumlah="Jumlah  Rp." ket="Keterangan" atas bawah>
          <Text style={{ textAlign: 'center' }}>Rincian biaya</Text>
        </Baris>
        <Baris tinggi={5} />
        <Bagian no="1" judul="Biaya transport pegawai :" baris={p.transport} jumlah={p.totalTransport} tanda />
        <Bagian no="2" judul="Uang harian :" baris={uangHarian} jumlah={p.totalUangHarian + p.totalRepresentasi} tanda={false} />
        <Bagian no="3" judul="Biaya Penginapan :" baris={p.penginapan} jumlah={p.totalPenginapan} tanda />

        <View style={[s.baris, { borderTop: B, borderBottom: B }]} wrap={false}>
          <View style={{ flex: 1, paddingLeft: 22, paddingVertical: 2 }}>
            <Text>Jumlah    :</Text>
          </View>
          <View style={{ width: COL.jumlah, borderLeft: B, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Text style={[s.kanan, { fontWeight: 700 }]}>{angka(p.total)}</Text>
          </View>
          <View style={{ width: COL.ket, borderLeft: B, paddingHorizontal: 4, paddingVertical: 2 }} />
        </View>
        <View style={{ borderBottom: B, paddingHorizontal: 22, paddingVertical: 2 }} wrap={false}>
          <Text>
            Terbilang :{'  '}
            {p.terbilang}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 22, paddingTop: 10 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>{' '}</Text>
            <Text>Telah dibayar jumlah :</Text>
            <Text style={{ fontWeight: 700 }}>Rp {angka(p.total)}</Text>
            <Text>Bendahara Pengeluaran Pembantu</Text>
            <View style={{ height: 40 }} />
            <Text>{pp.bendaharaNama}</Text>
            <Text>{nipCetak(pp.bendaharaNip)}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 24 }}>
            <Text>{d.tempatTanggal}</Text>
            <Text>Telah menerima uang sebesar :</Text>
            <Text style={{ fontWeight: 700 }}>Rp {angka(p.total)}</Text>
            <Text>Yang Menerima</Text>
            <View style={{ height: 40 }} />
            <Text>{p.nama}</Text>
            <Text>{nipCetak(p.nip)}</Text>
          </View>
        </View>

        <View style={{ borderTop: B, marginTop: 14, paddingTop: 8 }} wrap={false}>
          <Text style={{ textAlign: 'center', fontWeight: 700, fontSize: 11.5, marginBottom: 8 }}>PERHITUNGAN SPD RAMPUNG</Text>
          {(
            [
              ['Ditetapkan sejumlah', angka(p.total)],
              ['Yang telah dibayar semula', ''],
              ['Sisa kurang/lebih', angka(p.total)],
            ] as const
          ).map(([label, nilai]) => (
            <View key={label} style={[s.baris, { paddingLeft: 6 }]}>
              <Text style={{ width: 12 }}>-</Text>
              <Text style={{ width: 150 }}>{label}</Text>
              <Text style={{ width: 14 }}>:</Text>
              <Text style={{ width: 28 }}>Rp.</Text>
              <Text style={{ width: 70, textAlign: 'right' }}>{nilai}</Text>
            </View>
          ))}
          <View style={{ marginLeft: 270, marginTop: 14, paddingBottom: 10 }}>
            <Text>Pejabat Pembuat Komitmen,</Text>
            <View style={{ height: 40 }} />
            <Text>{pp.ppkNama}</Text>
            <Text>{pp.ppkNip}</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}
