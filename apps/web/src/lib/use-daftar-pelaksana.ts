import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { pelaksanaKosong, type PelaksanaPayload, type SuratTugasPayload } from '@spjan/shared'

import type { BagianPelaksana } from '@/lib/periksa'
import { useParamUrl } from '@/lib/use-param-url'

const BAGIAN: BagianPelaksana[] = ['perjalanan', 'transport', 'penginapan', 'uang_harian']

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
  const { params, ubah } = useParamUrl()
  // Di alamat halaman ditulis mulai dari 1; nilai di luar rentang digeser ke pelaksana terdekat.
  const nomorUrl = Number(params.get('pelaksana'))
  const aktif = Math.max(0, Math.min(Number.isInteger(nomorUrl) && nomorUrl > 0 ? nomorUrl - 1 : 0, jumlah - 1))
  const bagianUrl = params.get('bagian') as BagianPelaksana | null
  const bagian: BagianPelaksana = bagianUrl && BAGIAN.includes(bagianUrl) ? bagianUrl : 'perjalanan'
  // Fungsi dibuat stabil (useCallback) agar komponen anak yang di-memo tidak ikut dirender ulang tanpa perlu.
  const setAktif = useCallback((i: number) => ubah({ pelaksana: i > 0 ? String(i + 1) : null }), [ubah])
  const setBagian = useCallback((b: BagianPelaksana) => ubah({ bagian: b === 'perjalanan' ? null : b }), [ubah])
  const ubahPelaksana = useCallback(
    (i: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) =>
      setSt((s) => ({ ...s, pelaksana: s.pelaksana.map((p, j) => (j === i ? fn(p) : p)) })),
    [setSt],
  )
  const tambah = useCallback(() => {
    setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))
    setKunci((k) => [...k, kunciPelaksanaBaru()])
    setAktif(jumlah)
    setBagian('perjalanan')
  }, [setSt, setAktif, setBagian, jumlah])
  const hapus = useCallback(
    (i: number) => {
      setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))
      setKunci((k) => k.filter((_, j) => j !== i))
      setAktif(Math.max(0, i < aktif ? aktif - 1 : Math.min(aktif, jumlah - 2)))
    },
    [setSt, setAktif, aktif, jumlah],
  )

  return { kunci, aktif, setAktif, bagian, setBagian, ubah: ubahPelaksana, tambah, hapus }
}
