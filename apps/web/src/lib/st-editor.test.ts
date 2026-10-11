import { describe, expect, it } from 'vitest'
import { biayaKosong, pelaksanaKosong, stKosong, type PegawaiDto, type SuratTugasPayload } from '@spjan/shared'

import {
  cariPegawaiPejabat,
  pejabatDariPegawai,
  rincianTotal,
  sesuaikanKodeAkun,
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
    expect(tabBergalat({})).toEqual({ data: false, pelaksana: false })
    expect(tabBergalat({ nomor: 'x' })).toEqual({ data: true, pelaksana: false })
    expect(tabBergalat({ 'pelaksana.0.nama': 'x' })).toEqual({ data: false, pelaksana: true })
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
