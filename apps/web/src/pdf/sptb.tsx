import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ComponentProps } from 'react'

import { angka, type DataDokumen } from './data'
import { PDF_FONT } from './fonts'

const W = { no: 26, akun: 132, penerima: 96, tgl: 48, nomor: 48, jumlah: 74, ppn: 44, pph: 44 }
const B = '0.75pt solid #000'
type Style = ComponentProps<typeof View>['style']

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 30, paddingHorizontal: 34, fontFamily: PDF_FONT, fontSize: 8.5, lineHeight: 1.25 },
  judul: { textAlign: 'center', fontWeight: 700, fontSize: 10, marginBottom: 16 },
  meta: { flexDirection: 'row', marginBottom: 1.5 },
  metaNo: { width: 18 },
  metaLabel: { width: 90 },
  metaTitik: { width: 14 },
  paragraf: { marginTop: 12, marginBottom: 10 },
  baris: { flexDirection: 'row' },
  sel: { borderRight: B, borderBottom: B, paddingHorizontal: 3, paddingVertical: 2 },
  tengah: { textAlign: 'center' },
  kanan: { textAlign: 'right' },
  catatan: { marginTop: 14 },
  ttd: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  ttdBlok: { width: 260 },
  ruang: { height: 46 },
})

const kolomLebar = (n: number) => ({ width: n })

function Sel({ w, children, style }: { w?: number; children?: React.ReactNode; style?: Style }) {
  return <View style={[s.sel, w ? kolomLebar(w) : { flex: 1 }, style ?? {}]}>{children}</View>
}

export function SptbPage({ d }: { d: DataDokumen }) {
  const p = d.pengaturan
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.judul}>SURAT PERNYATAAN TANGGUNG JAWAB BELANJA</Text>

      {(
        [
          ['1', 'Kode Satker', p.kodeSatker],
          ['2', 'Nama Satker', p.namaSatker],
          ['3', 'Tgl. No. DIPA', p.dasarDipa],
          ['4', 'Klasifikasi', ''],
        ] as const
      ).map(([no, label, nilai]) => (
        <View key={no} style={s.meta}>
          <Text style={s.metaNo}>{no}</Text>
          <Text style={s.metaLabel}>{label}</Text>
          <Text style={s.metaTitik}>{nilai ? ':' : ''}</Text>
          <Text>{nilai}</Text>
        </View>
      ))}
      <View style={s.meta}>
        <Text style={s.metaNo} />
        <Text style={s.metaLabel}>Anggaran</Text>
        <Text style={s.metaTitik}>:</Text>
        <Text style={{ fontWeight: 700 }}>{d.kodeAkun}</Text>
      </View>

      <Text style={s.paragraf}>
        Yang bertanda tangan di bawah ini atas nama Pejabat Pembuat Komitmen Satuan Kerja Direktorat Pengendalian PS menyatakan bahwa saya
        bertanggung jawab secara formal dan material atas segala pengeluaran yang telah dibayar lunas oleh Bendahara Pengeluaran kepada yang
        berhak menerima serta kebenaran perhitungan dan setoran pajak yang telah dipungut atas pembayaran tersebut dengan rincian sebagai
        berikut :
      </Text>

      <View style={{ borderTop: B, borderLeft: B }}>
        {/* judul kolom */}
        <View style={s.baris} wrap={false}>
          <Sel w={W.no} style={{ height: 42, justifyContent: 'center' }}>
            <Text style={s.tengah}>No.</Text>
          </Sel>
          <Sel w={W.akun} style={{ height: 42, justifyContent: 'center' }}>
            <Text style={s.tengah}>AKUN</Text>
          </Sel>
          <Sel w={W.penerima} style={{ height: 42, justifyContent: 'center' }}>
            <Text style={s.tengah}>PENERIMA</Text>
          </Sel>
          <Sel style={{ height: 42, justifyContent: 'center' }}>
            <Text style={s.tengah}>URAIAN</Text>
          </Sel>
          <View style={{ width: W.tgl + W.nomor, height: 42, borderRight: B }}>
            <View style={{ height: 26, borderBottom: B, justifyContent: 'center' }}>
              <Text style={s.tengah}>Bukti</Text>
            </View>
            <View style={{ flexDirection: 'row', height: 16 }}>
              <View style={{ width: W.tgl, height: 16, borderRight: B, borderBottom: B, justifyContent: 'center' }}>
                <Text style={s.tengah}>Tanggal</Text>
              </View>
              <View style={{ width: W.nomor, height: 16, borderBottom: B, justifyContent: 'center' }}>
                <Text style={s.tengah}>Nomor</Text>
              </View>
            </View>
          </View>
          <Sel w={W.jumlah} style={{ height: 42, justifyContent: 'center' }}>
            <Text style={s.tengah}>Jumlah</Text>
          </Sel>
          <View style={{ width: W.ppn + W.pph, height: 42, borderRight: B }}>
            <View style={{ height: 26, borderBottom: B, justifyContent: 'center', paddingHorizontal: 2 }}>
              <Text style={[s.tengah, { fontSize: 7, lineHeight: 1.15 }]}>
                Pajak yang dipungut Bendahara Pengeluaran
              </Text>
            </View>
            <View style={{ flexDirection: 'row', height: 16 }}>
              <View style={{ width: W.ppn, height: 16, borderRight: B, borderBottom: B, justifyContent: 'center' }}>
                <Text style={s.tengah}>PPN</Text>
              </View>
              <View style={{ width: W.pph, height: 16, borderBottom: B, justifyContent: 'center' }}>
                <Text style={s.tengah}>PPh</Text>
              </View>
            </View>
          </View>
        </View>
        {/* nomor kolom */}
        <View style={s.baris} wrap={false}>
          {[W.no, W.akun, W.penerima, undefined, W.tgl, W.nomor, W.jumlah, W.ppn, W.pph].map((w, i) => (
            <Sel key={i} w={w}>
              <Text style={s.tengah}>{i + 1}</Text>
            </Sel>
          ))}
        </View>
        {/* isi */}
        {d.pelaksana.map((x, i) => (
          <View key={i} style={s.baris} wrap={false}>
            <Sel w={W.no}>
              <Text style={s.tengah}>{i + 1}</Text>
            </Sel>
            <Sel w={W.akun}>
              <Text>{d.kodeAkun}</Text>
            </Sel>
            <Sel w={W.penerima}>
              <Text>{x.nama}</Text>
            </Sel>
            <Sel>
              <Text>{x.uraianSptb}</Text>
            </Sel>
            <Sel w={W.tgl} />
            <Sel w={W.nomor} />
            <Sel w={W.jumlah}>
              <Text style={s.kanan}>{angka(x.total)}</Text>
            </Sel>
            <Sel w={W.ppn} />
            <Sel w={W.pph} />
          </View>
        ))}
        {/* total */}
        <View style={s.baris} wrap={false}>
          <Sel>
            <Text style={[s.tengah, { fontWeight: 700 }]}>TOTAL</Text>
          </Sel>
          <Sel w={W.jumlah}>
            <Text style={s.kanan}>{angka(d.total)}</Text>
          </Sel>
          <Sel w={W.ppn}>
            <Text style={s.tengah}>-</Text>
          </Sel>
          <Sel w={W.pph}>
            <Text style={s.tengah}>-</Text>
          </Sel>
        </View>
      </View>

      <Text style={s.catatan}>
        Bukti-bukti pengeluaran anggaran dan asli setoran pajak (SSP/BPN) tersebut di atas disimpan oleh pengguna anggaran/Kuasa Pengguna Anggaran
        untuk kelengkapan administrasi dan pemeriksaan aparat pengawas fungsional.
      </Text>
      <Text style={{ marginTop: 4 }}>Demikian surat pernyataan ini dibuat dengan sebenarnya.</Text>

      <View style={s.ttd} wrap={false}>
        <View style={s.ttdBlok}>
          <Text> </Text>
          <Text>Pejabat Pembuat Komitmen</Text>
          <View style={s.ruang} />
          <Text>{p.ppkNama}</Text>
          <Text>{p.ppkNip}</Text>
        </View>
        <View style={s.ttdBlok}>
          <Text>{d.tempatTanggal}</Text>
          <Text>Pembuat Daftar,</Text>
          <View style={s.ruang} />
          <Text>{d.pembuatDaftar.nama}</Text>
          <Text>{d.pembuatDaftar.nip}</Text>
        </View>
      </View>
    </Page>
  )
}
