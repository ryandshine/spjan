import { useEffect, useState } from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

const KUNCI = 'spjan.zoom'
const MIN = 70
const MAKS = 150
const LANGKAH = 10

function bacaAwal(): number {
  try {
    const n = Number(window.localStorage.getItem(KUNCI))
    if (Number.isFinite(n) && n >= MIN && n <= MAKS) return n
  } catch {
    // Penyimpanan peramban tidak tersedia: pakai 100%.
  }
  return 100
}

/** Memperbesar/memperkecil seluruh tampilan aplikasi (semua ukuran berbasis rem ikut berubah); pilihan diingat di peramban. */
export function ZoomHalaman() {
  const [persen, setPersen] = useState(bacaAwal)

  useEffect(() => {
    document.documentElement.style.fontSize = `${persen}%`
    try {
      window.localStorage.setItem(KUNCI, String(persen))
    } catch {
      // Abaikan: zoom tetap berlaku untuk sesi ini.
    }
  }, [persen])

  const ubah = (selisih: number) => setPersen((p) => Math.min(MAKS, Math.max(MIN, p + selisih)))

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Zoom halaman">
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => ubah(-LANGKAH)} disabled={persen <= MIN} aria-label="Perkecil tampilan">
        <MinusIcon className="size-3.5" />
      </Button>
      <button
        type="button"
        onClick={() => setPersen(100)}
        className="min-w-12 rounded px-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Kembalikan ke 100%"
        aria-label={`Zoom ${persen} persen, klik untuk mengembalikan ke 100 persen`}
      >
        {persen}%
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => ubah(LANGKAH)} disabled={persen >= MAKS} aria-label="Perbesar tampilan">
        <PlusIcon className="size-3.5" />
      </Button>
    </div>
  )
}
