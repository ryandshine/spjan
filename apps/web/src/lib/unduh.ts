/** Picu unduhan peramban untuk `blob` dengan nama berkas `nama`. */
export function unduhBlob(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
