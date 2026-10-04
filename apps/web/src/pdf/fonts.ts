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
