import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { PelaksanaHasil } from '@spjan/shared'

import { angka, nipCetak, type DataDokumen } from './data'
import { PDF_FONT } from './fonts'

const B = '0.75pt solid #000'

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 34,
    paddingHorizontal: 38,
    fontFamily: PDF_FONT,
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  bingkai: {
    border: B,
    padding: 18,
  },
  judul: {
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 11.5,
    textDecoration: 'underline',
    marginBottom: 16,
  },
  paragraf: {
    textAlign: 'justify',
    marginBottom: 6,
  },
  baris: {
    flexDirection: 'row',
  },
  identitasLabel: {
    width: 80,
  },
  identitasTitik: {
    width: 14,
  },
  identitasNilai: {
    flex: 1,
  },
  tabel: {
    borderTop: B,
    borderLeft: B,
    marginTop: 8,
    marginBottom: 6,
  },
  sel: {
    borderRight: B,
    borderBottom: B,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  tengah: {
    textAlign: 'center',
  },
  kanan: {
    textAlign: 'right',
  },
  tebal: {
    fontWeight: 700,
  },
})

export function DprPage({ d, p }: { d: DataDokumen; p: PelaksanaHasil }) {
  const pp = d.pengaturan
  const items = p.pengeluaranRiil ?? []
  const total = p.totalPengeluaranRiil ?? 0
  const terbilang = p.terbilangPengeluaranRiil || 'Nol Rupiah'

  return (
    <Page size="A4" style={s.page}>
      <View style={s.bingkai}>
        <Text style={s.judul}>DAFTAR PENGELUARAN RIIL</Text>

        <Text style={{ marginBottom: 4 }}>Yang bertanda tangan di bawah ini:</Text>
        <View style={{ paddingLeft: 10, marginBottom: 8 }}>
          <View style={s.baris}>
            <Text style={s.identitasLabel}>Nama</Text>
            <Text style={s.identitasTitik}>:</Text>
            <Text style={[s.identitasNilai, s.tebal]}>{p.nama}</Text>
          </View>
          <View style={s.baris}>
            <Text style={s.identitasLabel}>NIP</Text>
            <Text style={s.identitasTitik}>:</Text>
            <Text style={s.identitasNilai}>{p.nip || '-'}</Text>
          </View>
          <View style={s.baris}>
            <Text style={s.identitasLabel}>Jabatan</Text>
            <Text style={s.identitasTitik}>:</Text>
            <Text style={s.identitasNilai}>{p.jabatan || '-'}</Text>
          </View>
        </View>

        <Text style={s.paragraf}>
          Berdasarkan Surat Perjalanan Dinas (SPD) Nomor: {p.noSpd || '-'} tanggal {d.teksTanggalSt}, dengan ini kami menyatakan dengan
          sesungguhnya bahwa:
        </Text>

        <Text style={[s.paragraf, { marginTop: 4 }]}>
          1. Biaya transpor pegawai dan/atau biaya penginapan di bawah ini yang tidak dapat diperoleh bukti-bukti pengeluarannya, meliputi:
        </Text>

        {/* Tabel */}
        <View style={s.tabel}>
          {/* Header */}
          <View style={[s.baris, s.tebal]} wrap={false}>
            <View style={[s.sel, { width: 32, justifyContent: 'center' }]}>
              <Text style={s.tengah}>No</Text>
            </View>
            <View style={[s.sel, { flex: 1, justifyContent: 'center' }]}>
              <Text style={s.tengah}>Uraian</Text>
            </View>
            <View style={[s.sel, { width: 110, justifyContent: 'center' }]}>
              <Text style={s.tengah}>Jumlah (Rp)</Text>
            </View>
          </View>

          {/* Baris data */}
          {items.length > 0 ? (
            items.map((b, i) => (
              <View key={i} style={s.baris} wrap={false}>
                <View style={[s.sel, { width: 32 }]}>
                  <Text style={s.tengah}>{i + 1}.</Text>
                </View>
                <View style={[s.sel, { flex: 1 }]}>
                  <Text>{b.uraian}{b.qty && b.qty > 1 ? ` (${b.qty} ${b.satuan || 'kali'} @ Rp ${angka(b.tarif ?? 0)})` : ''}</Text>
                </View>
                <View style={[s.sel, { width: 110 }]}>
                  <Text style={s.kanan}>{angka(b.jumlah)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={s.baris} wrap={false}>
              <View style={[s.sel, { width: 32 }]}>
                <Text style={s.tengah}>-</Text>
              </View>
              <View style={[s.sel, { flex: 1 }]}>
                <Text style={{ fontStyle: 'italic', color: '#666' }}>Tidak ada pengeluaran riil tanpa bukti</Text>
              </View>
              <View style={[s.sel, { width: 110 }]}>
                <Text style={s.kanan}>0</Text>
              </View>
            </View>
          )}

          {/* Baris Total */}
          <View style={[s.baris, s.tebal]} wrap={false}>
            <View style={[s.sel, { width: 32 }]}>
              <Text style={s.tengah} />
            </View>
            <View style={[s.sel, { flex: 1 }]}>
              <Text style={s.kanan}>Jumlah Total</Text>
            </View>
            <View style={[s.sel, { width: 110 }]}>
              <Text style={s.kanan}>{angka(total)}</Text>
            </View>
          </View>
        </View>

        <Text style={{ fontStyle: 'italic', marginBottom: 10, fontSize: 9 }}>
          (Terbilang: {terbilang})
        </Text>

        <Text style={s.paragraf}>
          2. Jumlah uang tersebut di atas benar-benar dikeluarkan untuk pelaksanaan perjalanan dinas dimaksud dan apabila di kemudian hari
          terdapat kelebihan atas pembayaran, kami bersedia untuk menyetorkan kelebihan tersebut ke Kas Negara.
        </Text>

        <Text style={[s.paragraf, { marginTop: 4 }]}>
          Demikian pernyataan ini kami buat dengan sebenarnya, untuk dipergunakan sebagaimana mestinya.
        </Text>

        {/* Tanda Tangan */}
        <View style={[s.baris, { justifyContent: 'space-between', marginTop: 22 }]} wrap={false}>
          <View style={{ width: 220 }}>
            <Text>Mengetahui/Menyetujui,</Text>
            <Text>Pejabat Pembuat Komitmen,</Text>
            <View style={{ height: 48 }} />
            <Text style={s.tebal}>{pp.ppkNama}</Text>
            <Text>{nipCetak(pp.ppkNip)}</Text>
          </View>
          <View style={{ width: 220, paddingLeft: 10 }}>
            <Text>{d.tempatTanggal}</Text>
            <Text>Pelaksana SPD,</Text>
            <View style={{ height: 48 }} />
            <Text style={s.tebal}>{p.nama}</Text>
            <Text>{nipCetak(p.nip)}</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}
