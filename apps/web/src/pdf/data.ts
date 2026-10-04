import { formatAngka, type HasilSuratTugasDto, type PelaksanaHasil, type PengaturanPayload, type SuratTugasDto } from '@spjan/shared'

export interface DataDokumen {
  st: SuratTugasDto
  pengaturan: PengaturanPayload
  pelaksana: PelaksanaHasil[]
  total: number
  terbilang: string
  teksTanggalSt: string
  /** "Jakarta, 21 September 2026" atau "Jakarta,          2026" bila tanggal SPJ belum diisi. */
  tempatTanggal: string
  kodeAkun: string
  pembuatDaftar: { nama: string; nip: string }
}

export const angka = (n: number): string => formatAngka(n)

export const nipCetak = (nip: string): string => (nip ? `NIP.${nip}` : '')

/** Menyusun data siap cetak dari respons GET /api/surat-tugas/:id/hasil. */
export function siapkanDokumen(dto: HasilSuratTugasDto): DataDokumen {
  const { suratTugas: st, pengaturan, hasil } = dto
  const pertama = hasil.pelaksana[0]
  const tanggal = hasil.teksTanggalSpj || `${' '.repeat(14)}${pengaturan.tahunAnggaran}`
  return {
    st,
    pengaturan,
    pelaksana: hasil.pelaksana,
    total: hasil.total,
    terbilang: hasil.terbilang,
    teksTanggalSt: hasil.teksTanggalSt,
    tempatTanggal: `${pengaturan.kotaKedudukan}, ${tanggal}`,
    kodeAkun: st.kodeAkun || pengaturan.kodeAkunDefault,
    pembuatDaftar: {
      nama: pengaturan.pembuatDaftarNama || pertama?.nama || '',
      nip: pengaturan.pembuatDaftarNip || (pertama ? nipCetak(pertama.nip) : ''),
    },
  }
}
