import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  INSTANSI_BAWAAN,
  angkaKata,
  parseTanggal,
  proper,
  selisihHari,
  tanggalIndonesia,
  type EtapePayload,
  type PelaksanaHasil,
  type PelaksanaPayload,
} from '@spjan/shared'

import { nipCetak, type DataDokumen } from './data'
import { PDF_FONT } from './fonts'
import { LOGO_KEMENHUT_BASE64 } from './logo'

const B = '0.75pt solid #000'

const s = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 30,
    fontFamily: PDF_FONT,
    fontSize: 8.5,
    lineHeight: 1.25,
  },

  // Kop Surat
  kopWrapper: {
    position: 'relative',
    minHeight: 52,
    justifyContent: 'center',
    marginBottom: 2,
  },
  logoBox: {
    position: 'absolute',
    left: 2,
    top: 0,
    width: 48,
    height: 48,
  },
  logo: {
    width: 48,
    height: 48,
  },
  kopTeksBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kop1: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  kop2: {
    fontSize: 9.5,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 1,
  },
  kop3: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 1,
  },
  kop4: {
    fontSize: 8.5,
    textAlign: 'center',
    marginTop: 1,
    letterSpacing: 2.5,
  },
  garisKopTebal: {
    borderTop: '1.5pt solid #000',
    marginTop: 3,
  },
  garisKopTipis: {
    borderTop: '0.5pt solid #000',
    marginTop: 1.5,
    marginBottom: 5,
  },

  // Meta Kanan (Nomor SPD)
  headerKanan: {
    alignSelf: 'flex-end',
    width: 190,
    marginBottom: 4,
  },
  metaBaris: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  metaLabel: {
    width: 52,
  },
  metaTitik: {
    width: 8,
  },
  metaNilai: {
    flex: 1,
  },

  // Judul
  judul: {
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 10,
    marginBottom: 5,
    textDecoration: 'underline',
  },

  // Tabel Utama
  tabel: {
    borderTop: B,
    borderLeft: B,
    borderRight: B,
  },
  baris: {
    flexDirection: 'row',
    borderBottom: B,
  },
  barisTanpaBawah: {
    flexDirection: 'row',
  },
  kolNo: {
    width: 22,
    borderRight: B,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  kolLabel: {
    width: 170,
    borderRight: B,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  kolIsi: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },

  // Sub-kolom pengikut
  pengikutHeader: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #000',
    paddingVertical: 1,
  },
  pengikutRow: {
    flexDirection: 'row',
    paddingVertical: 1.2,
  },
  pNo: {
    width: 16,
    textAlign: 'center',
  },
  pNama: {
    flex: 1,
    borderRight: '0.5pt solid #000',
    paddingHorizontal: 4,
  },
  pTgl: {
    width: 85,
    borderRight: '0.5pt solid #000',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  pKet: {
    width: 70,
    textAlign: 'center',
    paddingHorizontal: 2,
  },

  // Footer / Tanda Tangan
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingHorizontal: 2,
  },
  footerKiri: {
    width: 150,
    fontSize: 7.5,
    fontStyle: 'italic',
  },
  footerKanan: {
    width: 210,
  },
  ttdRuang: {
    height: 38,
  },
  tebal: {
    fontWeight: 700,
  },
})

function getTingkatBiaya(status: string | null | undefined): string {
  if (status === 'PEJABAT_NEGARA_WAMEN') return 'A'
  if (status === 'ESELON_I' || status === 'ESELON_II') return 'B'
  return 'C'
}

function getPangkatGolongan(status: string | null | undefined): string {
  if (status === 'ESELON_II') return 'Pembina Utama Muda - IV/c'
  if (status === 'ESELON_III_GOL_IV') return 'Pembina - (IV/a)'
  return '-'
}

function getAlatAngkutan(payload?: PelaksanaPayload): string {
  const biaya = payload?.biaya ?? []
  const adaPesawat = biaya.some(
    (b) =>
      b.jenis === 'TIKET_PERGI' ||
      b.jenis === 'TIKET_KEMBALI' ||
      b.jenis === 'TAKSI_TERMINAL' ||
      /pesawat|udara/i.test(b.uraian || ''),
  )
  if (adaPesawat) return 'Transportasi Udara dan Darat'
  return 'Transportasi Darat'
}

function getTempatTujuan(etape: EtapePayload[] = []): string {
  const tujuan = etape
    .map((e) => e.kota?.trim() || proper(e.provinsi?.trim() || ''))
    .filter(Boolean)
  const unik = [...new Set(tujuan)]
  if (unik.length === 0) return '-'
  if (unik.length === 1) return unik[0]!
  if (unik.length === 2) return `${unik[0]} dan ${unik[1]}`
  return `${unik.slice(0, -1).join(', ')} dan ${unik[unik.length - 1]}`
}

function getLamaPerjalanan(etape: EtapePayload[] = []): { lama: string; berangkat: string; kembali: string } {
  if (etape.length === 0) return { lama: '-', berangkat: '-', kembali: '-' }
  const first = etape[0]!
  const last = etape[etape.length - 1]!
  const tglA = parseTanggal(first.berangkat)
  const tglB = parseTanggal(last.pulang || last.berangkat)

  let durasi = 0
  if (tglA && tglB) {
    durasi = selisihHari(tglA, tglB) + 1
  } else {
    durasi = etape.length
  }

  const lama = durasi > 0 ? `${durasi} (${angkaKata(durasi)}) hari` : '-'
  const berangkat = tanggalIndonesia(first.berangkat) || '-'
  const kembali = tanggalIndonesia(last.pulang || last.berangkat) || '-'
  return { lama, berangkat, kembali }
}

export function SpdPage({
  d,
  p,
  payload,
}: {
  d: DataDokumen
  p: PelaksanaHasil
  payload?: PelaksanaPayload
}) {
  const pp = d.pengaturan
  const etape = payload?.etape ?? []
  const { lama, berangkat, kembali } = getLamaPerjalanan(etape)
  const maksud = etape.find((e) => e.kegiatan?.trim())?.kegiatan?.trim() || d.st.catatan || d.st.nomor || '-'
  const alatAngkut = getAlatAngkutan(payload)
  const tujuan = getTempatTujuan(etape)
  const tingkatBiaya = getTingkatBiaya(p.status)
  const pangkat = getPangkatGolongan(p.status)

  return (
    <Page size="A4" style={s.page}>
      {/* 1. KOP SURAT RESMI */}
      <View style={s.kopWrapper}>
        <View style={s.logoBox}>
          <Image src={LOGO_KEMENHUT_BASE64} style={s.logo} />
        </View>
        <View style={s.kopTeksBox}>
          <Text style={s.kop1}>KEMENTERIAN KEHUTANAN</Text>
          <Text style={s.kop2}>DIREKTORAT JENDERAL PERHUTANAN SOSIAL</Text>
          <Text style={s.kop3}>DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL</Text>
          <Text style={s.kop4}>J A K A R T A</Text>
        </View>
      </View>
      <View style={s.garisKopTebal} />
      <View style={s.garisKopTipis} />

      {/* 2. META KANAN ATAS (Nomor SPD) */}
      <View style={s.headerKanan}>
        <View style={s.metaBaris}>
          <Text style={s.metaLabel}>Lembar Ke</Text>
          <Text style={s.metaTitik}>:</Text>
          <Text style={s.metaNilai} />
        </View>
        <View style={s.metaBaris}>
          <Text style={s.metaLabel}>Kode No</Text>
          <Text style={s.metaTitik}>:</Text>
          <Text style={s.metaNilai} />
        </View>
        <View style={s.metaBaris}>
          <Text style={s.metaLabel}>Nomor</Text>
          <Text style={s.metaTitik}>:</Text>
          <Text style={s.metaNilai}>{p.noSpd ? ` ${p.noSpd}` : ''}</Text>
        </View>
      </View>

      {/* 3. JUDUL SPD */}
      <Text style={s.judul}>SURAT PERJALANAN DINAS (SPD)</Text>

      {/* 4. TABEL 10 BUTIR (Format Resmi Lampiran I PMK 113/PMK.05/2012) */}
      <View style={s.tabel}>
        {/* Butir 1 */}
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo}>1</Text>
          <Text style={s.kolLabel}>Pejabat Pembuat Komitmen</Text>
          <Text style={s.kolIsi}>{INSTANSI_BAWAAN.toUpperCase()}</Text>
        </View>

        {/* Butir 2 */}
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo}>2</Text>
          <Text style={s.kolLabel}>Nama / NIP Pegawai yang melaksanakan Perjalanan Dinas</Text>
          <Text style={s.kolIsi}>{`${p.nama}  /  ${nipCetak(p.nip)}`}</Text>
        </View>

        {/* Butir 3 (Tiga baris horizontal tersinkronisasi) */}
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo}>3</Text>
          <Text style={s.kolLabel}>a.  Pangkat dan Golongan</Text>
          <Text style={s.kolIsi}>{pangkat}</Text>
        </View>
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>b.  Jabatan/Instansi</Text>
          <Text style={s.kolIsi}>{`${p.jabatan || 'Staf'}/${payload?.instansi || INSTANSI_BAWAAN}`}</Text>
        </View>
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>c.  Tingkat Biaya Perjalanan Dinas</Text>
          <Text style={s.kolIsi}>{tingkatBiaya}</Text>
        </View>

        {/* Butir 4 */}
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo}>4</Text>
          <Text style={s.kolLabel}>Maksud Perjalanan Dinas</Text>
          <Text style={[s.kolIsi, { fontSize: 8 }]}>{maksud}</Text>
        </View>

        {/* Butir 5 */}
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo}>5</Text>
          <Text style={s.kolLabel}>Alat angkutan yang dipergunakan</Text>
          <Text style={s.kolIsi}>{alatAngkut}</Text>
        </View>

        {/* Butir 6 (Dua baris horizontal tersinkronisasi) */}
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo}>6</Text>
          <Text style={s.kolLabel}>a.  Tempat Berangkat</Text>
          <Text style={s.kolIsi}>{pp.kotaKedudukan || 'Jakarta'}</Text>
        </View>
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>b.  Tempat Tujuan</Text>
          <Text style={s.kolIsi}>{tujuan}</Text>
        </View>

        {/* Butir 7 (Tiga baris horizontal tersinkronisasi) */}
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo}>7</Text>
          <Text style={s.kolLabel}>a.  Lamanya Perjalanan Dinas</Text>
          <Text style={s.kolIsi}>{lama}</Text>
        </View>
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>b.  Tanggal berangkat</Text>
          <Text style={s.kolIsi}>{berangkat}</Text>
        </View>
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>c.  Tanggal harus kembali/tiba di tempat baru *)</Text>
          <Text style={s.kolIsi}>{kembali}</Text>
        </View>

        {/* Butir 8 (Pengikut) */}
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo}>8</Text>
          <Text style={s.kolLabel}>Pengikut :</Text>
          <View style={[s.kolIsi, { paddingHorizontal: 0, paddingVertical: 0 }]}>
            <View style={s.pengikutHeader}>
              <Text style={s.pNo} />
              <Text style={[s.pNama, { textAlign: 'center', fontWeight: 700 }]}>N a m a</Text>
              <Text style={[s.pTgl, { fontWeight: 700 }]}>Tanggal Lahir</Text>
              <Text style={[s.pKet, { fontWeight: 700 }]}>Keterangan</Text>
            </View>
            <View style={s.pengikutRow}>
              <Text style={s.pNo}>1.</Text>
              <Text style={s.pNama}>-</Text>
              <Text style={s.pTgl}>-</Text>
              <Text style={s.pKet}>-</Text>
            </View>
            <View style={s.pengikutRow}>
              <Text style={s.pNo}>2.</Text>
              <Text style={s.pNama}>-</Text>
              <Text style={s.pTgl}>-</Text>
              <Text style={s.pKet}>-</Text>
            </View>
            <View style={s.pengikutRow}>
              <Text style={s.pNo}>3.</Text>
              <Text style={s.pNama}>-</Text>
              <Text style={s.pTgl}>-</Text>
              <Text style={s.pKet}>-</Text>
            </View>
          </View>
        </View>

        {/* Butir 9 (Dua baris horizontal tersinkronisasi) */}
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo}>9</Text>
          <Text style={[s.kolLabel, { fontWeight: 700 }]}>Pembebanan anggaran :</Text>
          <Text style={s.kolIsi} />
        </View>
        <View style={s.barisTanpaBawah} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>a.  Instansi</Text>
          <Text style={s.kolIsi}>{INSTANSI_BAWAAN.toUpperCase()}</Text>
        </View>
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo} />
          <Text style={s.kolLabel}>b.  Akun</Text>
          <Text style={s.kolIsi}>{d.kodeAkun || d.st.kodeAkun}</Text>
        </View>

        {/* Butir 10 */}
        <View style={s.baris} wrap={false}>
          <Text style={s.kolNo}>10</Text>
          <Text style={s.kolLabel}>Keterangan lain - lain</Text>
          <Text style={s.kolIsi}>
            {`Surat Tugas Nomor: ${d.st.nomor}  tanggal ${d.teksTanggalSt}`}
          </Text>
        </View>
      </View>

      {/* 5. FOOTER TANDA TANGAN PPK */}
      <View style={s.footer} wrap={false}>
        <View style={s.footerKiri}>
          <Text>*) coret yang tidak perlu.</Text>
        </View>
        <View style={s.footerKanan}>
          <View style={s.metaBaris}>
            <Text style={{ width: 75 }}>Dikeluarkan di</Text>
            <Text style={{ width: 8 }}>:</Text>
            <Text style={{ flex: 1 }}>{pp.kotaKedudukan || 'Jakarta'}</Text>
          </View>
          <View style={[s.metaBaris, { marginBottom: 4 }]}>
            <Text style={{ width: 75 }}>Pada tanggal</Text>
            <Text style={{ width: 8 }}>:</Text>
            <Text style={{ flex: 1 }}>{p.teksTanggalSpd || d.teksTanggalDokumen || d.teksTanggalSt}</Text>
          </View>

          <Text style={[s.tebal, { marginTop: 2 }]}>Pejabat Pembuat Komitmen,</Text>
          <View style={s.ttdRuang} />
          <Text style={s.tebal}>{pp.ppkNama}</Text>
          <Text style={s.tebal}>{nipCetak(pp.ppkNip)}</Text>
        </View>
      </View>
    </Page>
  )
}
