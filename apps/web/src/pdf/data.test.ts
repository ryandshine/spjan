import { describe, expect, it } from 'vitest'
import { siapkanDokumen } from './data'
import type { HasilSuratTugasDto } from '@spjan/shared'

const mockDto: HasilSuratTugasDto = {
  suratTugas: {
    id: 1,
    versiSbmId: 1,
    nomor: 'ST-001/2026',
    tanggal: '2026-09-01',
    tanggalSpj: null,
    kodeAkun: '524111',
    catatan: 'Monitoring Lapangan',
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    pelaksana: [],
  },
  pengaturan: {
    kodeSatker: '666666',
    namaSatker: 'Direktorat Penyiapan Kawasan Perhutanan Sosial',
    dasarDipa: 'DIPA-029.06.1.666666/2026',
    kotaKedudukan: 'Jakarta',
    provinsiKedudukan: 'DKI Jakarta',
    tahunAnggaran: 2026,
    ppkNama: 'Pejabat Pembuat Komitmen',
    ppkNip: '197501012000031001',
    bendaharaNama: 'Bendahara Pengeluaran',
    bendaharaNip: '198001012005012001',
    pjNama: 'PJ Kegiatan',
    pjNip: '197801012002121001',
    pjJabatan: 'Kasubdit',
    pembuatDaftarNama: 'BPP',
    pembuatDaftarNip: '198501012010011001',
    kodeAkunDefault: '524111',
  },
  hasil: {
    pelaksana: [],
    total: 1000000,
    terbilang: 'Satu Juta Rupiah',
    teksTanggalSt: '1 September 2026',
    teksTanggalSpj: '',
  },
}

describe('siapkanDokumen', () => {
  it('menggunakan tanggal pembuatan (createdAt) saat tanggal SPJ tidak diisi', () => {
    const hasil = siapkanDokumen(mockDto)
    expect(hasil.teksTanggalDokumen).toBe('2 Oktober 2026')
    expect(hasil.tempatTanggal).toBe('Jakarta, 2 Oktober 2026')
  })

  it('menggunakan teksTanggalSpj jika tanggal SPJ diisi', () => {
    const customDto: HasilSuratTugasDto = {
      ...mockDto,
      suratTugas: {
        ...mockDto.suratTugas,
        tanggalSpj: '2026-10-15',
      },
      hasil: {
        ...mockDto.hasil,
        teksTanggalSpj: '15 Oktober 2026',
      },
    }
    const hasil = siapkanDokumen(customDto)
    expect(hasil.teksTanggalDokumen).toBe('15 Oktober 2026')
    expect(hasil.tempatTanggal).toBe('Jakarta, 15 Oktober 2026')
  })

  it('fallback ke tanggal hari ini jika createdAt kosong', () => {
    const noCreatedAtDto: HasilSuratTugasDto = {
      ...mockDto,
      suratTugas: {
        ...mockDto.suratTugas,
        createdAt: '',
      },
    }
    const hasil = siapkanDokumen(noCreatedAtDto)
    expect(hasil.teksTanggalDokumen.length).toBeGreaterThan(0)
    expect(hasil.tempatTanggal).toContain('Jakarta, ')
    expect(hasil.tempatTanggal).not.toContain('   ')
  })
})
