interface Isu {
  path: ReadonlyArray<PropertyKey>
  message: string
  code: string
  origin?: unknown
}

const LABEL: Record<string, string> = {
  nomor: 'Nomor surat tugas',
  tanggal: 'Tanggal surat tugas',
  tanggalSpj: 'Tanggal SPJ',
  kodeAkun: 'Kode akun',
  catatan: 'Catatan',
  nama: 'Nama',
  nip: 'NIP',
  jabatan: 'Jabatan',
  status: 'Status',
  noSpd: 'No. SPD',
  tanggalSpd: 'Tanggal SPD',
  provinsi: 'Provinsi',
  kota: 'Kota',
  kegiatan: 'Kegiatan',
  berangkat: 'Tanggal berangkat',
  pulang: 'Tanggal pulang',
  hotelNama: 'Nama hotel',
  hotelTarif: 'Tarif hotel',
  malamOverride: 'Malam menginap',
  jenis: 'Jenis biaya',
  uraian: 'Uraian',
  qty: 'Jumlah',
  satuan: 'Satuan',
  tarif: 'Tarif',
  keterangan: 'Keterangan',
}

function pesanIsu(i: Isu): string {
  return i.code === 'too_small' && i.origin === 'string' ? 'wajib diisi' : i.message
}

/** Mengubah isu validasi zod menjadi kalimat Indonesia dengan lokasi (Pelaksana 1 > Tujuan 2 > Tarif hotel). */
export function pesanValidasi(isu: ReadonlyArray<Isu>): string[] {
  return isu.map((i) => {
    const bagian: string[] = []
    const p = i.path
    for (let k = 0; k < p.length; k += 1) {
      const kunci = String(p[k])
      const berikut = p[k + 1]
      if ((kunci === 'pelaksana' || kunci === 'etape' || kunci === 'biaya') && typeof berikut === 'number') {
        bagian.push(`${kunci === 'pelaksana' ? 'Pelaksana' : kunci === 'etape' ? 'Tujuan' : 'Biaya'} ${berikut + 1}`)
        k += 1
      } else {
        bagian.push(LABEL[kunci] ?? kunci)
      }
    }
    return `${bagian.join(' > ')}: ${pesanIsu(i)}`
  })
}

/** Peta galat per kolom, kuncinya path zod digabung titik (mis. "pelaksana.0.etape.1.kota"). Hanya pesan pertama per kolom. */
export type PetaGalat = Record<string, string>

export function petaGalat(isu: ReadonlyArray<Isu>): PetaGalat {
  const peta: PetaGalat = {}
  for (const i of isu) {
    const kunci = i.path.map(String).join('.')
    if (!(kunci in peta)) peta[kunci] = pesanIsu(i)
  }
  return peta
}

/** Mengambil bagian peta di bawah awalan tertentu, dengan awalan dibuang (mis. awalan "etape.1" -> kunci "kota"). */
export function cakupanGalat(peta: PetaGalat | undefined, awalan: string): PetaGalat {
  const hasil: PetaGalat = {}
  if (!peta) return hasil
  const depan = `${awalan}.`
  for (const [k, v] of Object.entries(peta)) {
    if (k.startsWith(depan)) hasil[k.slice(depan.length)] = v
  }
  return hasil
}
