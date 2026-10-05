import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { PelaksanaHasil } from '@spjan/shared'

import { angka, nipCetak, type DataDokumen } from './data'
import { PDF_FONT } from './fonts'

const B = '0.75pt solid #000'

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 30, paddingHorizontal: 34, fontFamily: PDF_FONT, fontSize: 10, lineHeight: 1.3 },
  bingkai: { border: B },
  baris: { flexDirection: 'row' },
  label: { width: 112 },
  titik: { width: 12 },
  blok: { paddingHorizontal: 6, paddingVertical: 5 },
})

function Isian({ label, children, tinggi }: { label: string; children: React.ReactNode; tinggi?: number }) {
  return (
    <View style={[s.baris, { paddingHorizontal: 6, paddingVertical: 4 }, tinggi ? { minHeight: tinggi } : {}]} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.titik}>:</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

export function KuitansiPage({ d, p }: { d: DataDokumen; p: PelaksanaHasil }) {
  const pp = d.pengaturan
  return (
    <Page size="A4" style={s.page}>
      <View style={s.bingkai}>
        <View style={s.baris}>
          <View style={[s.blok, { flex: 1 }]}>
            <Text style={{ fontWeight: 700 }}>KEMENTERIAN KEHUTANAN</Text>
            <Text style={{ fontWeight: 700 }}>DIREKTORAT JENDERAL PERHUTANAN SOSIAL</Text>
            <Text>Gd. Manggala Wanabakti Blok IV Lt. 6</Text>
            <Text>Jl. Gatot Soebroto – Senayan Jakarta</Text>
          </View>
          <View style={{ width: 262, borderLeft: B, borderBottom: B, padding: 5 }}>
            {(
              [
                ['Tahun Anggaran', String(pp.tahunAnggaran)],
                ['Nomor Bukti', ''],
                ['Mata Anggaran', d.kodeAkun],
              ] as const
            ).map(([label, nilai]) => (
              <View key={label} style={s.baris}>
                <Text style={{ width: 80 }}>{label}</Text>
                <Text style={{ width: 10 }}>:</Text>
                <Text style={{ flex: 1 }}>{nilai}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={{ textAlign: 'center', fontWeight: 700, fontSize: 11.5, paddingTop: 30, paddingBottom: 14 }}>KWITANSI / BUKTI PEMBAYARAN</Text>

        <View style={{ borderTop: B }}>
          <Isian label="SUDAH TERIMA DARI">
            <Text>
              KUASA PENGGUNA ANGGARAN / PEJABAT PEMBUAT KOMITMEN SATKER KANTOR PUSAT DIREKTORAT JENDERAL PERHUTANAN SOSIAL ANGGARAN{' '}
              {pp.tahunAnggaran}
            </Text>
          </Isian>
          <Isian label="JUMLAH UANG">
            <Text>Rp. {angka(p.total)}</Text>
          </Isian>
          <Isian label="TERBILANG">
            <Text style={{ fontStyle: 'italic' }}>{p.terbilang}</Text>
          </Isian>
          <Isian label="UNTUK PEMBAYARAN" tinggi={92}>
            <Text>{p.uraianSptb}</Text>
          </Isian>
        </View>

        <View style={[s.baris, { justifyContent: 'flex-end', paddingRight: 24, paddingTop: 8, paddingBottom: 12 }]} wrap={false}>
          <View style={{ width: 230 }}>
            <Text>{d.tempatTanggal}</Text>
            <Text>Yang Menerima,</Text>
            <View style={{ height: 52 }} />
            <Text style={{ fontWeight: 700 }}>{p.nama}</Text>
            <Text style={{ fontWeight: 700 }}>{nipCetak(p.nip)}</Text>
          </View>
        </View>

        <View style={[s.baris, { borderTop: B, padding: 6 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>Sesuai dibebankan pada mata anggaran berkenaan</Text>
            <Text>a.n. Kuasa Pengguna Anggaran</Text>
            <Text>Pejabat Pembuat Komitmen</Text>
            <View style={{ height: 52 }} />
            <Text style={{ fontWeight: 700 }}>{pp.ppkNama}</Text>
            <Text style={{ fontWeight: 700 }}>{nipCetak(pp.ppkNip)}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 24 }}>
            <Text>Lunas dibayar,</Text>
            <Text>Bendahara Pengeluaran Pembantu</Text>
            <View style={{ height: 66 }} />
            <Text style={{ fontWeight: 700 }}>{pp.bendaharaNama}</Text>
            <Text style={{ fontWeight: 700 }}>{nipCetak(pp.bendaharaNip)}</Text>
          </View>
        </View>

        <View style={{ borderTop: B, padding: 6 }} wrap={false}>
          <Text>Barang / pekerjaan tersebut telah diterima / diselesaikan dengan lengkap dan baik</Text>
          <Text>Pejabat yang bertanggungjawab,</Text>
          <Text>{pp.pjJabatan}</Text>
          <View style={{ height: 46 }} />
          <Text style={{ fontWeight: 700 }}>{pp.pjNama}</Text>
          <Text style={{ fontWeight: 700 }}>{nipCetak(pp.pjNip)}</Text>
        </View>
      </View>
    </Page>
  )
}
