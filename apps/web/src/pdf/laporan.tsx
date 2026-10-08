import { Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { BagianModel, ModelLaporan, NodeDok } from '@spjan/shared'

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
  paragrafDalam: { textAlign: 'justify', marginBottom: 2 },
  gambarDok: { maxWidth: '100%', maxHeight: 280, objectFit: 'contain', marginVertical: 6 },
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

type Gambar = Record<number, string>
type Rata = 'left' | 'center' | 'right' | 'justify'

const rataDari = (n: NodeDok): Rata | undefined => {
  const a = n.attrs?.textAlign
  return a === 'left' || a === 'center' || a === 'right' || a === 'justify' ? a : undefined
}

/** Teks dalam satu paragraf: tebal, miring, garis bawah, dan tautan. */
function runs(nodes: NodeDok[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === 'hardBreak') return '\n'
    if (n.type !== 'text') return null
    const tanda = n.marks ?? []
    const tautan = tanda.find((t) => t.type === 'link')
    const href = typeof tautan?.attrs?.href === 'string' ? tautan.attrs.href : null
    const gaya = {
      ...(tanda.some((t) => t.type === 'bold') ? { fontWeight: 700 as const } : {}),
      ...(tanda.some((t) => t.type === 'italic') ? { fontStyle: 'italic' as const } : {}),
      ...(tanda.some((t) => t.type === 'underline') || href ? { textDecoration: 'underline' as const } : {}),
      ...(href ? { color: '#0b57d0' } : {}),
    }
    const teks = <Text key={i} style={gaya}>{n.text}</Text>
    return href ? <Link key={i} src={href}>{teks}</Link> : teks
  })
}

/** Satu node blok dokumen menjadi elemen PDF; `dalam` = di dalam daftar atau sel tabel. */
function blokDok(n: NodeDok, key: string | number, gambar: Gambar, dalam = false, tebal = false): React.ReactNode {
  switch (n.type) {
    case 'paragraph': {
      if (!n.content?.length) return null
      const panjang = n.content.some((x) => /\S{28,}/.test(x.text ?? ''))
      const rata = rataDari(n) ?? (panjang ? 'left' : 'justify')
      return (
        <Text key={key} style={[dalam ? s.paragrafDalam : s.paragraf, { textAlign: rata }, tebal ? { fontWeight: 700 } : {}]}>
          {runs(n.content)}
        </Text>
      )
    }
    case 'heading': {
      const rata = rataDari(n)
      return n.content?.length ? (
        <Text key={key} style={[s.subjudul, rata ? { textAlign: rata } : {}]}>{runs(n.content)}</Text>
      ) : null
    }
    case 'bulletList':
    case 'orderedList': {
      const urut = n.type === 'orderedList'
      const mulai = typeof n.attrs?.start === 'number' ? n.attrs.start : 1
      return (
        <View key={key} style={{ marginBottom: 4 }}>
          {(n.content ?? []).map((li, i) => (
            <View key={i} style={s.butir} wrap={false}>
              <Text style={s.penanda}>{urut ? `${mulai + i}.` : '•'}</Text>
              <View style={{ flex: 1 }}>{(li.content ?? []).map((c, j) => blokDok(c, j, gambar, true))}</View>
            </View>
          ))}
        </View>
      )
    }
    case 'image': {
      const id = n.attrs?.berkasId
      const src = typeof id === 'number' ? gambar[id] : undefined
      return src ? <Image key={key} style={s.gambarDok} src={src} /> : null
    }
    default:
      return null
  }
}

/** Tabel dokumen: [baris judul + baris pertama] terikat, baris berikutnya satuan masing-masing. */
function satuanTabelDok(n: NodeDok, gambar: Gambar): React.ReactNode[] {
  const baris = (n.content ?? []).map((tr, i) => (
    <View key={i} style={[s.baris, i === 0 ? s.barisAtas : {}]} wrap={false}>
      {(tr.content ?? []).map((sel, k) => (
        <View key={k} style={[s.sel, k > 0 ? s.garisSel : {}, { flex: 1 }]}>
          {(sel.content ?? []).map((c, j) => blokDok(c, j, gambar, true, sel.type === 'tableHeader'))}
        </View>
      ))}
    </View>
  ))
  const [pertama, kedua, ...sisa] = baris
  return [
    <View key="h" wrap={false}>
      {pertama}
      {kedua}
    </View>,
    ...sisa,
  ]
}

/** Satuan kecil yang mengalir antar halaman; item pertama diikat ke judul bagian. */
function satuanDok(dok: { content?: NodeDok[] }, gambar: Gambar): React.ReactNode[] {
  return (dok.content ?? []).flatMap((n, i): React.ReactNode[] => {
    if (n.type === 'table') return satuanTabelDok(n, gambar).map((x, j) => <View key={`${i}-${j}`}>{x}</View>)
    const e = blokDok(n, i, gambar)
    return e ? [e] : []
  })
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

function satuanBagian(b: BagianModel, gambar: Gambar): React.ReactNode[] {
  const isi = b.isi
  if (isi.jenis === 'dokumen') return satuanDok(isi.dok, gambar)
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
          {f.keterangan ? <Text style={s.keterangan}>{f.keterangan}</Text> : null}
        </View>
      ))}
    </View>
  ))
}

function Bagian({ b, gambar }: { b: BagianModel; gambar: Gambar }) {
  const [pertama, ...sisa] = satuanBagian(b, gambar)
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
export function LaporanPages({ m, gambar = {} }: { m: ModelLaporan; gambar?: Gambar }) {
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
          <Bagian key={b.id} b={b} gambar={gambar} />
        ))}
        <Text style={s.nomorHal} fixed render={({ pageNumber, totalPages }) => `${pageNumber - 1} / ${totalPages - 1}`} />
      </Page>
    </>
  )
}
