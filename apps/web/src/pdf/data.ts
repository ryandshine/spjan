import {
  formatAngka,
  tanggalIndonesia,
  type FotoDokumentasi,
  type HasilSuratTugasDto,
  type PelaksanaHasil,
  type PengaturanPayload,
  type SuratTugasDto,
} from '@spjan/shared'

export interface DataDokumen {
  st: SuratTugasDto
  pengaturan: PengaturanPayload
  pelaksana: PelaksanaHasil[]
  total: number
  terbilang: string
  teksTanggalSt: string
  /** Contoh: "Jakarta, 5 Oktober 2026" */
  tempatTanggal: string
  teksTanggalDokumen: string
  kodeAkun: string
  pembuatDaftar: { nama: string; nip: string }
  dokumentasi?: FotoDokumentasi[]
}

export const angka = (n: number): string => formatAngka(n)

export const nipCetak = (nip: string): string => {
  if (!nip) return ''
  const s = nip.trim()
  return s.toUpperCase().startsWith('NIP') ? s : `NIP. ${s}`
}

function tanggalKeIso(tgl?: string | Date | null): string {
  if (!tgl) return ''
  if (typeof tgl === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tgl)) return tgl
  const d = typeof tgl === 'string' ? new Date(tgl) : tgl
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Menyusun data siap cetak dari respons GET /api/surat-tugas/:id/hasil. */
export function siapkanDokumen(dto: HasilSuratTugasDto, dokumentasi?: FotoDokumentasi[]): DataDokumen {
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

  // Tanggal dokumen: prioritaskan tanggalSpj yang diisi, lalu tanggal pembuatan (createdAt), lalu hari ini
  const tanggalDibuat = st.createdAt ? tanggalIndonesia(tanggalKeIso(st.createdAt)) : ''
  const tanggalHariIni = tanggalIndonesia(tanggalKeIso(new Date()))
  const tanggal = hasil.teksTanggalSpj || tanggalDibuat || tanggalHariIni

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
    teksTanggalDokumen: tanggal,
    kodeAkun: kodeAkunFinal,
    pembuatDaftar: {
      nama: pengaturan.pembuatDaftarNama || pertama?.nama || '',
      nip: pengaturan.pembuatDaftarNip || (pertama ? nipCetak(pertama.nip) : ''),
    },
    dokumentasi,
  }
}
