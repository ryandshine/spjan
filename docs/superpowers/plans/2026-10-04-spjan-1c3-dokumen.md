# SPJAN Tahap 1C-3: Dokumen PDF (SPTB, Rincian, Kuitansi) - Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat dokumen SPTB, Rincian Biaya Perjalanan Dinas, dan Kuitansi sebagai PDF di peramban dengan format yang mengikuti berkas SPJ kantor, lengkap dengan pratinjau dan unduh per dokumen atau satu berkas.

**Architecture:** Komponen halaman `@react-pdf/renderer` murni (`apps/web/src/pdf/`) yang menerima `DataDokumen` (diturunkan dari respons `GET /api/surat-tugas/:id/hasil`), sehingga angka dan teks dokumen berasal dari `hitungSpj` yang sama dengan editor. Halaman `/st/:id/dokumen` dimuat malas (lazy) karena pustaka PDF besar. Skrip Node `render-sample.tsx` merender data contoh ke PDF untuk pemeriksaan tata letak tanpa peramban.

**Tech Stack:** @react-pdf/renderer ^4.5.1, Liberation Sans (SIL OFL, metrik Arial), React 19, tsx (skrip).

**Spec:** `docs/superpowers/specs/2026-10-04-spjan-design.md` (bagian 3, 7); rencana sebelumnya 1A, 1B, 1C-1, 1C-2 (sudah di `main`).

## Global Constraints

- Semua yang tercantum pada Global Constraints rencana 1C-1 tetap berlaku.
- Kertas A4: SPTB lanskap, Rincian dan Kuitansi potret. Font Liberation Sans (bukan Arial) karena lisensi terbuka; berkas font dan lisensinya berada di `apps/web/public/fonts/`.
- Gaya garis di `@react-pdf/renderer` ditulis sebagai string (`'0.75pt solid #000'`); nilai numerik untuk `border` tidak menggambar garis.
- Berkas di `apps/web/src/pdf/` memakai impor relatif (bukan alias `@/`) agar skrip Node dapat menjalankannya; font didaftarkan lewat `daftarkanFont(basePath)` (URL di peramban, folder di Node).
- Dokumen tetap bisa dibuat saat ada peringatan data; halaman dokumen menampilkan peringatan itu. Tanggal SPJ kosong = tanggal pada tanda tangan dibiarkan kosong untuk ditulis tangan.
- Catatan pagu PMK (informasi di editor) tidak dicetak pada dokumen.
- Jangan commit, push, atau deploy tanpa persetujuan eksplisit pengguna di setiap gerbang. Pesan commit Conventional Commits dengan trailer `Co-Authored-By` dan `Claude-Session`.

## Struktur berkas

```
apps/web/package.json                  + @react-pdf/renderer, tsx, skrip pdf:contoh
apps/web/tsconfig.scripts.json
apps/web/public/fonts/                 LiberationSans-{Regular,Bold,Italic,BoldItalic}.ttf, LICENSE-Liberation.txt
apps/web/scripts/{sample-data.ts,render-sample.tsx}
apps/web/src/pdf/{fonts,data,sptb,rincian,kuitansi,spj-document}.ts(x)
apps/web/src/components/pdf-preview.tsx
apps/web/src/pages/dokumen.tsx
apps/web/src/lib/queries.ts            + useHasilSuratTugas
apps/web/src/App.tsx                   rute /st/:id/dokumen (lazy)
```

## Pemeriksaan visual PDF (dipakai di Task 1-3)

Render contoh lalu ubah ke gambar:
```bash
npm run pdf:contoh -w web -- /tmp/spjan-pdf
pdftoppm -r 70 -png /tmp/spjan-pdf/semua.pdf /tmp/spjan-pdf/p
```
Buka `p-*.png` (mis. dengan alat baca gambar) dan bandingkan dengan format SPJ kantor. Data contoh memuat tiga pelaksana: Gunadi (dua etape), Resa (tiket, taksi, transport darat), dan Direktur Eselon II (Manado, uang representasi).

---

### Task 1: Pondasi PDF, skrip render contoh, dan halaman SPTB

**Files:**
- Modify: `apps/web/package.json` (dependensi dan skrip)
- Create: `apps/web/tsconfig.scripts.json`, `apps/web/scripts/sample-data.ts`, `apps/web/scripts/render-sample.tsx`
- Create: `apps/web/public/fonts/*` (4 berkas .ttf dan `LICENSE-Liberation.txt`)
- Create: `apps/web/src/pdf/fonts.ts`, `apps/web/src/pdf/data.ts`, `apps/web/src/pdf/sptb.tsx`, `apps/web/src/pdf/spj-document.tsx`

**Interfaces:**
- Consumes: `HasilSuratTugasDto`, `PelaksanaHasil`, `PengaturanPayload`, `SuratTugasDto`, `formatAngka`, `SBM_2026`, `hitungSpj`, `toSpjInput` dari `@spjan/shared`.
- Produces: `daftarkanFont(basePath: string): void` dan `PDF_FONT`; `DataDokumen` dan `siapkanDokumen(dto: HasilSuratTugasDto): DataDokumen`, `angka(n)`, `nipCetak(nip)`; `SptbPage({ d })`; `SpjDocument({ d, jenis: 'sptb'|'rincian'|'kuitansi'|'semua', indeks? })` (versi tugas ini hanya mencetak SPTB); skrip `npm run pdf:contoh -w web -- <folder>` yang menulis `<folder>/semua.pdf`; `ST_CONTOH`, `PENGATURAN_CONTOH`, `hasilContoh()`.

- [ ] **Step 1: Pasang dependensi dan salin font**

Run (dari root):
```bash
npm install @react-pdf/renderer@^4.5.1 -w web
npm install -D tsx@^4.21.0 -w web
mkdir -p apps/web/public/fonts
cp /usr/share/fonts/truetype/liberation/LiberationSans-{Regular,Bold,Italic,BoldItalic}.ttf apps/web/public/fonts/
cp /usr/share/doc/fonts-liberation/copyright apps/web/public/fonts/LICENSE-Liberation.txt
```
Expected: `apps/web/package.json` memuat `@react-pdf/renderer` dan `tsx`; folder `public/fonts` berisi empat `.ttf` dan berkas lisensi (SIL OFL 1.1).

- [ ] **Step 2: Tambah skrip dan tsconfig skrip**

Di `apps/web/package.json` tambahkan pada `scripts`: `"pdf:contoh": "tsx --tsconfig tsconfig.scripts.json scripts/render-sample.tsx"`.

`apps/web/tsconfig.scripts.json`:
```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.scripts.tsbuildinfo",
    "types": ["node", "vite/client"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Tulis font, data siap cetak, dan data contoh**

`apps/web/src/pdf/fonts.ts`:
```ts
import { Font } from '@react-pdf/renderer'

export const PDF_FONT = 'LiberationSans'

let terdaftar = false

/**
 * Daftarkan Liberation Sans (metrik sama dengan Arial, lisensi SIL OFL).
 * `basePath` = URL (peramban, mis. `${origin}/fonts`) atau folder (Node) berisi berkas .ttf.
 */
export function daftarkanFont(basePath: string): void {
  if (terdaftar) return
  terdaftar = true
  // Tanpa pemenggalan suku kata otomatis: kata yang tidak muat pindah ke baris berikutnya.
  Font.registerHyphenationCallback((kata) => [kata])
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: `${basePath}/LiberationSans-Regular.ttf` },
      { src: `${basePath}/LiberationSans-Bold.ttf`, fontWeight: 700 },
      { src: `${basePath}/LiberationSans-Italic.ttf`, fontStyle: 'italic' },
      { src: `${basePath}/LiberationSans-BoldItalic.ttf`, fontWeight: 700, fontStyle: 'italic' },
    ],
  })
}
```

`apps/web/src/pdf/data.ts`:
```ts
import { formatAngka, type HasilSuratTugasDto, type PelaksanaHasil, type PengaturanPayload, type SuratTugasDto } from '@spjan/shared'

export interface DataDokumen {
  st: SuratTugasDto
  pengaturan: PengaturanPayload
  pelaksana: PelaksanaHasil[]
  total: number
  terbilang: string
  teksTanggalSt: string
  /** "Jakarta, 21 September 2026" atau "Jakarta,          2026" bila tanggal SPJ belum diisi. */
  tempatTanggal: string
  kodeAkun: string
  pembuatDaftar: { nama: string; nip: string }
}

export const angka = (n: number): string => formatAngka(n)

export const nipCetak = (nip: string): string => (nip ? `NIP.${nip}` : '')

/** Menyusun data siap cetak dari respons GET /api/surat-tugas/:id/hasil. */
export function siapkanDokumen(dto: HasilSuratTugasDto): DataDokumen {
  const { suratTugas: st, pengaturan, hasil } = dto
  const pertama = hasil.pelaksana[0]
  const tanggal = hasil.teksTanggalSpj || `${' '.repeat(14)}${pengaturan.tahunAnggaran}`
  return {
    st,
    pengaturan,
    pelaksana: hasil.pelaksana,
    total: hasil.total,
    terbilang: hasil.terbilang,
    teksTanggalSt: hasil.teksTanggalSt,
    tempatTanggal: `${pengaturan.kotaKedudukan}, ${tanggal}`,
    kodeAkun: st.kodeAkun || pengaturan.kodeAkunDefault,
    pembuatDaftar: {
      nama: pengaturan.pembuatDaftarNama || pertama?.nama || '',
      nip: pengaturan.pembuatDaftarNip || (pertama ? nipCetak(pertama.nip) : ''),
    },
  }
}
```

`apps/web/scripts/sample-data.ts`:
```ts
import {
  SBM_2026,
  hitungSpj,
  toSpjInput,
  type HasilSuratTugasDto,
  type PengaturanPayload,
  type SuratTugasDto,
  type SuratTugasPayload,
} from '@spjan/shared'

const KEG_BALI =
  'Pendampingan Audiensi terkait Rencana Pembongkaran Homestay pada areal kerja Persetujuan Pengelolaan Perhutanan Sosial di Kota Denpasar Provinsi Bali'
const KEG_YOGYA = 'Rapat Koordinasi Teknis Pengelolaan Perhutanan Sosial di KHDPK di Provinsi D.I. Yogyakarta'

export const PENGATURAN_CONTOH: PengaturanPayload = {
  kodeSatker: '693712',
  namaSatker: 'KANTOR PUSAT DIREKTORAT JENDERAL PERHUTANAN SOSIAL',
  dasarDipa: '23 Desember 2025, No. SP DIPA-143.07.1.693712/2026',
  kodeAkunDefault: '7288.QDD.001.052.A.524111',
  tahunAnggaran: 2026,
  ppkNama: 'Priyo Kusumedi, S.Hut., M.P.',
  ppkNip: 'NIP. 19740218 200212 1 003',
  bendaharaNama: 'Aisyah, S.E',
  bendaharaNip: 'NIP.19841126 200901 2 001',
  pjNama: 'Gunadi Firdaus, S.Hut., M.Si.',
  pjNip: 'NIP. 19780310 199703 1 001',
  pjJabatan: 'Kepala Sub Direktorat Pemantauan',
  pembuatDaftarNama: null,
  pembuatDaftarNip: null,
  kotaKedudukan: 'Jakarta',
  provinsiKedudukan: 'D.K.I. JAKARTA',
}

const tiket = (jenis: 'TIKET_PERGI' | 'TIKET_KEMBALI', tarif: number, etapeIndex: number | null = null) => ({
  jenis,
  provinsi: null,
  uraian: null,
  qty: null,
  satuan: null,
  tarif,
  keterangan: null,
  etapeIndex,
})

export const ST_CONTOH: SuratTugasPayload = {
  nomor: 'ST.226/PPS/PEMPS/PSL.04.02/B/09/2026',
  tanggal: '2026-09-08',
  tanggalSpj: '2026-09-21',
  kodeAkun: '7288.QDD.001.052.A.524111',
  catatan: '',
  pelaksana: [
    {
      pegawaiId: null,
      nama: 'Gunadi Firdaus, S.Hut., M.Si.',
      nip: '197803101997031001',
      jabatan: 'Kasubdit Pemantauan Perhutanan Sosial',
      status: 'ESELON_III_GOL_IV',
      noSpd: '401/SPD/PPS/2026',
      etape: [
        { provinsi: 'BALI', kota: 'Denpasar', kegiatan: KEG_BALI, berangkat: '2026-09-10', pulang: '2026-09-11', malamOverride: null, hotelNama: 'Hotel Bali', hotelTarif: 1_500_000, dinasJabatan: false },
        { provinsi: 'D.I. YOGYAKARTA', kota: 'Yogyakarta', kegiatan: KEG_YOGYA, berangkat: '2026-09-12', pulang: '2026-09-13', malamOverride: null, hotelNama: 'Hotel Yogya', hotelTarif: 1_000_000, dinasJabatan: false },
      ],
      biaya: [
        tiket('TIKET_PERGI', 1_500_000, 0),
        { jenis: 'TAKSI_KEDUDUKAN', provinsi: null, uraian: null, qty: null, satuan: null, tarif: 250_000, keterangan: null, etapeIndex: null },
        tiket('TIKET_PERGI', 1_200_000, 1),
        tiket('TIKET_KEMBALI', 1_900_000),
      ],
    },
    {
      pegawaiId: null,
      nama: 'R Resa Adam Gunawan, S.T.',
      nip: '199508222023211008',
      jabatan: 'Surveyor Pemetaan Ahli Pertama',
      status: 'ESELON_IV_GOL_III_II_I',
      noSpd: '403/SPD/PPS/2026',
      etape: [
        { provinsi: 'BALI', kota: 'Denpasar', kegiatan: KEG_BALI, berangkat: '2026-09-10', pulang: '2026-09-11', malamOverride: null, hotelNama: 'Kuto Paradiso Hotel', hotelTarif: 1_021_948, dinasJabatan: false },
      ],
      biaya: [
        tiket('TIKET_PERGI', 2_260_940),
        tiket('TIKET_KEMBALI', 2_223_091),
        { jenis: 'TAKSI_KEDUDUKAN', provinsi: null, uraian: null, qty: 2, satuan: null, tarif: 250_000, keterangan: null, etapeIndex: null },
        { jenis: 'TRANSPORT_DARAT', provinsi: 'BALI', uraian: 'Kab. Gianyar', qty: 2, satuan: null, tarif: 200_000, keterangan: null, etapeIndex: null },
      ],
    },
    {
      pegawaiId: null,
      nama: 'Dr. Marcus Octavianus Susatyo, S.Hut., M.P.',
      nip: '196810191998031001',
      jabatan: 'Direktur Pengendalian Perhutanan Sosial',
      status: 'ESELON_II',
      noSpd: '45/SPD/PPS/2026',
      etape: [
        { provinsi: 'SULAWESI UTARA', kota: 'Manado', kegiatan: 'Pelaksanaan Pemantauan Izin Perhutanan Sosial serta Koordinasi Kunjungan Kerja Menteri Kehutanan ke Kota Manado, Provinsi Sulawesi Utara', berangkat: '2026-04-07', pulang: '2026-04-10', malamOverride: null, hotelNama: 'Manado Quality Hotel', hotelTarif: 650_000, dinasJabatan: true },
      ],
      biaya: [tiket('TIKET_PERGI', 3_689_972), tiket('TIKET_KEMBALI', 4_189_812)],
    },
  ],
}

export function hasilContoh(st: SuratTugasPayload = ST_CONTOH, pengaturan: PengaturanPayload = PENGATURAN_CONTOH): HasilSuratTugasDto {
  const dto: SuratTugasDto = { ...st, id: 1, versiSbmId: 1, createdAt: '2026-10-04T00:00:00.000Z', updatedAt: '2026-10-04T00:00:00.000Z' }
  return { suratTugas: dto, pengaturan, hasil: hitungSpj(toSpjInput(st, pengaturan), SBM_2026) }
}
```

- [ ] **Step 4: Tulis halaman SPTB, kerangka dokumen, dan skrip render**

`apps/web/src/pdf/sptb.tsx`:
```tsx
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
          <Sel w={W.no} style={{ justifyContent: 'center' }}>
            <Text style={s.tengah}>No.</Text>
          </Sel>
          <Sel w={W.akun} style={{ justifyContent: 'center' }}>
            <Text style={s.tengah}>AKUN</Text>
          </Sel>
          <Sel w={W.penerima} style={{ justifyContent: 'center' }}>
            <Text style={s.tengah}>PENERIMA</Text>
          </Sel>
          <Sel style={{ justifyContent: 'center' }}>
            <Text style={s.tengah}>URAIAN</Text>
          </Sel>
          <View style={[{ width: W.tgl + W.nomor }, { borderRight: B }]}>
            <View style={{ borderBottom: B, paddingVertical: 2 }}>
              <Text style={s.tengah}>Bukti</Text>
            </View>
            <View style={s.baris}>
              <Sel w={W.tgl} style={{ borderBottom: B }}>
                <Text style={s.tengah}>Tanggal</Text>
              </Sel>
              <Sel w={W.nomor} style={{ borderRightWidth: 0, borderBottom: B }}>
                <Text style={s.tengah}>Nomor</Text>
              </Sel>
            </View>
          </View>
          <Sel w={W.jumlah} style={{ justifyContent: 'center' }}>
            <Text style={s.tengah}>Jumlah</Text>
          </Sel>
          <View style={{ width: W.ppn + W.pph, borderRight: B }}>
            <View style={{ borderBottom: B, paddingVertical: 1, paddingHorizontal: 2 }}>
              <Text style={s.tengah}>Pajak yang dipungut Bendahara Pengeluaran</Text>
            </View>
            <View style={s.baris}>
              <Sel w={W.ppn} style={{ borderBottom: B }}>
                <Text style={s.tengah}>PPN</Text>
              </Sel>
              <Sel w={W.pph} style={{ borderRightWidth: 0, borderBottom: B }}>
                <Text style={s.tengah}>PPh</Text>
              </Sel>
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
```

`apps/web/src/pdf/spj-document.tsx` (versi tugas ini):
```tsx
import { Document } from '@react-pdf/renderer'

import type { DataDokumen } from './data'
import { SptbPage } from './sptb'

export type JenisDokumen = 'sptb' | 'rincian' | 'kuitansi' | 'semua'

/** Versi tugas 1: hanya SPTB. Rincian dan Kuitansi ditambahkan pada tugas berikutnya. */
export function SpjDocument({ d, jenis }: { d: DataDokumen; jenis: JenisDokumen; indeks?: number }) {
  return (
    <Document title={`SPJ ${d.st.nomor}`} author="SPJAN" language="id">
      {jenis === 'sptb' || jenis === 'semua' ? <SptbPage d={d} /> : null}
    </Document>
  )
}
```

`apps/web/scripts/render-sample.tsx`:
```tsx
// Merender PDF contoh ke folder keluaran untuk pemeriksaan visual tata letak dokumen.
// Pakai: npx tsx scripts/render-sample.tsx [folderKeluaran]
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToFile } from '@react-pdf/renderer'

import { siapkanDokumen } from '../src/pdf/data'
import { daftarkanFont } from '../src/pdf/fonts'
import { SpjDocument } from '../src/pdf/spj-document'
import { hasilContoh } from './sample-data'

const aku = path.dirname(fileURLToPath(import.meta.url))
const keluar = path.resolve(process.argv[2] ?? '/tmp/spjan-pdf')
daftarkanFont(path.resolve(aku, '../public/fonts'))

const d = siapkanDokumen(hasilContoh())
await renderToFile(<SpjDocument d={d} jenis="semua" />, path.join(keluar, 'semua.pdf'))
console.log('ditulis', path.join(keluar, 'semua.pdf'))
```

- [ ] **Step 5: Jalankan tsc, eslint, lalu render dan periksa**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run pdf:contoh -w web -- /tmp/spjan-pdf && pdftoppm -r 70 -png /tmp/spjan-pdf/semua.pdf /tmp/spjan-pdf/p`
Expected: tsc dan eslint tanpa galat; `ditulis /tmp/spjan-pdf/semua.pdf`; `p-1.png` memperlihatkan SPTB lanskap: judul, empat baris keterangan satker, paragraf pernyataan, tabel bergaris dengan tiga baris (Gunadi Rp9.150.000, Resa Rp7.365.979, Direktur Rp11.909.784), baris TOTAL Rp28.425.763, dan kalimat penutup (blok tanda tangan boleh pindah ke halaman 2).

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add package-lock.json apps/web/package.json apps/web/tsconfig.scripts.json apps/web/scripts apps/web/public/fonts apps/web/src/pdf
git commit -m "feat(web): pondasi PDF, skrip render contoh, dan halaman SPTB

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 2: Halaman Rincian Biaya Perjalanan Dinas

**Files:**
- Create: `apps/web/src/pdf/rincian.tsx`
- Modify: `apps/web/src/pdf/spj-document.tsx`

**Interfaces:**
- Consumes: `DataDokumen`, `angka`, `nipCetak`, `PDF_FONT` (Task 1); tipe `BarisBiaya`, `PelaksanaHasil`.
- Produces: `RincianPage({ d, p })` (satu pelaksana; bingkai penuh, judul, nomor SPD dan tanggal, tabel No/Rincian/Jumlah/Keterangan dengan bagian 1 transport, 2 uang harian dan representasi, 3 penginapan beserta JUMLAH, baris Jumlah dan Terbilang, blok pembayaran dan penerima, perhitungan SPD rampung, dan blok PPK); `SpjDocument` mencetak SPTB dan Rincian setiap pelaksana (atau satu pelaksana bila `indeks` diberikan).

- [ ] **Step 1: Tulis halaman**

`apps/web/src/pdf/rincian.tsx`:
```tsx
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
          <Uraian b={b} tanda={tanda && b.uraian !== 'selama :' && b.uraian !== 'Representasi selama :'} />
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
          <Text>{d.teksTanggalSt}</Text>
        </View>

        <Baris no="No." jumlah="Jumlah  Rp." ket="Keterangan" atas bawah>
          <Text style={{ textAlign: 'center' }}>Rincian biaya</Text>
        </Baris>
        <Baris tinggi={5} />
        <Bagian no="1" judul="Biaya transport pegawai :" baris={p.transport} jumlah={p.totalTransport} tanda />
        <Bagian no="2" judul="Uang harian :" baris={uangHarian} jumlah={p.totalUangHarian + p.totalRepresentasi} tanda={false} />
        <Bagian no="3" judul="Biaya Penginapan :" baris={p.penginapan} jumlah={p.totalPenginapan} tanda />

        <View style={[s.baris, { borderTop: B, borderBottom: B, paddingHorizontal: 22, paddingVertical: 2, justifyContent: 'space-between' }]} wrap={false}>
          <Text>Jumlah    :</Text>
          <Text style={{ fontWeight: 700 }}>{angka(p.total)}</Text>
        </View>
        <View style={{ borderBottom: B, paddingHorizontal: 22, paddingVertical: 2 }} wrap={false}>
          <Text>
            Terbilang :{'  '}
            {p.terbilang}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 22, paddingTop: 10 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>Telah dibayar jumlah:</Text>
            <Text>Rp.   {angka(p.total)}</Text>
            <Text>Bendahara Pengeluaran Pembantu</Text>
            <View style={{ height: 44 }} />
            <Text>{pp.bendaharaNama}</Text>
            <Text>{pp.bendaharaNip}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 24 }}>
            <Text>{d.tempatTanggal}</Text>
            <Text>Telah menerima uang sebesar :</Text>
            <Text style={{ fontWeight: 700 }}>Rp {angka(p.total)}</Text>
            <Text>Yang Menerima</Text>
            <View style={{ height: 31 }} />
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
```

- [ ] **Step 2: Perbarui kerangka dokumen**

`apps/web/src/pdf/spj-document.tsx` (versi tugas ini):
```tsx
import { Document } from '@react-pdf/renderer'

import type { DataDokumen } from './data'
import { RincianPage } from './rincian'
import { SptbPage } from './sptb'

export type JenisDokumen = 'sptb' | 'rincian' | 'kuitansi' | 'semua'

/** Versi tugas 2: SPTB dan Rincian. Kuitansi ditambahkan pada tugas berikutnya. */
export function SpjDocument({ d, jenis, indeks }: { d: DataDokumen; jenis: JenisDokumen; indeks?: number }) {
  const terpilih = d.pelaksana.map((p, i) => ({ p, i })).filter(({ i }) => indeks === undefined || i === indeks)
  return (
    <Document title={`SPJ ${d.st.nomor}`} author="SPJAN" language="id">
      {jenis === 'sptb' || jenis === 'semua' ? <SptbPage d={d} /> : null}
      {jenis === 'rincian' || jenis === 'semua' ? terpilih.map(({ p, i }) => <RincianPage key={i} d={d} p={p} />) : null}
    </Document>
  )
}
```

- [ ] **Step 3: Jalankan tsc, eslint, lalu render dan periksa**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run pdf:contoh -w web -- /tmp/spjan-pdf && pdftoppm -r 70 -png /tmp/spjan-pdf/semua.pdf /tmp/spjan-pdf/p`
Expected: tanpa galat. Halaman Rincian Gunadi menampilkan empat baris transport (tiga tiket berurutan Jakarta-Denpasar, Denpasar-Yogyakarta, Yogyakarta-Jakarta dan taksi), dua baris uang harian dan dua baris hotel, Jumlah Rp9.150.000; Rincian Direktur menampilkan baris "Representasi selama : 4 hari @ Rp. 150.000 = 600.000" dan Jumlah Rp11.909.784. Garis tabel menyambung dari header sampai baris Jumlah.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/pdf/rincian.tsx apps/web/src/pdf/spj-document.tsx
git commit -m "feat(web): halaman Rincian Biaya Perjalanan Dinas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 3: Halaman Kuitansi dan dokumen lengkap

**Files:**
- Create: `apps/web/src/pdf/kuitansi.tsx`
- Modify: `apps/web/src/pdf/spj-document.tsx`

**Interfaces:**
- Consumes: `DataDokumen`, `angka`, `nipCetak`, `PDF_FONT` (Task 1); `RincianPage` (Task 2).
- Produces: `KuitansiPage({ d, p })` (kop kementerian, kotak tahun anggaran/nomor bukti/mata anggaran, judul, SUDAH TERIMA DARI, JUMLAH UANG, TERBILANG miring, UNTUK PEMBAYARAN = uraian SPTB pelaksana, tanda tangan penerima, blok PPK dan bendahara, blok pejabat yang bertanggung jawab); `SpjDocument` versi akhir: `'sptb'`, `'rincian'`, `'kuitansi'`, atau `'semua'` (SPTB lalu Rincian dan Kuitansi tiap pelaksana), dengan `indeks` opsional.

- [ ] **Step 1: Tulis halaman**

`apps/web/src/pdf/kuitansi.tsx`:
```tsx
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
            <Text style={{ fontWeight: 700 }}>{pp.ppkNip}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 24 }}>
            <Text>Lunas dibayar,</Text>
            <Text>Bendahara Pengeluaran Pembantu</Text>
            <View style={{ height: 66 }} />
            <Text style={{ fontWeight: 700 }}>{pp.bendaharaNama}</Text>
            <Text style={{ fontWeight: 700 }}>{pp.bendaharaNip}</Text>
          </View>
        </View>

        <View style={{ borderTop: B, padding: 6 }} wrap={false}>
          <Text>Barang / pekerjaan tersebut telah diterima / diselesaikan dengan lengkap dan baik</Text>
          <Text>Pejabat yang bertanggungjawab,</Text>
          <Text>{pp.pjJabatan}</Text>
          <View style={{ height: 46 }} />
          <Text style={{ fontWeight: 700 }}>{pp.pjNama}</Text>
          <Text style={{ fontWeight: 700 }}>{pp.pjNip}</Text>
        </View>
      </View>
    </Page>
  )
}
```

- [ ] **Step 2: Perbarui kerangka dokumen (versi akhir)**

`apps/web/src/pdf/spj-document.tsx`:
```tsx
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
```

- [ ] **Step 3: Jalankan tsc, eslint, lalu render dan periksa**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run pdf:contoh -w web -- /tmp/spjan-pdf && pdfinfo /tmp/spjan-pdf/semua.pdf | grep Pages && pdftoppm -r 70 -png /tmp/spjan-pdf/semua.pdf /tmp/spjan-pdf/p`
Expected: tanpa galat; `Pages: 8` (SPTB dua halaman karena tanda tangan pindah, lalu Rincian dan Kuitansi untuk tiga pelaksana). Kuitansi Gunadi menampilkan "Rp. 9.150.000", terbilang "Sembilan Juta Seratus Lima Puluh Ribu Rupiah" dalam huruf miring, uraian dua kegiatan, dan "Jakarta, 21 September 2026".

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/pdf/kuitansi.tsx apps/web/src/pdf/spj-document.tsx
git commit -m "feat(web): halaman Kuitansi dan dokumen lengkap

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 4: Halaman Dokumen (pratinjau dan unduh)

**Files:**
- Create: `apps/web/src/components/pdf-preview.tsx`, `apps/web/src/pages/dokumen.tsx`
- Modify: `apps/web/src/lib/queries.ts`, `apps/web/src/App.tsx`, `CLAUDE.md`

**Interfaces:**
- Consumes: `api.suratTugas.hasil`, `siapkanDokumen`, `daftarkanFont`, `SpjDocument`, `PageHeader`, `Alert`, `Badge`.
- Produces: hook `useHasilSuratTugas(id)`; `PdfPreview({ dokumen, onSiap?(blob) })` (membuat PDF di peramban dan menampilkannya di iframe `title="Pratinjau dokumen"`); rute `/st/:id/dokumen` (lazy) dengan daftar pilihan (SPTB, Rincian dan Kuitansi per pelaksana, Semua dokumen), tombol "Unduh PDF" (nama berkas `SPJ-<nomor>-<pilihan>.pdf`), peringatan data, dan tautan kembali ke editor.

- [ ] **Step 1: Tambah hook**

Tambahkan di akhir `apps/web/src/lib/queries.ts`:
```ts
export function useHasilSuratTugas(id: number | undefined) {
  return useQuery({
    queryKey: keys.hasil(id ?? 0),
    queryFn: () => api.suratTugas.hasil(id as number),
    enabled: id !== undefined,
    staleTime: 0,
  })
}
```

- [ ] **Step 2: Tulis komponen dan halaman**

`apps/web/src/components/pdf-preview.tsx`:
```tsx
import { useEffect, useState, type ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

/** Membuat PDF dari `dokumen` di peramban dan menampilkannya di iframe. */
export function PdfPreview({ dokumen, onSiap }: { dokumen: ReactElement<DocumentProps>; onSiap?: (blob: Blob) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    let objek: string | null = null
    ;(async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer')
        const blob = await pdf(dokumen).toBlob()
        if (batal) return
        objek = URL.createObjectURL(blob)
        setUrl(objek)
        setGalat(null)
        onSiap?.(blob)
      } catch (error) {
        if (!batal) setGalat(error instanceof Error ? error.message : 'Gagal membuat PDF')
      }
    })()
    return () => {
      batal = true
      if (objek) URL.revokeObjectURL(objek)
    }
  }, [dokumen, onSiap])

  if (galat) return <p className="p-6 text-sm text-destructive">Gagal membuat pratinjau: {galat}</p>
  if (!url) return <p className="p-6 text-sm text-muted-foreground">Menyiapkan pratinjau...</p>
  return <iframe title="Pratinjau dokumen" src={url} className="h-full w-full rounded-lg border bg-card" />
}
```

`apps/web/src/pages/dokumen.tsx`:
```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, DownloadIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { PdfPreview } from '@/components/pdf-preview'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { pesanGalat } from '@/lib/format'
import { useHasilSuratTugas } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { siapkanDokumen } from '@/pdf/data'
import { daftarkanFont } from '@/pdf/fonts'
import { SpjDocument, type JenisDokumen } from '@/pdf/spj-document'

daftarkanFont(`${window.location.origin}/fonts`)

interface Pilihan {
  kunci: string
  label: string
  jenis: JenisDokumen
  indeks?: number
}

export default function DokumenPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const hasil = useHasilSuratTugas(Number.isInteger(id) && id > 0 ? id : undefined)
  const d = useMemo(() => (hasil.data ? siapkanDokumen(hasil.data) : null), [hasil.data])
  const [kunci, setKunci] = useState('sptb')
  const blobTerakhir = useRef<Blob | null>(null)

  const pilihan: Pilihan[] = useMemo(() => {
    const daftar: Pilihan[] = [{ kunci: 'sptb', label: 'SPTB', jenis: 'sptb' }]
    d?.pelaksana.forEach((p, i) => {
      daftar.push({ kunci: `rincian:${i}`, label: `Rincian - ${p.nama || `Pelaksana ${i + 1}`}`, jenis: 'rincian', indeks: i })
      daftar.push({ kunci: `kuitansi:${i}`, label: `Kuitansi - ${p.nama || `Pelaksana ${i + 1}`}`, jenis: 'kuitansi', indeks: i })
    })
    daftar.push({ kunci: 'semua', label: 'Semua dokumen (satu berkas)', jenis: 'semua' })
    return daftar
  }, [d])
  const terpilih = pilihan.find((p) => p.kunci === kunci) ?? pilihan[0]

  const dokumen = useMemo(
    () => (d && terpilih ? <SpjDocument d={d} jenis={terpilih.jenis} indeks={terpilih.indeks} /> : null),
    [d, terpilih],
  )
  const simpanBlob = useCallback((b: Blob) => {
    blobTerakhir.current = b
  }, [])

  function unduh() {
    const blob = blobTerakhir.current
    if (!blob || !d || !terpilih) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SPJ-${d.st.nomor.replace(/[^A-Za-z0-9]+/g, '-')}-${terpilih.kunci.replace(':', '-')}.pdf`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  if (hasil.isError) return <Alert variant="destructive">{pesanGalat(hasil.error)}</Alert>
  if (!d) return <p className="text-sm text-muted-foreground">Memuat...</p>

  const bermasalah = d.pelaksana.filter((p) => p.peringatan.length > 0)
  return (
    <div>
      <PageHeader
        title="Dokumen"
        description={d.st.nomor}
        actions={
          <>
            <Link to={`/st/${id}`} className={buttonVariants({ variant: 'outline' })}>
              <ArrowLeftIcon className="size-4" /> Kembali ke editor
            </Link>
            <Button onClick={unduh}>
              <DownloadIcon /> Unduh PDF
            </Button>
          </>
        }
      />
      {bermasalah.length > 0 ? (
        <Alert variant="warning" className="mb-4">
          <p className="mb-1 font-medium">Data belum lengkap. Dokumen tetap bisa dibuat, tetapi periksa dulu sebelum dicetak:</p>
          <ul className="list-inside list-disc">
            {bermasalah.map((p, i) => (
              <li key={i}>
                {p.nama}: {p.peringatan.map((w) => w.pesan).join(' ')}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {!d.st.tanggalSpj ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Tanggal SPJ belum diisi, sehingga tanggal di tanda tangan dibiarkan kosong untuk ditulis tangan. Isi di{' '}
          <Link to={`/st/${id}`} className="text-primary hover:underline">
            editor surat tugas
          </Link>
          .
        </p>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="grid gap-1">
          {pilihan.map((p) => (
            <button
              key={p.kunci}
              type="button"
              onClick={() => setKunci(p.kunci)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                terpilih?.kunci === p.kunci ? 'border-primary bg-accent font-medium' : 'bg-card',
              )}
            >
              <span className="truncate">{p.label}</span>
              {p.jenis !== 'sptb' && p.jenis !== 'semua' && p.indeks !== undefined && (d.pelaksana[p.indeks]?.peringatan.length ?? 0) > 0 ? (
                <Badge variant="warning">!</Badge>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="h-[80vh] min-h-[500px]">{dokumen ? <PdfPreview dokumen={dokumen} onSiap={simpanBlob} /> : null}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Daftarkan rute (lazy)**

`apps/web/src/App.tsx`:
```tsx
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import PengaturanPage from '@/pages/pengaturan'
import SbmPage from '@/pages/sbm'
import StEditorPage from '@/pages/st-editor'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage } from '@/pages/placeholder'

// Dokumen memuat @react-pdf/renderer (besar), jadi dimuat saat dibutuhkan.
const DokumenPage = lazy(() => import('@/pages/dokumen'))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<StEditorPage />} />
          <Route path="st/:id" element={<StEditorPage />} />
          <Route
            path="st/:id/dokumen"
            element={
              <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat...</p>}>
                <DokumenPage />
              </Suspense>
            }
          />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="sbm" element={<SbmPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 4: Perbarui CLAUDE.md**

Tambahkan di bagian perintah `apps/web` pada `CLAUDE.md` (setelah paragraf `apps/web`):
```markdown
Dokumen PDF (SPTB, Rincian, Kuitansi) dibuat di peramban dengan `@react-pdf/renderer` (`apps/web/src/pdf/`). Font: Liberation Sans (metrik sama dengan Arial, lisensi SIL OFL) di `apps/web/public/fonts/` beserta berkas lisensinya.
Untuk memeriksa tata letak tanpa peramban: `npm run pdf:contoh -w web -- /tmp/spjan-pdf` (data contoh di `apps/web/scripts/sample-data.ts`), lalu `pdftoppm -r 70 -png /tmp/spjan-pdf/semua.pdf /tmp/spjan-pdf/p` untuk melihat halamannya. File `pdf/*.tsx` memakai impor relatif (bukan alias `@/`) agar skrip Node bisa menjalankannya.
```

- [ ] **Step 5: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat; `dist/assets/dokumen-*.js` (sekitar 1,2 MB) terpisah dari `index-*.js` (sekitar 550 kB).

- [ ] **Step 6: Verifikasi di peramban**

Ikuti "Pemeriksaan peramban" (rencana 1C-1) dengan database kosong, buat surat tugas contoh lewat API (`PUT /api/pengaturan` dengan `PENGATURAN_CONTOH` dan `POST /api/surat-tugas` dengan `ST_CONTOH` dari `apps/web/scripts/sample-data.ts`), lalu jalankan skrip ini dari folder sementara (`mkdir -p /tmp/spjan-pdf`):
```js
// dok.mjs - jalankan dari folder sementara dengan playwright-core terpasang (server api + web hidup, ST contoh sudah dibuat)
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto('http://localhost:5173/login')
await page.fill('#username', 'admin'); await page.fill('#password', 'sandi-dev-12345'); await page.click('button[type=submit]')
await page.waitForURL('http://localhost:5173/')
await page.goto('http://localhost:5173/st/1/dokumen')
await page.waitForSelector('iframe[title="Pratinjau dokumen"]', { timeout: 30000 })
let n = 0
for (const label of ['SPTB', 'Rincian - R Resa Adam Gunawan, S.T.', 'Kuitansi - Dr. Marcus', 'Semua dokumen']) {
  await page.click(`nav button:has-text("${label}")`); await page.waitForTimeout(1500)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Unduh PDF")')])
  await dl.saveAs(`/tmp/spjan-pdf/web-${++n}.pdf`)
  console.log(label, '->', dl.suggestedFilename())
}
console.log('errors:', JSON.stringify(errors))
await browser.close()
```
Expected: empat baris `... -> SPJ-ST-226-PPS-PEMPS-PSL-04-02-B-09-2026-<pilihan>.pdf` dan `errors: []`. `pdfinfo` pada berkas unduhan: SPTB 2 halaman, Rincian 1, Kuitansi 1, Semua dokumen 8. Isi Rincian Direktur harus memuat "Representasi selama" dan Jumlah 11.909.784.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/components/pdf-preview.tsx apps/web/src/pages/dokumen.tsx apps/web/src/lib/queries.ts apps/web/src/App.tsx CLAUDE.md docs
git commit -m "feat(web): halaman Dokumen dengan pratinjau dan unduh PDF

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

## Self-Review

1. **Cakupan spec:** bagian 7 (SPTB lanskap satu baris per orang, Rincian potret per pelaksana, Kuitansi per pelaksana, pratinjau dan unduh, tata letak mengikuti berkas SPJ) = Task 1-4; bagian 3 (`@react-pdf/renderer` di peramban, font setara Arial yang bebas lisensi) = Task 1. Teks dokumen berasal dari `hitungSpj` (uraian SPTB, terbilang, total) tanpa menghitung ulang. Tata letak halaman panjang (banyak baris) memakai pemecahan halaman bawaan dengan `wrap={false}` per baris.
2. **Placeholder:** tidak ada; semua langkah memuat isi berkas lengkap dan keluaran yang diharapkan.
3. **Konsistensi tipe:** `DataDokumen`, `siapkanDokumen`, `SpjDocument` (`jenis`, `indeks`), `RincianPage`/`KuitansiPage` (`d`, `p`), dan `PdfPreview` (`dokumen`, `onSiap`) sama di blok Interfaces dan berkas; `SpjDocument` ditampilkan utuh pada setiap tugas yang mengubahnya.
