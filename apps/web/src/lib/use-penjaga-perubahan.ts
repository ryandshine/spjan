import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Mencegah kehilangan data yang belum disimpan: menahan navigasi di dalam aplikasi (`blocker`) dan
 * memunculkan peringatan peramban saat reload/tutup tab. Panggil `izinkanNavigasi` sebelum berpindah
 * halaman secara sengaja setelah simpan atau hapus.
 */
export function usePenjagaPerubahan(kotor: boolean) {
  const diizinkan = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => kotor && !diizinkan.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!kotor) return
    const cegah = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', cegah)
    return () => window.removeEventListener('beforeunload', cegah)
  }, [kotor])

  const izinkanNavigasi = useCallback(() => {
    diizinkan.current = true
  }, [])

  return { blocker, izinkanNavigasi }
}
