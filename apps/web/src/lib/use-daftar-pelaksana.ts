import { useState, type Dispatch, type SetStateAction } from 'react'
import { pelaksanaKosong, type PelaksanaPayload, type SuratTugasPayload } from '@spjan/shared'

import type { BagianPelaksana } from '@/lib/periksa'

/** Kunci stabil per kartu pelaksana agar state lokal kartu tidak bergeser ke kartu lain saat ada yang dihapus. */
let urutanKunciPelaksana = 0
const kunciPelaksanaBaru = () => `pelaksana-${(urutanKunciPelaksana += 1)}`

/**
 * Daftar pelaksana pada editor surat tugas: perubahan isi, tambah/hapus, kunci stabil per kartu,
 * serta pelaksana dan sub-tab yang sedang dibuka. `jumlah` = banyak pelaksana saat ini.
 */
export function useDaftarPelaksana(
  setSt: Dispatch<SetStateAction<SuratTugasPayload>>,
  awal: PelaksanaPayload[],
  jumlah: number,
) {
  const [kunci, setKunci] = useState(() => awal.map(kunciPelaksanaBaru))
  const [aktif, setAktif] = useState(0)
  const [bagian, setBagian] = useState<BagianPelaksana>('perjalanan')

  return {
    kunci,
    aktif,
    setAktif,
    bagian,
    setBagian,
    ubah: (i: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) =>
      setSt((s) => ({ ...s, pelaksana: s.pelaksana.map((p, j) => (j === i ? fn(p) : p)) })),
    tambah: () => {
      setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))
      setKunci((k) => [...k, kunciPelaksanaBaru()])
      setAktif(jumlah)
      setBagian('perjalanan')
    },
    hapus: (i: number) => {
      setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))
      setKunci((k) => k.filter((_, j) => j !== i))
      setAktif((a) => Math.max(0, i < a ? a - 1 : Math.min(a, jumlah - 2)))
    },
  }
}
