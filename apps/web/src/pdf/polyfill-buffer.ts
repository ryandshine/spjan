import { Buffer } from 'buffer'

// @react-pdf/renderer memanggil `Buffer.isBuffer` saat memuat gambar; peramban tidak punya Buffer.
const global = globalThis as { Buffer?: typeof Buffer }
if (typeof global.Buffer === 'undefined') global.Buffer = Buffer
