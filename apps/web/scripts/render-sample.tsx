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
