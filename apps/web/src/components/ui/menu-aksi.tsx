import { useEffect, useRef, useState } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface ItemAksi {
  label: string
  ikon?: React.ReactNode
  onPilih: () => void
  bahaya?: boolean
  nonaktif?: boolean
}

/** Menu "⋯" untuk aksi jarang dipakai atau merusak, agar tidak sejajar dengan aksi utama. */
export function MenuAksi({ label, item }: { label: string; item: ItemAksi[] }) {
  const [buka, setBuka] = useState(false)
  const akar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent) => {
      if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setBuka(false)
    document.addEventListener('mousedown', luar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', luar)
      document.removeEventListener('keydown', esc)
    }
  }, [buka])

  return (
    <div ref={akar} className="relative">
      <Button type="button" variant="outline" size="icon" aria-label={label} aria-haspopup="menu" aria-expanded={buka} onClick={() => setBuka((b) => !b)}>
        <MoreHorizontalIcon className="size-4" />
      </Button>
      {buka ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-56 rounded-md border bg-card p-1 shadow-md">
          {item.map((x) => (
            <button
              key={x.label}
              type="button"
              role="menuitem"
              disabled={x.nonaktif}
              className={`flex min-h-10 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 ${x.bahaya ? 'text-destructive' : ''}`}
              onClick={() => {
                setBuka(false)
                x.onPilih()
              }}
            >
              {x.ikon}
              {x.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
