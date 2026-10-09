import type { BiayaPayload, PegawaiDto, PelaksanaHasil, SumberDana, SuratTugasPayload, UsulanHotelItem } from '@spjan/shared'

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

const NOMOR_URUT_SPD_AWAL = 401

export function sufiksNoSpd(tahun: number): string {
  return `/SPD/PPS/${tahun}`
}

/** Nomor SPD pertama yang sudah terisi pada daftar pelaksana, atau undefined bila belum ada. */
export function cariNoSpdTerisi(pelaksana: SuratTugasPayload['pelaksana']): string | undefined {
  return pelaksana.find((p) => p.noSpd?.trim())?.noSpd?.trim()
}

/** Membaca pola "401/SPD/PPS/2026" menjadi angka awal dan sufiks; sufiks bawaan dipakai bila bagian itu kosong. */
export function bacaPolaNoSpd(noSpd: string, sufiksBawaan: string): { angkaAwal: number; sufiks: string } {
  const cocok = /^(\d+)(.*)$/.exec(noSpd)
  if (!cocok) return { angkaAwal: NOMOR_URUT_SPD_AWAL, sufiks: sufiksBawaan }
  const [, digit = '', sisa = ''] = cocok
  return { angkaAwal: parseInt(digit, 10), sufiks: sisa || sufiksBawaan }
}

/** Mengubah isian "Nomor urut awal" menjadi bilangan bulat positif; null bila tidak valid. */
export function bacaNomorUrutAwal(isian: string): number | null {
  const angka = parseInt(isian.replace(/\D/g, ''), 10)
  return Number.isInteger(angka) && angka > 0 ? angka : null
}

/** Mengisi No. SPD berurutan untuk semua pelaksana; tanggal SPD yang kosong mengikuti tanggal surat tugas. */
export function isiNoSpdBerurutan(st: SuratTugasPayload, angkaAwal: number, sufiks: string): SuratTugasPayload {
  return {
    ...st,
    pelaksana: st.pelaksana.map((p, i) => ({
      ...p,
      noSpd: `${angkaAwal + i}${sufiks}`,
      tanggalSpd: p.tanggalSpd || st.tanggal || null,
    })),
  }
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
export function tabBergalat(peta: PetaGalat): { data: boolean; pelaksana: boolean } {
  const kunci = Object.keys(peta)
  return {
    data: kunci.some((k) => !k.startsWith('pelaksana.')),
    pelaksana: kunci.some((k) => k.startsWith('pelaksana.')),
  }
}

type TotalPelaksana = Pick<
  PelaksanaHasil,
  'totalTransport' | 'totalUangHarian' | 'totalRepresentasi' | 'totalPenginapan' | 'totalPengeluaranRiil'
>

/** Rincian biaya seluruh pelaksana untuk panel ringkasan; pengeluaran riil hanya muncul bila ada. */
export function rincianTotal(pelaksana: ReadonlyArray<TotalPelaksana>): Array<{ label: string; nilai: number }> {
  const jumlah = (ambil: (p: TotalPelaksana) => number) => pelaksana.reduce((n, p) => n + ambil(p), 0)
  const baris = [
    { label: 'Transport', nilai: jumlah((p) => p.totalTransport) },
    { label: 'Uang harian', nilai: jumlah((p) => p.totalUangHarian) },
    { label: 'Representasi', nilai: jumlah((p) => p.totalRepresentasi) },
    { label: 'Penginapan', nilai: jumlah((p) => p.totalPenginapan) },
  ]
  const riil = jumlah((p) => p.totalPengeluaranRiil)
  return riil > 0 ? [...baris, { label: 'Pengeluaran riil', nilai: riil }] : baris
}
