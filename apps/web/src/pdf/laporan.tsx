import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Blok, BagianModel, ModelLaporan } from '@spjan/shared'

import { PDF_FONT } from './fonts'
import { LOGO_KEMENHUT_BASE64 } from './logo'

const B = '0.75pt solid #000'

const s = StyleSheet.create({
  halaman: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 56, fontFamily: PDF_FONT, fontSize: 11, lineHeight: 1.4 },
  sampul: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 56, fontFamily: PDF_FONT, fontSize: 11, alignItems: 'center' },
  kop: { fontSize: 13, fontWeight: 700, textAlign: 'center' },
  logo: { width: 110, height: 110, marginTop: 36, marginBottom: 36 },
  laporan: { fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 10 },
  judulSampul: { fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 28, lineHeight: 1.4 },
  oleh: { alignSelf: 'center', textAlign: 'center' },
  namaSampul: { textAlign: 'center' },
  tempatTanggal: { position: 'absolute', bottom: 56, left: 56, right: 56, textAlign: 'center', fontWeight: 700, fontSize: 12 },
  judulBagian: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  subjudul: { fontWeight: 700, marginTop: 8, marginBottom: 3 },
  paragraf: { textAlign: 'justify', marginBottom: 6 },
  butir: { flexDirection: 'row', marginBottom: 3, paddingLeft: 10 },
  penanda: { width: 16 },
  teksButir: { flex: 1, textAlign: 'justify' },
  baris: { flexDirection: 'row', borderLeft: B, borderRight: B, borderBottom: B },
  barisAtas: { borderTop: B },
  sel: { paddingHorizontal: 5, paddingVertical: 3 },
  garisSel: { borderLeft: B },
  kisi: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  foto: { width: '48.5%' },
  gambar: { width: '100%', height: 150, objectFit: 'contain', backgroundColor: '#f3f3f3' },
  keterangan: { marginTop: 3, textAlign: 'center', fontSize: 9.5 },
  kosong: { fontStyle: 'italic', color: '#666' },
  nomorHal: { position: 'absolute', bottom: 28, right: 56, fontSize: 9, color: '#666' },
})

function Butir({ penanda, teks }: { penanda: string; teks: string }) {
  return (
    <View style={s.butir} wrap={false}>
      <Text style={s.penanda}>{penanda}</Text>
      <Text style={s.teksButir}>{teks}</Text>
    </View>
  )
}

/** Satuan kecil yang mengalir antar halaman; item pertama diikat ke judul bagian. */
function satuanBlok(blok: Blok[]): React.ReactNode[] {
  const hasil: React.ReactNode[] = []
  blok.forEach((b, i) => {
    if (b.tipe === 'paragraf') {
      if (!b.teks.trim()) return
      // Kata sangat panjang (mis. nomor surat) membuat rata kanan-kiri merenggang; pakai rata kiri.
      const rataKiri = /\S{28,}/.test(b.teks)
      hasil.push(<Text key={i} style={[s.paragraf, rataKiri ? { textAlign: 'left' } : {}]}>{b.teks}</Text>)
    } else if (b.tipe === 'subjudul') {
      if (b.teks.trim()) hasil.push(<Text key={i} style={s.subjudul}>{b.teks}</Text>)
    } else {
      const butir = b.butir.filter((x) => x.trim())
      butir.forEach((x, n) => hasil.push(<Butir key={`${i}-${n}`} penanda={b.tipe === 'nomor' ? `${n + 1}.` : '•'} teks={x} />))
    }
  })
  return hasil
}

const selTabel = (n: number, lebar: number | undefined) => [s.sel, n > 0 ? s.garisSel : {}, lebar ? { width: lebar } : { flex: 1 }]

/** Tabel sebagai satuan: [judul kolom + baris pertama], lalu satu satuan per baris berikutnya. */
function satuanTabel(kolom: { judul: string; lebar?: number }[], baris: React.ReactNode[][]): React.ReactNode[] {
  const header = (
    <View style={[s.baris, s.barisAtas]}>
      {kolom.map((k, n) => (
        <View key={n} style={selTabel(n, k.lebar)}>
          <Text style={{ fontWeight: 700, textAlign: 'center' }}>{k.judul}</Text>
        </View>
      ))}
    </View>
  )
  const barisView = baris.map((r, i) => (
    <View key={i} style={s.baris} wrap={false}>
      {r.map((c, n) => (
        <View key={n} style={selTabel(n, kolom[n]?.lebar)}>
          {c}
        </View>
      ))}
    </View>
  ))
  const [pertama, ...sisa] = barisView
  return [
    <View key="h" wrap={false}>
      {header}
      {pertama}
    </View>,
    ...sisa,
  ]
}

function satuanBagian(b: BagianModel): React.ReactNode[] {
  const isi = b.isi
  if (isi.jenis === 'blok') return satuanBlok(isi.blok)
  if (isi.jenis === 'petugas') {
    return satuanTabel(
      [{ judul: 'No', lebar: 30 }, { judul: 'Nama' }, { judul: 'Instansi', lebar: 150 }],
      isi.baris.map((r) => [<Text style={{ textAlign: 'center' }}>{r.no}</Text>, <Text>{r.nama}</Text>, <Text>{r.instansi}</Text>]),
    )
  }
  if (isi.jenis === 'tatawaktu') {
    return satuanTabel(
      [{ judul: 'No', lebar: 30 }, { judul: 'Kegiatan' }, { judul: 'Tanggal', lebar: 120 }],
      isi.baris.map((r) => {
        const kegiatan = r.kegiatan.filter((x) => x.trim())
        return [
          <Text style={{ textAlign: 'center' }}>{r.no}</Text>,
          <View>{kegiatan.length > 1 ? kegiatan.map((x, n) => <Butir key={n} penanda="•" teks={x} />) : <Text>{kegiatan[0] ?? ''}</Text>}</View>,
          <Text>{r.tanggal}</Text>,
        ]
      }),
    )
  }
  if (isi.foto.length === 0) return [<Text key="kosong" style={s.kosong}>Belum ada foto dokumentasi.</Text>]
  const pasangan: (typeof isi.foto)[] = []
  for (let i = 0; i < isi.foto.length; i += 2) pasangan.push(isi.foto.slice(i, i + 2))
  return pasangan.map((dua, i) => (
    <View key={i} style={s.kisi} wrap={false}>
      {dua.map((f) => (
        <View key={f.id} style={s.foto}>
          <Image style={s.gambar} src={f.src} />
          <Text style={s.keterangan}>{f.keterangan || f.namaAsli}</Text>
        </View>
      ))}
    </View>
  ))
}

function Bagian({ b }: { b: BagianModel }) {
  const [pertama, ...sisa] = satuanBagian(b)
  const judul = b.judul.trim() ? (
    <Text style={s.judulBagian}>
      {b.nomor !== null ? `${b.nomor}. ` : ''}
      {b.judul}
    </Text>
  ) : null
  return (
    <>
      <View wrap={false}>
        {judul}
        {pertama}
      </View>
      {sisa}
    </>
  )
}

/** Laporan Perjalanan Dinas: halaman sampul lalu halaman isi yang mengalir. */
export function LaporanPages({ m }: { m: ModelLaporan }) {
  return (
    <>
      <Page size="A4" style={s.sampul}>
        <Text style={s.kop}>DIREKTORAT JENDERAL PERHUTANAN SOSIAL</Text>
        <Text style={s.kop}>DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL</Text>
        <Image style={s.logo} src={LOGO_KEMENHUT_BASE64} />
        <Text style={s.laporan}>LAPORAN</Text>
        <Text style={s.judulSampul}>{m.sampul.judul}</Text>
        {m.sampul.nama.length > 0 ? (
          <>
            <Text style={s.oleh}>Oleh:</Text>
            {m.sampul.nama.map((n, i) => (
              <Text key={i} style={s.namaSampul}>{n}</Text>
            ))}
          </>
        ) : null}
        <Text style={s.tempatTanggal}>{m.sampul.tempatTanggal}</Text>
      </Page>
      <Page size="A4" style={s.halaman} wrap>
        {m.bagian.map((b) => (
          <Bagian key={b.id} b={b} />
        ))}
        <Text style={s.nomorHal} fixed render={({ pageNumber, totalPages }) => `${pageNumber - 1} / ${totalPages - 1}`} />
      </Page>
    </>
  )
}
