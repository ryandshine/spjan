import { describe, expect, it } from 'vitest'
import { biayaKosong, pelaksanaKosong, stKosong, type PegawaiDto, type SuratTugasPayload } from '@spjan/shared'

import {
  bacaNomorUrutAwal,
  bacaPolaNoSpd,
  cariNoSpdTerisi,
  cariPegawaiPejabat,
  isiNoSpdBerurutan,
  pejabatDariPegawai,
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

describe('nomor SPD', () => {
  it('membaca angka awal dan sufiks dari nomor yang ada', () => {
    expect(bacaPolaNoSpd('405/SPD/PPS/2026', '/X')).toEqual({ angkaAwal: 405, sufiks: '/SPD/PPS/2026' })
  })

  it('memakai sufiks bawaan bila nomor hanya berisi angka', () => {
    expect(bacaPolaNoSpd('12', '/SPD/PPS/2026')).toEqual({ angkaAwal: 12, sufiks: '/SPD/PPS/2026' })
  })

  it('kembali ke 401 bila nomor tidak diawali angka', () => {
    expect(bacaPolaNoSpd('SPD-1', '/SPD/PPS/2026')).toEqual({ angkaAwal: 401, sufiks: '/SPD/PPS/2026' })
  })

  it('menolak nomor urut awal yang bukan angka positif', () => {
    expect(bacaNomorUrutAwal('abc')).toBeNull()
    expect(bacaNomorUrutAwal('0')).toBeNull()
    expect(bacaNomorUrutAwal(' 401 ')).toBe(401)
  })

  it('mengisi berurutan dan melengkapi tanggal SPD yang kosong saja', () => {
    const st = stDenganPelaksana(3)
    const pertama = st.pelaksana[0]
    if (!pertama) throw new Error('pelaksana pertama tidak ada')
    pertama.tanggalSpd = '2026-08-30'
    const hasil = isiNoSpdBerurutan(st, 401, '/SPD/PPS/2026')
    expect(hasil.pelaksana.map((p) => p.noSpd)).toEqual(['401/SPD/PPS/2026', '402/SPD/PPS/2026', '403/SPD/PPS/2026'])
    expect(hasil.pelaksana.map((p) => p.tanggalSpd)).toEqual(['2026-08-30', '2026-09-01', '2026-09-01'])
  })

  it('mencari nomor SPD pertama yang terisi', () => {
    const st = stDenganPelaksana(2)
    expect(cariNoSpdTerisi(st.pelaksana)).toBeUndefined()
    const kedua = st.pelaksana[1]
    if (!kedua) throw new Error('pelaksana kedua tidak ada')
    kedua.noSpd = ' 7/SPD '
    expect(cariNoSpdTerisi(st.pelaksana)).toBe('7/SPD')
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
