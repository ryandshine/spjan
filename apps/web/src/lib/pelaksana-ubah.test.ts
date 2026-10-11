import { describe, expect, it } from 'vitest'
import { SBM_2026, biayaKosong, etapeKosong, type PelaksanaPayload } from '@spjan/shared'

import { batasHotelEtape, biayaPerTujuan, hapusEtape, tambahTransportJakartaSekitar, ubahBiaya, ubahEtape } from './pelaksana-ubah'

const sbm = SBM_2026
const pelaksana = (p: Partial<PelaksanaPayload> = {}): PelaksanaPayload => ({
  pegawaiId: null,
  nama: 'Budi',
  nip: '',
  jabatan: '',
  etape: [{ ...etapeKosong(), berangkat: '2026-10-15', pulang: '2026-10-15' }, etapeKosong()],
  biaya: [],
  ...p,
}) as PelaksanaPayload

describe('hapusEtape', () => {
  it('melepas biaya milik tujuan yang dihapus dan menggeser tujuan sesudahnya', () => {
    const p = pelaksana({
      biaya: [
        { ...biayaKosong('TIKET_PERGI'), etapeIndex: 0 },
        { ...biayaKosong('TIKET_PERGI'), etapeIndex: 1 },
      ],
    })
    const hasil = hapusEtape(p, 0)
    expect(hasil.etape).toHaveLength(1)
    expect(hasil.biaya.map((b) => b.etapeIndex)).toEqual([null, 0])
  })
})

describe('ubahEtape', () => {
  it('hanya mengubah tujuan yang dipilih', () => {
    const hasil = ubahEtape(pelaksana(), 1, { kegiatan: 'Rapat' }, sbm)
    expect(hasil.etape[0]?.kegiatan).not.toBe('Rapat')
    expect(hasil.etape[1]?.kegiatan).toBe('Rapat')
  })
})

describe('ubahBiaya', () => {
  it('transport Jakarta-sekitarnya menandai tujuannya dalam kota dan tanpa menginap bila sehari', () => {
    const p = pelaksana({ biaya: [biayaKosong('TRANSPORT_JAKARTA_SEKITAR')] })
    const hasil = ubahBiaya(p, 0, { uraian: 'Kota Bogor' })
    expect(hasil.etape[0]?.dalamKota8Jam).toBe(true)
    expect(hasil.etape[0]?.malamOverride).toBe(0)
    expect(hasil.biaya[0]?.uraian).toBe('Kota Bogor')
  })

  it('transport Jakarta-sekitarnya tidak menandai dalam kota bila perjalanan beberapa hari', () => {
    const p = pelaksana({
      etape: [{ ...etapeKosong(), berangkat: '2026-10-12', pulang: '2026-10-14' }],
      biaya: [biayaKosong('TRANSPORT_JAKARTA_SEKITAR')],
    })
    const hasil = ubahBiaya(p, 0, { uraian: 'Kab. Tangerang' })
    expect(hasil.etape[0]?.dalamKota8Jam).toBeFalsy()
    expect(hasil.etape[0]?.malamOverride ?? null).toBeNull()
  })

  it('biaya jenis lain tidak menyentuh tujuan', () => {
    const p = pelaksana({ biaya: [biayaKosong('LAINNYA')] })
    const hasil = ubahBiaya(p, 0, { uraian: 'Parkir' })
    expect(hasil.etape).toEqual(p.etape)
  })
})

describe('tambahTransportJakartaSekitar', () => {
  it('tidak menandai dalam kota bila perjalanan beberapa hari', () => {
    const p = pelaksana({ etape: [{ ...etapeKosong(), berangkat: '2026-10-12', pulang: '2026-10-14' }] })
    expect(tambahTransportJakartaSekitar(p, sbm).etape[0]?.dalamKota8Jam).toBeFalsy()
  })

  it('menambah satu baris biaya PP dan menandai tujuan pertama dalam kota', () => {
    const hasil = tambahTransportJakartaSekitar(pelaksana(), sbm)
    expect(hasil.biaya).toHaveLength(1)
    expect(hasil.biaya[0]).toMatchObject({ jenis: 'TRANSPORT_JAKARTA_SEKITAR', qty: 2, keterangan: 'Bukti terlampir' })
    expect(hasil.etape[0]?.dalamKota8Jam).toBe(true)
  })
})

describe('biayaPerTujuan', () => {
  it('BBM dan E-Toll dihitung per jenis sendiri-sendiri', () => {
    const p = pelaksana({ biaya: [{ ...biayaKosong('BBM_KENDARAAN'), etapeIndex: 0 }] })
    expect(biayaPerTujuan(p, 'BBM_KENDARAAN').etapeIndex).toBe(1)
    expect(biayaPerTujuan(p, 'TOL_ETOLL').etapeIndex).toBe(0)
  })

  it('menautkan ke tujuan berikutnya yang belum punya tiket pergi, lalu tanpa tautan', () => {
    const p = pelaksana()
    expect(biayaPerTujuan(p, 'TIKET_PERGI').etapeIndex).toBe(0)
    const satu = pelaksana({ biaya: [{ ...biayaKosong('TIKET_PERGI'), etapeIndex: 0 }] })
    expect(biayaPerTujuan(satu, 'TIKET_PERGI').etapeIndex).toBe(1)
    const penuh = pelaksana({ biaya: [biayaKosong('TIKET_PERGI'), biayaKosong('TIKET_PERGI')] })
    expect(biayaPerTujuan(penuh, 'TIKET_PERGI').etapeIndex).toBeNull()
  })
})

describe('batasHotelEtape', () => {
  it('null bila status belum dipilih', () => {
    expect(batasHotelEtape(etapeKosong(), null, sbm)).toBeNull()
  })
})
