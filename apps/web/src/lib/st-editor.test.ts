import { describe, expect, it } from 'vitest'
import {
  biayaKosong,
  pelaksanaKosong,
  stKosong,
  type PegawaiDto,
  type SuratTugasPayload,
  type UsulanHotelItem,
  type UsulanTransportItem,
} from '@spjan/shared'

import {
  cariPegawaiPejabat,
  pejabatDariPegawai,
  rincianTotal,
  sesuaikanKodeAkun,
  sinkronkanSemuaUsulanOtomatis,
  sudahAdaBiayaTiket,
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
    expect(res.stBaru.pelaksana[0]?.etape[0]?.hotelNama).toBe('Hotel Ibis Manado')
    expect(res.stBaru.pelaksana[0]?.etape[0]?.hotelTarif).toBe(650000)
    expect(res.stBaru.pelaksana[0]?.etape[0]?.malamOverride).toBe(3)
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
