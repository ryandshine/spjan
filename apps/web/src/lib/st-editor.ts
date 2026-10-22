import {
  etapeKosong,
  type BiayaPayload,
  type PegawaiDto,
  type SumberDana,
  type SuratTugasPayload,
  type UsulanHotelItem,
  type UsulanTransportItem,
} from '@spjan/shared'

import type { PetaGalat } from '@/lib/validasi'

/** Logic murni editor surat tugas: dipisahkan dari komponen agar bisa diuji tanpa DOM. */

const POLA_SUMBER_DANA_DALAM_KURUNG = /\((RM|PNBP)\)/i
const POLA_SUMBER_DANA = /\b(RM|PNBP)\b/i

/** Menyesuaikan penanda RM/PNBP pada kode akun dengan sumber dana yang dipilih; menambahkannya bila belum ada. */
export function sesuaikanKodeAkun(kodeAkun: string, sumberDana: SumberDana): string {
  if (POLA_SUMBER_DANA_DALAM_KURUNG.test(kodeAkun)) return kodeAkun.replace(POLA_SUMBER_DANA_DALAM_KURUNG, `(${sumberDana})`)
  if (POLA_SUMBER_DANA.test(kodeAkun)) return kodeAkun.replace(POLA_SUMBER_DANA, sumberDana)
  const bersih = kodeAkun.trim()
  return bersih ? `${bersih} (${sumberDana})` : kodeAkun
}

/** Menerapkan usulan hotel ke satu tujuan (etape) milik satu pelaksana. */
export function terapkanHotelKeEtape(
  st: SuratTugasPayload,
  pelaksanaIdx: number,
  etapeIdx: number,
  usulan: UsulanHotelItem,
): SuratTugasPayload {
  return {
    ...st,
    pelaksana: st.pelaksana.map((p, i) => {
      if (i !== pelaksanaIdx) return p
      if (p.etape.length === 0) {
        const base = etapeKosong()
        return {
          ...p,
          etape: [
            {
              ...base,
              kota: usulan.kota || '',
              provinsi: usulan.provinsi || '',
              hotelNama: usulan.ekstraksi.namaHotel,
              hotelTarif: usulan.tarifRiilPerMalam,
              malamOverride: usulan.malam,
            },
          ],
        }
      }
      return {
        ...p,
        etape: p.etape.map((e, j) =>
          j !== etapeIdx
            ? e
            : { ...e, hotelNama: usulan.ekstraksi.namaHotel, hotelTarif: usulan.tarifRiilPerMalam, malamOverride: usulan.malam },
        ),
      }
    }),
  }
}

export function tambahBiayaKePelaksana(st: SuratTugasPayload, pelaksanaIdx: number, biaya: BiayaPayload): SuratTugasPayload {
  return {
    ...st,
    pelaksana: st.pelaksana.map((p, i) => (i === pelaksanaIdx ? { ...p, biaya: [...p.biaya, biaya] } : p)),
  }
}

/** Memeriksa apakah biaya tiket sudah ada di daftar biaya pelaksana (mencegah duplikasi). */
export function sudahAdaBiayaTiket(biayaList: BiayaPayload[], u: UsulanTransportItem): boolean {
  return biayaList.some((b) => {
    if (b.keterangan && u.namaBerkas && b.keterangan.includes(u.namaBerkas)) return true
    if ('nomorTiket' in u.ekstraksi && u.ekstraksi.nomorTiket && b.keterangan && b.keterangan.includes(u.ekstraksi.nomorTiket)) return true
    if (b.uraian === u.uraianBiaya && b.tarif === u.tarifRiil) return true
    return false
  })
}

/**
 * Sinkronisasi otomatis dari usulan hasil OCR berkas (tiket & hotel) langsung ke Surat Tugas.
 * Mengisi biaya tiket dan hotel pada pelaksana yang namanya cocok, tanpa menduplikasi data yang sudah ada.
 */
export function sinkronkanSemuaUsulanOtomatis(
  st: SuratTugasPayload,
  usulanHotel: UsulanHotelItem[],
  usulanTransport: UsulanTransportItem[],
): {
  stBaru: SuratTugasPayload
  hotelBerkasIds: number[]
  transportBerkasIds: number[]
} {
  let pelaksanaBaru = [...st.pelaksana]
  const hotelBerkasIds: number[] = []
  const transportBerkasIds: number[] = []

  // 1. Terapkan usulan transport/tiket
  for (const t of usulanTransport) {
    if (t.usulanStatus !== 'menunggu') continue
    if (t.pelaksanaIndex < 0 || t.pelaksanaIndex >= pelaksanaBaru.length) continue

    const p = pelaksanaBaru[t.pelaksanaIndex]!
    transportBerkasIds.push(t.berkasId)

    if (!sudahAdaBiayaTiket(p.biaya, t)) {
      const biayaBaru: BiayaPayload = {
        jenis: t.jenisBiaya,
        uraian: t.uraianBiaya,
        qty: t.qty || 1,
        satuan: t.satuan || 'tiket',
        tarif: t.tarifRiil,
        keterangan: t.keterangan || t.namaBerkas,
        etapeIndex: t.etapeIndex >= 0 ? t.etapeIndex : null,
        provinsi: t.provinsi,
      }
      pelaksanaBaru = pelaksanaBaru.map((pel, idx) =>
        idx === t.pelaksanaIndex ? { ...pel, biaya: [...pel.biaya, biayaBaru] } : pel,
      )
    }
  }

  // 2. Terapkan usulan hotel
  for (const h of usulanHotel) {
    if (h.usulanStatus !== 'menunggu') continue
    if (h.pelaksanaIndex < 0 || h.pelaksanaIndex >= pelaksanaBaru.length) continue

    const p = pelaksanaBaru[h.pelaksanaIndex]!
    const etapeIdx = h.etapeIndex >= 0 ? h.etapeIndex : 0
    hotelBerkasIds.push(h.berkasId)

    // Jika belum ada etape atau hotelnya belum terisi
    if (p.etape.length === 0 || !p.etape[etapeIdx]?.hotelNama || !p.etape[etapeIdx]?.hotelTarif) {
      pelaksanaBaru = terapkanHotelKeEtape(
        { ...st, pelaksana: pelaksanaBaru },
        h.pelaksanaIndex,
        etapeIdx,
        h,
      ).pelaksana
    }
  }

  return {
    stBaru: { ...st, pelaksana: pelaksanaBaru },
    hotelBerkasIds,
    transportBerkasIds,
  }
}

type DataPejabat = Pick<SuratTugasPayload, 'pjNama' | 'pjNip' | 'pjJabatan'>

function nipDenganAwalan(nip: string | null | undefined): string {
  if (!nip) return ''
  return nip.toUpperCase().startsWith('NIP') ? nip : `NIP. ${nip}`
}

export function pejabatDariPegawai(pegawai: PegawaiDto): DataPejabat {
  return { pjNama: pegawai.nama, pjNip: nipDenganAwalan(pegawai.nip), pjJabatan: pegawai.jabatan || null }
}

/** Pegawai yang cocok dengan pejabat yang sedang terisi (berdasarkan nama atau NIP, dengan/tanpa awalan "NIP."). */
export function cariPegawaiPejabat(daftar: PegawaiDto[], st: DataPejabat): PegawaiDto | undefined {
  return daftar.find((g) => g.nama === st.pjNama || (!!st.pjNip && (g.nip === st.pjNip || `NIP. ${g.nip}` === st.pjNip)))
}

export function adaDataPejabat(st: DataPejabat): boolean {
  return !!(st.pjNama || st.pjNip || st.pjJabatan)
}

/** Tab yang memuat kolom bergalat: kolom pelaksana berawalan "pelaksana.", sisanya ada di tab data. */
export function tabBergalat(peta: PetaGalat): { data: boolean; bukti: boolean; pelaksana: boolean; laporan: boolean } {
  const kunci = Object.keys(peta)
  return {
    data: kunci.some((k) => !k.startsWith('pelaksana.')),
    bukti: false,
    pelaksana: kunci.some((k) => k.startsWith('pelaksana.')),
    laporan: false,
  }
}

export { rincianTotal } from '@spjan/shared'
