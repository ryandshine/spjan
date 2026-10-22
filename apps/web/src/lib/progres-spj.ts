import type { BerkasDto, SpjHasil, SuratTugasPayload } from '@spjan/shared'

export interface RingkasanTahap {
  wajib: number
  valid: number
  peringatan: number
}

export interface RingkasanProgresSpj {
  persen: number
  totalWajib: number
  totalValid: number
  totalPeringatan: number
  perTahap: {
    data: RingkasanTahap
    bukti: RingkasanTahap
    pelaksana: RingkasanTahap
    laporan: RingkasanTahap
  }
}

/**
 * Menghitung persentase kelengkapan SPJ berdasarkan field mandatory yang valid di seluruh 4 tahap.
 * Aturan mutlak: jika masih ada peringatan/validasi aktif di tahap mana pun, persentase tidak boleh 100%.
 */
export function hitungProgresSpj(
  st: SuratTugasPayload,
  hasil: SpjHasil,
  berkas: BerkasDto[] = [],
  laporanSiap = false,
): RingkasanProgresSpj {
  // 1. Tahap Data Surat Tugas (Identitas ST, MAK/Akun, Tahun Anggaran, Penandatangan)
  const dataWajib = 5
  let dataValid = 0
  if (st.nomor && st.nomor.trim()) dataValid++
  if (st.tanggal && st.tanggal.trim()) dataValid++
  if (st.kodeAkun && st.kodeAkun.trim()) dataValid++
  if (st.tahunAnggaran && st.tahunAnggaran >= 2000) dataValid++
  if (st.pjNama && st.pjNama.trim()) dataValid++
  const dataPeringatan = dataWajib - dataValid

  // 2. Tahap Bukti Pengeluaran & Lampiran
  const buktiWajib = 2
  let buktiValid = 0
  const berkasBiaya = berkas.filter((b) => b.jenis !== 'dokumentasi' && b.jenis !== 'laporan')
  if (berkasBiaya.length > 0) buktiValid++
  const adaGagal = berkasBiaya.some((b) => b.ekstraksi?.status === 'gagal')
  if (berkasBiaya.length > 0 && !adaGagal) buktiValid++
  const buktiPeringatan = berkasBiaya.length === 0 ? 1 : adaGagal ? 1 : 0

  // 3. Tahap Pelaksana & Rincian Biaya
  let pelaksanaWajib = 0
  let pelaksanaValid = 0
  let pelaksanaPeringatan = 0

  if (st.pelaksana.length === 0) {
    pelaksanaWajib = 5
    pelaksanaPeringatan = 1
  } else {
    for (let i = 0; i < st.pelaksana.length; i++) {
      const p = st.pelaksana[i]
      const h = hasil.pelaksana[i]
      if (!p) continue

      // Mandatory per pelaksana: nama, nip, status, noSpd, etape (provinsi, kota, berangkat, pulang, kegiatan), hotel, transport
      const perPelaksanaWajib = 10
      let perPelaksanaValid = 0

      if (p.nama && p.nama.trim()) perPelaksanaValid++
      if (p.nip && p.nip.trim()) perPelaksanaValid++
      if (p.status) perPelaksanaValid++
      if (p.noSpd && p.noSpd.trim()) perPelaksanaValid++

      if (p.etape.length > 0) {
        const e = p.etape[0]
        if (e?.provinsi) perPelaksanaValid++
        if (e?.kota) perPelaksanaValid++
        if (e?.berangkat) perPelaksanaValid++
        if (e?.pulang) perPelaksanaValid++
        if (e?.kegiatan && e.kegiatan.trim()) perPelaksanaValid++

        const perluHotel = (e?.malamOverride ?? 1) > 0 && !(e?.fullboardDates ?? []).length && !e?.hotel30Persen
        if (!perluHotel || (e?.hotelTarif && e.hotelTarif > 0)) perPelaksanaValid++
      }

      pelaksanaWajib += perPelaksanaWajib
      pelaksanaValid += perPelaksanaValid
      pelaksanaPeringatan += h?.peringatan.length ?? 0
    }
  }

  // 4. Tahap Laporan & Berkas Cetak
  const laporanWajib = 1
  const laporanValid = laporanSiap ? 1 : 0
  const laporanPeringatan = laporanSiap ? 0 : 0

  const totalWajib = dataWajib + buktiWajib + pelaksanaWajib + laporanWajib
  const totalValid = dataValid + buktiValid + pelaksanaValid + laporanValid
  const totalPeringatan = dataPeringatan + buktiPeringatan + pelaksanaPeringatan

  const persenMurni = Math.round((totalValid / totalWajib) * 100)
  // Aturan mutlak: jika masih ada peringatan aktif, persentase tidak boleh mencapai 100%
  const persen = totalPeringatan > 0 ? Math.min(persenMurni, 95) : persenMurni

  return {
    persen,
    totalWajib,
    totalValid,
    totalPeringatan,
    perTahap: {
      data: { wajib: dataWajib, valid: dataValid, peringatan: dataPeringatan },
      bukti: { wajib: buktiWajib, valid: buktiValid, peringatan: buktiPeringatan },
      pelaksana: { wajib: pelaksanaWajib, valid: pelaksanaValid, peringatan: pelaksanaPeringatan },
      laporan: { wajib: laporanWajib, valid: laporanValid, peringatan: laporanPeringatan },
    },
  }
}
