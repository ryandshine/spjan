import { useEffect, useSyncExternalStore } from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

// Keadaan zoom dipakai bersama: kontrol bisa tampil di dua tempat (bilah samping dan header ponsel) tanpa saling tidak sinkron.
let persenSekarang = bacaAwal()
const pendengar = new Set<() => void>()
function terapkan(persen: number) {
  persenSekarang = persen
  document.documentElement.style.fontSize = `${persen}%`
  try {
    window.localStorage.setItem(KUNCI, String(persen))
  } catch {
    // Abaikan: zoom tetap berlaku untuk sesi ini.
  }
  pendengar.forEach((f) => f())
}
const langganan = (f: () => void) => {
  pendengar.add(f)
  return () => void pendengar.delete(f)
}

/** Memperbesar/memperkecil seluruh tampilan aplikasi (semua ukuran berbasis rem ikut berubah); pilihan diingat di peramban. */
export function ZoomHalaman({ className }: { className?: string }) {
  const persen = useSyncExternalStore(langganan, () => persenSekarang)
  useEffect(() => {
    document.documentElement.style.fontSize = `${persenSekarang}%`
  }, [])
  const setPersen = (p: number | ((x: number) => number)) => terapkan(typeof p === 'function' ? p(persenSekarang) : p)

  const ubah = (selisih: number) => setPersen((p) => Math.min(MAKS, Math.max(MIN, p + selisih)))

  return (
    <div className={cn('flex items-stretch divide-x overflow-hidden rounded-md border bg-card', className)} role="group" aria-label="Zoom halaman">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-8 rounded-none" onClick={() => ubah(-LANGKAH)} disabled={persen <= MIN} aria-label="Perkecil tampilan">
        <MinusIcon className="size-3.5" />
      </Button>
      <button
        type="button"
        onClick={() => setPersen(100)}
        className="min-w-12 flex-1 px-1 text-center text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Kembalikan ke 100%"
        aria-label={`Zoom ${persen} persen, klik untuk mengembalikan ke 100 persen`}
      >
        {persen}%
      </button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-8 rounded-none" onClick={() => ubah(LANGKAH)} disabled={persen >= MAKS} aria-label="Perbesar tampilan">
        <PlusIcon className="size-3.5" />
      </Button>
    </div>
  )
}
