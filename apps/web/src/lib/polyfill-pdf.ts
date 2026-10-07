/**
 * Tambalan fitur JavaScript baru yang dipakai pdf.js, agar pratinjau PDF jalan di Chrome/WebView Android lama.
 * Hanya mendefinisikan fitur yang belum ada.
 */
type Longgar = Record<string, unknown>
const longgar = (o: object) => o as Longgar
const bila = (o: object, nama: string, isi: unknown) => {
  if (typeof longgar(o)[nama] !== 'function') Object.defineProperty(o, nama, { value: isi, writable: true, configurable: true })
}

export function pasangPolyfillPdf(): void {
  bila(Promise, 'withResolvers', function () {
    let resolve!: (v: unknown) => void
    let reject!: (r?: unknown) => void
    const promise = new Promise((a, b) => {
      resolve = a
      reject = b
    })
    return { promise, resolve, reject }
  })

  for (const Kelas of [Map, WeakMap]) {
    bila(Kelas.prototype, 'getOrInsert', function (this: Map<unknown, unknown>, kunci: unknown, nilai: unknown) {
      if (!this.has(kunci)) this.set(kunci, nilai)
      return this.get(kunci)
    })
    bila(Kelas.prototype, 'getOrInsertComputed', function (this: Map<unknown, unknown>, kunci: unknown, fn: (k: unknown) => unknown) {
      if (!this.has(kunci)) this.set(kunci, fn(kunci))
      return this.get(kunci)
    })
  }

  bila(Array, 'fromAsync', async (sumber: AsyncIterable<unknown>) => {
    const hasil: unknown[] = []
    for await (const x of sumber) hasil.push(x)
    return hasil
  })

  bila(URL, 'parse', (url: string, dasar?: string) => {
    try {
      return new URL(url, dasar)
    } catch {
      return null
    }
  })

  bila(Math, 'sumPrecise', (angka: Iterable<number>) => {
    let jumlah = 0
    for (const n of angka) jumlah += n
    return jumlah
  })

  bila(Uint8Array.prototype, 'toHex', function (this: Uint8Array) {
    return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('')
  })
  bila(Uint8Array, 'fromHex', (hex: string) => {
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    return out
  })
  bila(Uint8Array.prototype, 'toBase64', function (this: Uint8Array) {
    let s = ''
    for (const b of this) s += String.fromCharCode(b)
    return btoa(s)
  })
  bila(Uint8Array, 'fromBase64', (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

  const iter = (globalThis as Longgar).Iterator as { prototype?: object } | undefined
  if (iter?.prototype) {
    bila(iter.prototype, 'toArray', function (this: Iterable<unknown>) {
      return Array.from(this)
    })
  }
}
