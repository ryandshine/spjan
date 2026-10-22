import type { BiayaPayload, PegawaiDto, SumberDana, SuratTugasPayload, UsulanHotelItem } from '@spjan/shared'

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
    pelaksana: st.pelaksana.map((p, i) =>
      i !== pelaksanaIdx
        ? p
        : {
            ...p,
            etape: p.etape.map((e, j) =>
              j !== etapeIdx
                ? e
                : { ...e, hotelNama: usulan.ekstraksi.namaHotel, hotelTarif: usulan.tarifRiilPerMalam, malamOverride: usulan.malam },
            ),
          },
    ),
  }
}

export function tambahBiayaKePelaksana(st: SuratTugasPayload, pelaksanaIdx: number, biaya: BiayaPayload): SuratTugasPayload {
  return {
    ...st,
    pelaksana: st.pelaksana.map((p, i) => (i === pelaksanaIdx ? { ...p, biaya: [...p.biaya, biaya] } : p)),
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
