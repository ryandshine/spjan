import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { FotoDokumentasi } from '@spjan/shared'

import { nipCetak, type DataDokumen } from './data'
import { PDF_FONT } from './fonts'

const B = '0.75pt solid #000'
const FOTO_PER_HALAMAN = 2

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 26,
    paddingHorizontal: 32,
    fontFamily: PDF_FONT,
    fontSize: 9,
    lineHeight: 1.3,
  },
  kop: {
    textAlign: 'center',
    marginBottom: 10,
    borderBottom: B,
    paddingBottom: 6,
  },
  instansi: {
    fontSize: 10,
    fontWeight: 700,
  },
  judul: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 4,
    textDecoration: 'underline',
  },
  metaBox: {
    border: B,
    padding: 6,
    marginBottom: 10,
  },
  barisMeta: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  labelMeta: {
    width: 90,
  },
  titikMeta: {
    width: 10,
  },
  nilaiMeta: {
    flex: 1,
    fontWeight: 700,
  },
  fotoGrid: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  fotoKartu: {
    border: '0.75pt solid #999',
    borderRadius: 3,
    padding: 6,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  fotoContainer: {
    height: 195,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  gambar: {
    maxHeight: '100%',
    maxWidth: '100%',
    objectFit: 'contain',
  },
  fotoInfo: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fotoCaption: {
    flex: 1,
    fontWeight: 700,
    fontSize: 8.5,
  },
  fotoNama: {
    fontSize: 7.5,
    color: '#666',
    marginTop: 1,
  },
  kosong: {
    padding: 30,
    textAlign: 'center',
    color: '#777',
    fontStyle: 'italic',
  },
  ttd: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  ttdBlok: {
    width: 230,
  },
  ruangTtd: {
    height: 42,
  },
  nomorHal: {
    position: 'absolute',
    bottom: 12,
    right: 32,
    fontSize: 7.5,
    color: '#777',
  },
})

function chunkArray<T>(arr: T[], size: number): T[][] {
  const hasil: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    hasil.push(arr.slice(i, i + size))
  }
  return hasil
}

export function DokumentasiPage({ d }: { d: DataDokumen }) {
  const pp = d.pengaturan
  const items: FotoDokumentasi[] = d.dokumentasi ?? []

  const daftarNamaPelaksana = d.pelaksana.map((p) => p.nama).filter(Boolean).join(', ') || '-'
  const kegiatanSt = d.st.catatan || d.pelaksana[0]?.uraianSptb || 'Pelaksanaan Tugas Kedinasan'
  const tujuanSt = d.pelaksana[0]?.rute || d.st.nomor

  // Jika tidak ada foto dokumentasi, tetap buat 1 halaman placeholder
  if (items.length === 0) {
    return (
      <Page size="A4" style={s.page}>
        <View style={s.kop}>
          <Text style={s.instansi}>KEMENTERIAN KEHUTANAN</Text>
          <Text style={s.instansi}>DIREKTORAT JENDERAL PERHUTANAN SOSIAL</Text>
          <Text style={s.judul}>BUKTI DOKUMENTASI KEGIATAN</Text>
        </View>

        <View style={s.metaBox}>
          <View style={s.barisMeta}>
            <Text style={s.labelMeta}>Surat Tugas</Text>
            <Text style={s.titikMeta}>:</Text>
            <Text style={s.nilaiMeta}>{d.st.nomor} (Tanggal: {d.teksTanggalSt})</Text>
          </View>
          <View style={s.barisMeta}>
            <Text style={s.labelMeta}>Kegiatan</Text>
            <Text style={s.titikMeta}>:</Text>
            <Text style={s.nilaiMeta}>{kegiatanSt}</Text>
          </View>
          <View style={s.barisMeta}>
            <Text style={s.labelMeta}>Pelaksana</Text>
            <Text style={s.titikMeta}>:</Text>
            <Text style={s.nilaiMeta}>{daftarNamaPelaksana}</Text>
          </View>
        </View>

        <View style={s.kosong}>
          <Text>Belum ada foto dokumentasi yang diunggah untuk surat tugas ini.</Text>
        </View>
      </Page>
    )
  }

  const chunks = chunkArray(items, FOTO_PER_HALAMAN)
  const totalHalaman = chunks.length

  return (
    <>
      {chunks.map((halamanItems, halamanIndex) => {
        const isHalamanTerakhir = halamanIndex === totalHalaman - 1
        return (
          <Page key={`dok-hal-${halamanIndex}`} size="A4" style={s.page}>
            <View style={s.kop}>
              <Text style={s.instansi}>KEMENTERIAN KEHUTANAN</Text>
              <Text style={s.instansi}>DIREKTORAT JENDERAL PERHUTANAN SOSIAL</Text>
              <Text style={s.judul}>BUKTI DOKUMENTASI KEGIATAN</Text>
            </View>

            {halamanIndex === 0 && (
              <View style={s.metaBox}>
                <View style={s.barisMeta}>
                  <Text style={s.labelMeta}>Nomor ST</Text>
                  <Text style={s.titikMeta}>:</Text>
                  <Text style={s.nilaiMeta}>{d.st.nomor}</Text>
                </View>
                <View style={s.barisMeta}>
                  <Text style={s.labelMeta}>Tanggal ST</Text>
                  <Text style={s.titikMeta}>:</Text>
                  <Text style={s.nilaiMeta}>{d.teksTanggalSt}</Text>
                </View>
                <View style={s.barisMeta}>
                  <Text style={s.labelMeta}>Kegiatan</Text>
                  <Text style={s.titikMeta}>:</Text>
                  <Text style={s.nilaiMeta}>{kegiatanSt}</Text>
                </View>
                <View style={s.barisMeta}>
                  <Text style={s.labelMeta}>Lokasi / Tujuan</Text>
                  <Text style={s.titikMeta}>:</Text>
                  <Text style={s.nilaiMeta}>{tujuanSt}</Text>
                </View>
                <View style={s.barisMeta}>
                  <Text style={s.labelMeta}>Pelaksana</Text>
                  <Text style={s.titikMeta}>:</Text>
                  <Text style={s.nilaiMeta}>{daftarNamaPelaksana}</Text>
                </View>
              </View>
            )}

            <View style={s.fotoGrid}>
              {halamanItems.map((foto, idxDiHal) => {
                const nomorGlobal = halamanIndex * FOTO_PER_HALAMAN + idxDiHal + 1
                return (
                  <View key={`foto-${foto.id || idxDiHal}`} style={s.fotoKartu} wrap={false}>
                    <View style={s.fotoContainer}>
                      <Image src={foto.src} style={s.gambar} />
                    </View>
                    <View style={s.fotoInfo}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fotoCaption}>
                          Foto {nomorGlobal}{foto.keterangan ? `. ${foto.keterangan}` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>

            {isHalamanTerakhir && (
              <View style={s.ttd} wrap={false}>
                <View style={s.ttdBlok}>
                  <Text>Mengetahui,</Text>
                  <Text>Pejabat Pembuat Komitmen</Text>
                  <View style={s.ruangTtd} />
                  <Text style={{ fontWeight: 700 }}>{pp.ppkNama}</Text>
                  <Text>{nipCetak(pp.ppkNip)}</Text>
                </View>
                <View style={s.ttdBlok}>
                  <Text>{d.tempatTanggal}</Text>
                  <Text>Pelaksana Tugas / Yang Melaporkan,</Text>
                  <View style={s.ruangTtd} />
                  <Text style={{ fontWeight: 700 }}>{d.pelaksana[0]?.nama || pp.pembuatDaftarNama || '-'}</Text>
                  <Text>{nipCetak(d.pelaksana[0]?.nip || pp.pembuatDaftarNip || '')}</Text>
                </View>
              </View>
            )}

            <Text style={s.nomorHal}>
              Halaman {halamanIndex + 1} dari {totalHalaman}
            </Text>
          </Page>
        )
      })}
    </>
  )
}
