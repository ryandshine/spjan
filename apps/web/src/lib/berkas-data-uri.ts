/** Mengunduh isi berkas dari server menjadi data URI agar bisa dirender `@react-pdf/renderer`. */
export async function muatDataUri(berkasId: number): Promise<string> {
  const res = await fetch(`/api/berkas/${berkasId}/isi`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Berkas ${berkasId} tidak dapat dimuat.`)
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
