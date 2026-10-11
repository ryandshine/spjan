import { useSyncExternalStore } from 'react'

export type Tema = 'light' | 'dark'

const KUNCI = 'spjan.tema'

function bacaAwal(): Tema {
  try {
    if (window.localStorage.getItem(KUNCI) === 'dark') return 'dark'
  } catch {
    // Penyimpanan peramban tidak tersedia: pakai mode terang.
  }
  return 'light'
}

// Keadaan tema dipakai bersama oleh semua tombol dan Toaster. index.html memasang kelas lebih awal agar tidak berkedip.
let temaSekarang: Tema = bacaAwal()
const pendengar = new Set<() => void>()
const langganan = (f: () => void) => {
  pendengar.add(f)
  return () => void pendengar.delete(f)
}

function terapkan(tema: Tema) {
  temaSekarang = tema
  document.documentElement.classList.toggle('dark', tema === 'dark')
  try {
    window.localStorage.setItem(KUNCI, tema)
  } catch {
    // Abaikan: tema tetap berlaku untuk sesi ini.
  }
  pendengar.forEach((f) => f())
}

if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', temaSekarang === 'dark')

export function useTema(): [Tema, () => void] {
  const tema = useSyncExternalStore(langganan, () => temaSekarang)
  return [tema, () => terapkan(temaSekarang === 'dark' ? 'light' : 'dark')]
}
