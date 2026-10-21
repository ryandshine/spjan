import { useState } from 'react'
import type { EtapePayload } from '@spjan/shared'

type KolomTanggal = 'fullboardDates' | 'tanpaUangHarianDates'

/**
 * Daftar tanggal terpilih pada satu kolom etape (paket rapat / uang harian ditanggung pihak lain).
 * Bagian dibuka otomatis bila sudah ada tanggal tersimpan; pengguna bisa membuka/menutupnya sendiri.
 */
export function useTanggalTerpilih(
  etape: EtapePayload,
  kolom: KolomTanggal,
  listHari: string[],
  onUbah: (patch: Partial<EtapePayload>) => void,
) {
  const tersimpan = etape[kolom] ?? []
  const aktif = tersimpan.filter((t) => listHari.includes(t))
  const [bukaManual, setBukaManual] = useState<boolean | null>(null)
  const simpan = (tanggal: string[]) => onUbah({ [kolom]: tanggal } as Partial<EtapePayload>)

  return {
    aktif,
    jumlah: aktif.length,
    buka: bukaManual ?? tersimpan.length > 0,
    ubahTanggal: (tgl: string, dipilih: boolean) =>
      simpan([...new Set(dipilih ? [...tersimpan, tgl] : tersimpan.filter((t) => t !== tgl))].sort()),
    pilihSemua: () => simpan([...listHari].sort()),
    kosongkan: () => simpan([]),
    ubahBuka: (buka: boolean) => {
      setBukaManual(buka)
      if (!buka) simpan([])
    },
  }
}
