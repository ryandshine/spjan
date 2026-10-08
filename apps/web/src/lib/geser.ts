/** Salinan array dengan elemen i digeser satu posisi; tidak berubah bila di luar batas. */
export function geser<T>(arr: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta
  if (j < 0 || j >= arr.length) return arr
  const salin = [...arr]
  const a = salin[i] as T
  salin[i] = salin[j] as T
  salin[j] = a
  return salin
}
