import { useState } from 'react'
import type { EtapePayload } from '@spjan/shared'

type KolomTanggal = 'fullboardDates' | 'tanpaUangHarianDates' | 'uangHarian60Dates' | 'hotel30Dates'

/**
 * Daftar tanggal terpilih pada satu kolom etape (paket rapat / uang harian ditanggung pihak lain / 30% penginapan).
 * Bagian dibuka otomatis bila sudah ada tanggal tersimpan; pengguna bisa membuka/menutupnya sendiri.
 */
export function useTanggalTerpilih(
  etape: EtapePayload,
  kolom: KolomTanggal,
  listHari: string[],
  onUbah: (patch: Partial<EtapePayload>) => void,
) {
  const tersimpan = etape[kolom] ?? []
  const awal = kolom === 'hotel30Dates' && etape.hotel30Persen && tersimpan.length === 0 ? listHari : tersimpan
  const aktif = awal.filter((t) => listHari.includes(t))
  const [bukaManual, setBukaManual] = useState<boolean | null>(null)
  const simpan = (tanggal: string[]) => onUbah({ [kolom]: tanggal } as Partial<EtapePayload>)

  return {
    aktif,
    jumlah: aktif.length,
    buka: bukaManual ?? (awal.length > 0 || (kolom === 'hotel30Dates' && !!etape.hotel30Persen)),
    ubahTanggal: (tgl: string, dipilih: boolean) =>
      simpan([...new Set(dipilih ? [...aktif, tgl] : aktif.filter((t) => t !== tgl))].sort()),
    pilihSemua: () => simpan([...listHari].sort()),
    kosongkan: () => simpan([]),
    ubahBuka: (buka: boolean) => {
      setBukaManual(buka)
      if (!buka) simpan([])
      else if (aktif.length === 0 && listHari.length > 0) simpan([...listHari].sort())
    },
  }
}
