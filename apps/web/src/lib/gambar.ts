export interface KompresGambarOpsi {
  /** Batas dimensi maksimal lebar atau tinggi gambar (piksel). Default: 2048. */
  maxDimensi?: number
  /** Kualitas kompresi JPEG antara 0.1 hingga 1.0. Default: 0.88. */
  kualitas?: number
}

export interface HasilKompresi {
  file: File
  asliSize: number
  baruSize: number
  lebar: number
  tinggi: number
  rasio: number
}

/** Hitung dimensi baru proporsional agar tidak melebihi batas maksimal. */
export function hitungDimensiProporsional(
  lebar: number,
  tinggi: number,
  maxDim: number
): { lebar: number; tinggi: number } {
  if (lebar <= maxDim && tinggi <= maxDim) {
    return { lebar, tinggi }
  }

  if (lebar > tinggi) {
    const tinggiBaru = Math.round((tinggi * maxDim) / lebar)
    return { lebar: maxDim, tinggi: tinggiBaru }
  }

  const lebarBaru = Math.round((lebar * maxDim) / tinggi)
  return { lebar: lebarBaru, tinggi: maxDim }
}

/** Hasilkan nama berkas foto yang rapi dan konsisten berekstensi .jpg. */
export function standarkanNamaFoto(namaAsli: string): string {
  const tgl = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp = `${tgl.getFullYear()}${pad(tgl.getMonth() + 1)}${pad(tgl.getDate())}-${pad(tgl.getHours())}${pad(tgl.getMinutes())}${pad(tgl.getSeconds())}`

  const namaKecil = (namaAsli || '').toLowerCase().trim()
  const isGenerik =
    !namaKecil ||
    namaKecil === 'image.jpg' ||
    namaKecil === 'image.jpeg' ||
    namaKecil === 'image.png' ||
    namaKecil === 'blob' ||
    namaKecil.startsWith('camera') ||
    namaKecil.startsWith('img_') ||
    namaKecil.startsWith('img-')

  if (isGenerik) {
    return `foto-${timestamp}.jpg`
  }

  // Jika sudah punya nama deskriptif, ubah ekstensi menjadi .jpg
  return namaAsli.replace(/\.[^/.]+$/, '') + '.jpg'
}

/**
 * Kompres berkas gambar di sisi klien menggunakan canvas HTML5.
 * Mengurangi ukuran byte foto kamera HP (biasanya 8–20 MB) menjadi ~500 KB - 1.5 MB
 * tanpa mengurangi ketajaman teks/angka kuitansi untuk AI Vision.
 */
export async function kompresGambar(
  file: File,
  opsi: KompresGambarOpsi = {}
): Promise<HasilKompresi> {
  const maxDim = opsi.maxDimensi ?? 2048
  const kualitas = opsi.kualitas ?? 0.88
  const asliSize = file.size

  // Jika bukan gambar atau bukan di browser canvas, kembalikan berkas asli
  if (
    !file.type.startsWith('image/') ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return {
      file,
      asliSize,
      baruSize: asliSize,
      lebar: 0,
      tinggi: 0,
      rasio: 1,
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const { lebar, tinggi } = hitungDimensiProporsional(img.naturalWidth, img.naturalHeight, maxDim)

      const canvas = document.createElement('canvas')
      canvas.width = lebar
      canvas.height = tinggi
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve({
          file,
          asliSize,
          baruSize: asliSize,
          lebar: img.naturalWidth,
          tinggi: img.naturalHeight,
          rasio: 1,
        })
        return
      }

      // Beri latar belakang putih (mencegah transparansi menjadi hitam pada format JPEG)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, lebar, tinggi)
      ctx.drawImage(img, 0, 0, lebar, tinggi)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              asliSize,
              baruSize: asliSize,
              lebar,
              tinggi,
              rasio: 1,
            })
            return
          }

          const namaBaru = standarkanNamaFoto(file.name)
          const fileBaru = new File([blob], namaBaru, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })

          resolve({
            file: fileBaru,
            asliSize,
            baruSize: fileBaru.size,
            lebar,
            tinggi,
            rasio: fileBaru.size / asliSize,
          })
        },
        'image/jpeg',
        kualitas
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({
        file,
        asliSize,
        baruSize: asliSize,
        lebar: 0,
        tinggi: 0,
        rasio: 1,
      })
    }

    img.src = url
  })
}

/** Keterangan foto yang benar-benar ditulis pengguna; nama berkas (dengan atau tanpa ekstensi) dianggap kosong. */
export function keteranganFoto(b: { keterangan: string | null; namaAsli: string }): string {
  const k = (b.keterangan ?? '').trim()
  if (!k) return ''
  const tanpaEkstensi = b.namaAsli.replace(/\.[^/.]+$/, '')
  return k === b.namaAsli || k === tanpaEkstensi ? '' : k
}
