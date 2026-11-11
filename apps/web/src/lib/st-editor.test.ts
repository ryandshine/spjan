import { describe, expect, it } from 'vitest'
import {
  biayaKosong,
  pelaksanaKosong,
  stKosong,
  type BiayaPayload,
  type PegawaiDto,
  type SuratTugasPayload,
  type UsulanHotelItem,
  type UsulanTransportItem,
} from '@spjan/shared'

import {
  cariPegawaiPejabat,
  pejabatDariPegawai,
  rincianTotal,
  sudahAdaBiayaTiket,
  terapkanHotelKeEtape,
  sesuaikanKodeAkun,
  sinkronkanSemuaUsulanOtomatis,
  tabBergalat,
  tambahBiayaKePelaksana,
} from './st-editor'

function stDenganPelaksana(jumlah: number): SuratTugasPayload {
  return { ...stKosong('524111', 2026), tanggal: '2026-09-01', pelaksana: Array.from({ length: jumlah }, () => pelaksanaKosong()) }
}

function pegawai(sebagian: Partial<PegawaiDto>): PegawaiDto {
  return {
    id: 1,
    aktif: true,
    nama: 'Budi',
    nip: '198001012005011001',
    jabatan: 'Analis',
    instansi: 'Direktorat',
    pangkatGolongan: 'III/a',
    status: null,
    ...sebagian,
  }
}

describe('sesuaikanKodeAkun', () => {
  it('mengganti penanda dalam kurung', () => {
    expect(sesuaikanKodeAkun('524111 (RM)', 'PNBP')).toBe('524111 (PNBP)')
  })

  it('mengganti penanda tanpa kurung', () => {
    expect(sesuaikanKodeAkun('524111 rm', 'PNBP')).toBe('524111 PNBP')
  })

  it('menambahkan penanda bila belum ada', () => {
    expect(sesuaikanKodeAkun(' 524111 ', 'RM')).toBe('524111 (RM)')
  })

  it('tidak mengubah kode akun kosong', () => {
    expect(sesuaikanKodeAkun('', 'RM')).toBe('')
  })
})

describe('pejabat', () => {
  it('menambahkan awalan NIP. hanya bila belum ada', () => {
    expect(pejabatDariPegawai(pegawai({})).pjNip).toBe('NIP. 198001012005011001')
    expect(pejabatDariPegawai(pegawai({ nip: 'nip. 1980' })).pjNip).toBe('nip. 1980')
    expect(pejabatDariPegawai(pegawai({ nip: '' })).pjNip).toBe('')
  })

  it('mencocokkan pegawai lewat nama atau NIP berawalan', () => {
    const daftar = [pegawai({ id: 1, nama: 'Budi' }), pegawai({ id: 2, nama: 'Sari', nip: '1999' })]
    expect(cariPegawaiPejabat(daftar, { pjNama: 'Sari', pjNip: null, pjJabatan: null })?.id).toBe(2)
    expect(cariPegawaiPejabat(daftar, { pjNama: null, pjNip: 'NIP. 1999', pjJabatan: null })?.id).toBe(2)
    expect(cariPegawaiPejabat(daftar, { pjNama: null, pjNip: null, pjJabatan: null })).toBeUndefined()
  })
})

describe('tambahBiayaKePelaksana', () => {
  it('menambah biaya hanya pada pelaksana yang dituju tanpa mengubah aslinya', () => {
    const st = stDenganPelaksana(2)
    const biaya = { ...biayaKosong('TIKET_PERGI'), tarif: 500000 }
    const hasil = tambahBiayaKePelaksana(st, 1, biaya)
    expect(hasil.pelaksana[0]?.biaya).toHaveLength(st.pelaksana[0]?.biaya.length ?? 0)
    expect(hasil.pelaksana[1]?.biaya.at(-1)).toBe(biaya)
    expect(st.pelaksana[1]?.biaya).not.toContain(biaya)
  })
})

describe('tabBergalat', () => {
  it('memisahkan galat tab data dan tab pelaksana', () => {
    expect(tabBergalat({})).toEqual({ data: false, bukti: false, pelaksana: false, laporan: false })
    expect(tabBergalat({ nomor: 'x' })).toEqual({ data: true, bukti: false, pelaksana: false, laporan: false })
    expect(tabBergalat({ 'pelaksana.0.nama': 'x' })).toEqual({ data: false, bukti: false, pelaksana: true, laporan: false })
  })
})

describe('rincianTotal', () => {
  const a = { totalTransport: 100, totalUangHarian: 200, totalRepresentasi: 0, totalPenginapan: 300, totalPengeluaranRiil: 0 }
  const b = { totalTransport: 10, totalUangHarian: 20, totalRepresentasi: 5, totalPenginapan: 30, totalPengeluaranRiil: 0 }

  it('menjumlahkan tiap komponen biaya lintas pelaksana', () => {
    expect(rincianTotal([a, b])).toEqual([
      { label: 'Transport', nilai: 110 },
      { label: 'Penginapan', nilai: 330 },
      { label: 'Uang harian', nilai: 220 },
      { label: 'Representasi', nilai: 5 },
    ])
  })

  it('menambah baris pengeluaran riil hanya bila ada nilainya', () => {
    expect(rincianTotal([a, { ...b, totalPengeluaranRiil: 50 }]).at(-1)).toEqual({ label: 'Pengeluaran riil', nilai: 50 })
  })

  it('mengembalikan nol untuk daftar kosong', () => {
    expect(rincianTotal([]).every((r) => r.nilai === 0)).toBe(true)
  })
})

describe('sinkronkanSemuaUsulanOtomatis', () => {
  const usulanTiket = (sebagian: Partial<UsulanTransportItem>): UsulanTransportItem => ({
    berkasId: 10,
    namaBerkas: 'tiket_riandi.pdf',
    kategoriBerkas: 'tiket',
    ekstraksi: {
      maskapai: 'Garuda Indonesia',
      nomorPenerbangan: 'GA 600',
      asal: 'Jakarta (CGK)',
      tujuan: 'Manado (MDC)',
      tanggal: '2026-09-12',
      penumpang: 'Riandi Eko Priantoro',
      tarif: 4645946,
      nomorTiket: '126-2134567890',
      kodeBooking: 'ABCDEF',
      jam: '08:00',
      arah: 'pergi',
      daftarPenumpang: ['Riandi Eko Priantoro'],
      basisTarif: 'total',
      segmen: [],
      moda: 'pesawat',
    },
    usulanStatus: 'menunggu',
    jumlahPenerima: 1,
    pelaksanaId: null,
    pelaksanaIndex: 0,
    etapeIndex: 0,
    pelaksanaNama: 'Riandi Eko Priantoro',
    jenisBiaya: 'TIKET_PERGI',
    uraianBiaya: 'Tiket Pesawat Jakarta (CGK) - Manado (MDC) (GA 600)',
    tarifRiil: 4645946,
    qty: 1,
    satuan: 'orang',
    provinsi: 'Sulawesi Utara',
    keterangan: 'Tgl: 2026-09-12 · tiket_riandi.pdf',
    peringatan: [],
    ...sebagian,
  })

  const usulanHotel = (sebagian: Partial<UsulanHotelItem>): UsulanHotelItem => ({
    berkasId: 20,
    namaBerkas: 'bill_hotel.pdf',
    ekstraksi: {
      namaHotel: 'Hotel Ibis Manado',
      nomorInvoice: null,
      tamu: 'Riandi Eko Priantoro',
      checkIn: '2026-09-12',
      checkOut: '2026-09-15',
      jumlahMalam: 3,
      tarifPerMalam: 650000,
      totalBiaya: 1950000,
    },
    usulanStatus: 'menunggu',
    pelaksanaId: null,
    pelaksanaIndex: 0,
    etapeIndex: 0,
    pelaksanaNama: 'Riandi Eko Priantoro',
    kota: 'Manado',
    provinsi: 'Sulawesi Utara',
    malam: 3,
    tarifRiilPerMalam: 650000,
    totalRiil: 1950000,
    plafonSbmPerMalam: 800000,
    statusPlafon: 'sesuai',
    selisihPlafon: 0,
    peringatan: [],
    ...sebagian,
  })

  it('usulan dari baca ulang tidak diterapkan otomatis (ditinjau manual)', () => {
    const st = stDenganPelaksana(1)
    const res = sinkronkanSemuaUsulanOtomatis(st, [usulanHotel({ bacaUlang: true })], [usulanTiket({ bacaUlang: true })])
    expect(res.transportBerkasIds).toEqual([])
    expect(res.hotelBerkasIds).toEqual([])
    expect(res.stBaru.pelaksana[0]?.biaya).toHaveLength(0)
  })

  it('otomatis memasukkan biaya tiket ke pelaksana yang cocok tanpa duplikasi', () => {
    const st = stDenganPelaksana(1)
    const t = usulanTiket({})
    const res = sinkronkanSemuaUsulanOtomatis(st, [], [t])
    expect(res.transportBerkasIds).toContain(10)
    expect(res.stBaru.pelaksana[0]?.biaya).toHaveLength(1)
    expect(res.stBaru.pelaksana[0]?.biaya[0]?.tarif).toBe(4645946)

    // Jika disinkronkan lagi, tidak menambah baris duplikat
    const res2 = sinkronkanSemuaUsulanOtomatis(res.stBaru, [], [t])
    expect(res2.stBaru.pelaksana[0]?.biaya).toHaveLength(1)
  })

  it('otomatis mengisi penginapan etape pada pelaksana yang cocok', () => {
    const st = stDenganPelaksana(1)
    const h = usulanHotel({})
    const res = sinkronkanSemuaUsulanOtomatis(st, [h], [])
    expect(res.hotelBerkasIds).toContain(20)
    expect(res.stBaru.pelaksana[0]?.etape[0]?.hotelTambahan?.[0]).toMatchObject({ nama: 'Hotel Ibis Manado', tarif: 650000, sumber: 'kuitansi' })
    expect(res.stBaru.pelaksana[0]?.etape[0]?.malamOverride).toBeNull()
  })

  it('mengabaikan berkas yang statusnya bukan menunggu atau pelaksanaIndex < 0', () => {
    const st = stDenganPelaksana(1)
    const tSudah = usulanTiket({ usulanStatus: 'diterapkan' })
    const tTanpaNama = usulanTiket({ pelaksanaIndex: -1 })
    const res = sinkronkanSemuaUsulanOtomatis(st, [], [tSudah, tTanpaNama])
    expect(res.transportBerkasIds).toHaveLength(0)
    expect(res.stBaru.pelaksana[0]?.biaya).toHaveLength(0)
  })

  it('sudahAdaBiayaTiket mendeteksi kesamaan nomor tiket atau nama berkas', () => {
    const t = usulanTiket({})
    const biayaList = [
      {
        ...biayaKosong('TIKET_PERGI'),
        keterangan: 'Tgl: 2026-09-12 · tiket_riandi.pdf',
        tarif: 4645946,
      },
    ]
    expect(sudahAdaBiayaTiket(biayaList, t)).toBe(true)
    expect(sudahAdaBiayaTiket([], t)).toBe(false)
  })
})

describe('sudahAdaBiayaTiket - nomor tiket sama pada arah berbeda', () => {
  const biayaPergi = {
    jenis: 'TIKET_PERGI', uraian: 'Tiket Pesawat CGK - SOQ', qty: 1, satuan: 'orang', tarif: 3_000_000,
    keterangan: 'Tgl: 2026-10-07, No. Tiket: 126-1', etapeIndex: 0, provinsi: null,
  } as BiayaPayload
  const usulan = (jenisBiaya: 'TIKET_PERGI' | 'TIKET_KEMBALI', tanggal: string) =>
    ({
      namaBerkas: 'pp.pdf', jenisBiaya, uraianBiaya: 'x', tarifRiil: 1,
      ekstraksi: { nomorTiket: '126-1', tanggal },
    }) as unknown as UsulanTransportItem

  it('tiket pulang bernomor sama bukan duplikat', () => {
    expect(sudahAdaBiayaTiket([biayaPergi], usulan('TIKET_KEMBALI', '2026-10-09'))).toBe(false)
  })
  it('arah dan tanggal sama tetap duplikat', () => {
    expect(sudahAdaBiayaTiket([biayaPergi], usulan('TIKET_PERGI', '2026-10-07'))).toBe(true)
  })
})

describe('terapkanHotelKeEtape - kartu kuitansi', () => {
  const stDasar = (): SuratTugasPayload => ({
    ...stKosong(),
    pelaksana: [{ ...pelaksanaKosong(), nama: 'A', etape: [{ ...pelaksanaKosong().etape[0]!, provinsi: 'BALI', kota: 'Denpasar', berangkat: '2026-10-01', pulang: '2026-10-05', hotelPerKartu: true }] }],
  })
  const kuitansi = (berkasId: number, checkIn: string, checkOut: string, malam: number) =>
    ({ berkasId, malam, tarifRiilPerMalam: 500_000, ekstraksi: { namaHotel: `H${berkasId}`, checkIn, checkOut } }) as unknown as UsulanHotelItem

  it('dua kuitansi menjadi dua kartu dengan tanggal masing-masing', () => {
    let st = terapkanHotelKeEtape(stDasar(), 0, 0, kuitansi(1, '2026-10-01', '2026-10-03', 2))
    st = terapkanHotelKeEtape(st, 0, 0, kuitansi(2, '2026-10-03', '2026-10-05', 2))
    expect(st.pelaksana[0]!.etape[0]!.hotelTambahan!.map((r) => [r.nama, r.tanggal])).toEqual([
      ['H1', ['2026-10-01', '2026-10-02']],
      ['H2', ['2026-10-03', '2026-10-04']],
    ])
  })
  it('kuitansi yang sama tidak dobel, tanggal bentrok tidak diambil', () => {
    let st = terapkanHotelKeEtape(stDasar(), 0, 0, kuitansi(1, '2026-10-01', '2026-10-03', 2))
    st = terapkanHotelKeEtape(st, 0, 0, kuitansi(1, '2026-10-01', '2026-10-03', 2))
    st = terapkanHotelKeEtape(st, 0, 0, kuitansi(2, '2026-10-02', '2026-10-04', 2))
    expect(st.pelaksana[0]!.etape[0]!.hotelTambahan!.map((r) => r.tanggal)).toEqual([['2026-10-01', '2026-10-02'], ['2026-10-03']])
  })

  // Bukti hotel yang sama sering diunggah sebagai beberapa berkas (invoice, bukti bayar, folio, foto).
  const salinan = (berkasId: number, checkIn: string, checkOut: string, malam: number, nama = 'Planet Holiday Hotel', tarif = 680_000) =>
    ({ berkasId, malam, tarifRiilPerMalam: tarif, ekstraksi: { namaHotel: nama, checkIn, checkOut } }) as unknown as UsulanHotelItem

  it('berkas lain berisi kuitansi yang sama (hotel, tarif, malam sudah tercakup) tidak menjadi kartu baru', () => {
    let st = terapkanHotelKeEtape(stDasar(), 0, 0, salinan(1, '2026-10-01', '2026-10-03', 2))
    st = terapkanHotelKeEtape(st, 0, 0, salinan(2, '2026-10-01', '2026-10-03', 2, 'PLANET HOLIDAY HOTEL '))
    st = terapkanHotelKeEtape(st, 0, 0, salinan(3, '2026-10-01', '2026-10-02', 1))
    expect(st.pelaksana[0]!.etape[0]!.hotelTambahan!.map((r) => [r.berkasId, r.tanggal])).toEqual([[1, ['2026-10-01', '2026-10-02']]])
  })

  it('kuitansi di luar tanggal perjalanan: hotel, tarif, dan jumlah malam sama dianggap salinan', () => {
    let st = terapkanHotelKeEtape(stDasar(), 0, 0, salinan(1, '2026-09-01', '2026-09-03', 2))
    st = terapkanHotelKeEtape(st, 0, 0, salinan(2, '2026-09-01', '2026-09-03', 2))
    expect(st.pelaksana[0]!.etape[0]!.hotelTambahan).toHaveLength(1)
  })

  it('hotel sama tetapi tarif lain, atau malam yang belum tercakup, tetap menjadi kartu sendiri', () => {
    let st = terapkanHotelKeEtape(stDasar(), 0, 0, salinan(1, '2026-10-01', '2026-10-03', 2))
    st = terapkanHotelKeEtape(st, 0, 0, salinan(2, '2026-10-03', '2026-10-04', 1, 'Planet Holiday Hotel', 750_000))
    st = terapkanHotelKeEtape(st, 0, 0, salinan(3, '2026-10-02', '2026-10-05', 3))
    expect(st.pelaksana[0]!.etape[0]!.hotelTambahan!.map((r) => [r.berkasId, r.tanggal])).toEqual([
      [1, ['2026-10-01', '2026-10-02']],
      [2, ['2026-10-03']],
      [3, ['2026-10-04']],
    ])
  })
})
