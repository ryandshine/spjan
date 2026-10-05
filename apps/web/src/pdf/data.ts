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

export const nipCetak = (nip: string): string => {
  if (!nip) return ''
  const s = nip.trim()
  return s.toUpperCase().startsWith('NIP') ? s : `NIP. ${s}`
}

/** Menyusun data siap cetak dari respons GET /api/surat-tugas/:id/hasil. */
export function siapkanDokumen(dto: HasilSuratTugasDto): DataDokumen {
  const { suratTugas: st, pengaturan: pengaturanGlobal, hasil } = dto
  const pertama = hasil.pelaksana[0]

  const tahunAnggaran = st.tahunAnggaran ?? pengaturanGlobal.tahunAnggaran
  const pjNama = st.pjNama || pengaturanGlobal.pjNama
  const pjNip = st.pjNip || pengaturanGlobal.pjNip
  const pjJabatan = st.pjJabatan || pengaturanGlobal.pjJabatan

  const pengaturan: PengaturanPayload = {
    ...pengaturanGlobal,
    tahunAnggaran,
    pjNama,
    pjNip,
    pjJabatan,
  }

  const tanggal = hasil.teksTanggalSpj || `${' '.repeat(14)}${tahunAnggaran}`

  const rawKode = (st.kodeAkun || pengaturanGlobal.kodeAkunDefault || '').trim()
  const sumber = st.sumberDana
  let kodeAkunFinal = rawKode
  if (sumber && rawKode) {
    if (/\((RM|PNBP)\)/i.test(kodeAkunFinal)) {
      kodeAkunFinal = kodeAkunFinal.replace(/\((RM|PNBP)\)/i, `(${sumber})`)
    } else if (/\b(RM|PNBP)\b/i.test(kodeAkunFinal)) {
      kodeAkunFinal = kodeAkunFinal.replace(/\b(RM|PNBP)\b/i, sumber)
    } else {
      kodeAkunFinal = `${kodeAkunFinal} (${sumber})`
    }
  }

  return {
    st,
    pengaturan,
    pelaksana: hasil.pelaksana,
    total: hasil.total,
    terbilang: hasil.terbilang,
    teksTanggalSt: hasil.teksTanggalSt,
    tempatTanggal: `${pengaturan.kotaKedudukan}, ${tanggal}`,
    kodeAkun: kodeAkunFinal,
    pembuatDaftar: {
      nama: pengaturan.pembuatDaftarNama || pertama?.nama || '',
      nip: pengaturan.pembuatDaftarNip || (pertama ? nipCetak(pertama.nip) : ''),
    },
  }
}
