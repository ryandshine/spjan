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
    const pesan = i.code === 'too_small' && i.origin === 'string' ? 'wajib diisi' : i.message
    return `${bagian.join(' > ')}: ${pesan}`
  })
}
