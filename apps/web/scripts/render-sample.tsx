// Merender PDF contoh ke folder keluaran untuk pemeriksaan visual tata letak dokumen.
// Pakai: npx tsx scripts/render-sample.tsx [folderKeluaran]
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToFile } from '@react-pdf/renderer'

import { susunLaporan, type FotoDokumentasi } from '@spjan/shared'

import { siapkanDokumen } from '../src/pdf/data'
import { daftarkanFont } from '../src/pdf/fonts'
import { SpjDocument } from '../src/pdf/spj-document'
import { LOGO_KEMENHUT_BASE64 } from '../src/pdf/logo'
import { hasilContoh, laporanContoh } from './sample-data'

const aku = path.dirname(fileURLToPath(import.meta.url))
const keluar = path.resolve(process.argv[2] ?? '/tmp/spjan-pdf')
daftarkanFont(path.resolve(aku, '../public/fonts'))

const d = siapkanDokumen(hasilContoh())
await renderToFile(<SpjDocument d={d} jenis="semua" />, path.join(keluar, 'semua.pdf'))
console.log('ditulis', path.join(keluar, 'semua.pdf'))

const fotoContoh: FotoDokumentasi[] = [
  '17 September 2026, Koordinasi di Kantor Balai PS Palembang',
  '18 September 2026, Pelaksanaan Pengawasan di LPHD Muara Merang',
  '18 September 2026, Diskusi dengan pengurus LPHD',
].map((keterangan, i) => ({ id: i + 1, namaAsli: `foto${i + 1}.png`, keterangan, mime: 'image/png', src: LOGO_KEMENHUT_BASE64 }))
const m = susunLaporan(d.st, d.pengaturan, laporanContoh(), fotoContoh)
await renderToFile(<SpjDocument d={d} jenis="laporan" laporan={m} gambarLaporan={{ 1: LOGO_KEMENHUT_BASE64 }} />, path.join(keluar, 'laporan.pdf'))
console.log('ditulis', path.join(keluar, 'laporan.pdf'))
