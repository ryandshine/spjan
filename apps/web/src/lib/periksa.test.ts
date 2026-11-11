import { describe, expect, it } from 'vitest'
import type { Peringatan } from '@spjan/shared'

import { bagianUntukSasaran, kumpulkanPeriksa } from './periksa'
import { ringkasPeringatan } from './periksa'

const peringatan = (kode: Peringatan['kode'], pesan: string, etape?: number): Peringatan => ({ kode, pesan, ...(etape === undefined ? {} : { etape }) })

describe('kumpulkanPeriksa', () => {
  it('meratakan peringatan lintas pelaksana dengan nomor, nama, dan isian sasaran', () => {
    const hasil = kumpulkanPeriksa([
      { nama: 'Budi', peringatan: [peringatan('NO_SPD_KOSONG', 'No. SPD kosong')] },
      { nama: '', peringatan: [peringatan('TANGGAL_SALAH', 'Tanggal salah', 0), peringatan('NIP_KOSONG', 'NIP kosong')] },
    ])
    expect(hasil).toEqual([
      { pesan: 'No. SPD kosong', nomorPelaksana: 1, namaPelaksana: 'Budi', sasaranId: 'pel-1-spd' },
      { pesan: 'Tanggal salah', nomorPelaksana: 2, namaPelaksana: 'Pelaksana 2', sasaranId: 'etape-2-1-brkt' },
      { pesan: 'NIP kosong', nomorPelaksana: 2, namaPelaksana: 'Pelaksana 2', sasaranId: 'pel-2-nip' },
    ])
  })

  it('tarif uang harian melebihi SBM menunjuk isian tarif di bagian uang harian', () => {
    const [w] = kumpulkanPeriksa([{ nama: 'Budi', peringatan: [peringatan('UANG_HARIAN_MELEBIHI_SBM', 'Etape 2: tarif uang harian melebihi SBM', 1)] }])
    expect(w?.sasaranId).toBe('etape-1-2-uang-harian')
    expect(bagianUntukSasaran('etape-1-2-uang-harian')).toBe('uang_harian')
    expect(bagianUntukSasaran('etape-1-2-tarif')).toBe('penginapan')
  })

  it('mengembalikan daftar kosong bila tidak ada peringatan', () => {
    expect(kumpulkanPeriksa([{ nama: 'Budi', peringatan: [] }])).toEqual([])
  })
})

describe('ringkasPeringatan', () => {
  it('menggabungkan pesan sama walau jumlah malam berbeda, dan menandai tujuan lanjutan', () => {
    const hasil = ringkasPeringatan([
      { nama: 'A', peringatan: [{ kode: 'NIP_KOSONG', pesan: 'NIP belum diisi.' }, { kode: 'TARIF_HOTEL_KOSONG', pesan: 'Etape 1: tarif hotel belum diisi (6 malam).', etape: 0 }] },
      { nama: 'B', peringatan: [{ kode: 'TARIF_HOTEL_KOSONG', pesan: 'Etape 2: tarif hotel belum diisi (8 malam).', etape: 1 }] },
    ])
    expect(hasil).toEqual([
      { masalah: 'NIP belum diisi', nama: ['A'] },
      { masalah: 'Tarif hotel belum diisi', nama: ['A', 'B (Tujuan 2)'] },
    ])
  })
})
