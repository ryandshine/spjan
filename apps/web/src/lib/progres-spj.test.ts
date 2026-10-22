import { describe, expect, it } from 'vitest'
import { pelaksanaKosong, stKosong, type PelaksanaHasil, type SpjHasil } from '@spjan/shared'

import { hitungProgresSpj } from './progres-spj'

describe('hitungProgresSpj', () => {
  const hasilKosong: SpjHasil = {
    total: 0,
    terbilang: 'Nol rupiah',
    teksTanggalSpj: '2026-10-05',
    teksTanggalSt: '2026-10-01',
    pelaksana: [],
  }

  it('menghitung persentase awal untuk ST kosong dengan nilai rendah', () => {
    const st = stKosong('524111', 2026)
    const progres = hitungProgresSpj(st, hasilKosong, [], false)
    expect(progres.persen).toBeLessThan(50)
    expect(progres.totalPeringatan).toBeGreaterThan(0)
    expect(progres.perTahap.data.peringatan).toBeGreaterThan(0)
  })

  it('tidak pernah menghasilkan 100% jika masih ada peringatan aktif', () => {
    const p1 = pelaksanaKosong()
    p1.nama = 'Budi'
    p1.nip = '19800101'
    p1.status = 'ESELON_IV_GOL_III_II_I'
    p1.noSpd = 'SPD/01'
    p1.etape = [
      {
        provinsi: 'JAWA BARAT',
        kota: 'Bandung',
        berangkat: '2026-10-02',
        pulang: '2026-10-04',
        kegiatan: 'Koordinasi',
        hotelTarif: 500000,
      },
    ]

    const st = {
      ...stKosong('524111', 2026),
      nomor: 'ST.123',
      tanggal: '2026-10-01',
      pjNama: 'Pejabat',
      pelaksana: [p1],
    }

    const pelHasil: PelaksanaHasil = {
      nama: 'Budi',
      nip: '19800101',
      jabatan: 'Staff',
      status: 'ESELON_IV_GOL_III_II_I',
      noSpd: 'SPD/01',
      tanggalSpd: '2026-10-01',
      teksTanggalSpd: '1 Oktober 2026',
      rute: 'Jakarta - Bandung',
      total: 1000000,
      totalUangHarian: 500000,
      totalPenginapan: 500000,
      totalTransport: 0,
      totalRepresentasi: 0,
      totalPengeluaranRiil: 0,
      terbilangPengeluaranRiil: 'Nol rupiah',
      terbilang: 'Satu juta rupiah',
      uraianSptb: 'Biaya perjalanan',
      uangHarian: [],
      representasi: [],
      transport: [],
      penginapan: [],
      pengeluaranRiil: [],
      peringatan: [{ kode: 'HOTEL_MELEBIHI_BATAS', pesan: 'Tarif hotel melebihi batas SBM' }],
      catatan: [],
    }

    const hasilDenganPeringatan: SpjHasil = {
      total: 1000000,
      terbilang: 'Satu juta rupiah',
      teksTanggalSpj: '2026-10-05',
      teksTanggalSt: '2026-10-01',
      pelaksana: [pelHasil],
    }

    const progres = hitungProgresSpj(
      st,
      hasilDenganPeringatan,
      [
        {
          id: 1,
          stId: 1,
          pelaksanaId: null,
          jenis: 'hotel',
          namaAsli: 'bill.pdf',
          sha256: 'a',
          ukuran: 100,
          keterangan: null,
          createdAt: '',
          mime: 'application/pdf',
          ekstraksi: {
            id: 1,
            berkasId: 1,
            versi: 1,
            model: 'test',
            status: 'selesai',
            hasilRaw: null,
            hasilJson: null,
            galat: null,
            lamaMs: 10,
            createdAt: '',
          },
        },
      ],
      true,
    )
    expect(progres.totalPeringatan).toBeGreaterThan(0)
    expect(progres.persen).toBeLessThanOrEqual(95)
    expect(progres.persen).not.toBe(100)
  })
})
