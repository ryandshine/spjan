import { TriangleAlertIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface LangkahItem<K extends string> {
  kunci: K
  label: string
  /** Keterangan satu baris di bawah label. */
  deskripsi: string
  /** Angka kecil di kanan, mis. jumlah pelaksana. */
  jumlah?: number
  /** Ada isian bermasalah (titik merah). */
  galat?: boolean
  /** Ada isian yang perlu dilengkapi (segitiga kuning). */
  perlu?: boolean
}

/**
 * Navigasi langkah surat tugas: kolom di kiri pada layar lebar, baris yang bisa digulir pada layar sempit.
 * Memakai id yang sama dengan `TabPanel` (`{idAwal}-tab-{kunci}`) agar panel tetap terhubung ke tabnya.
 */
export function LangkahSt<K extends string>({
  item,
  aktif,
  onPilih,
  idAwal,
  label,
}: {
  item: LangkahItem<K>[]
  aktif: K
  onPilih: (kunci: K) => void
  idAwal: string
  label: string
}) {
  return (
    <nav className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 hidden px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">Tahap pengisian</p>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        className="flex gap-1 overflow-x-auto rounded-lg border bg-sidebar p-1 lg:flex-col lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0"
      >
        {item.map((t, i) => {
          const terpilih = t.kunci === aktif
          return (
            <button
              key={t.kunci}
              type="button"
              role="tab"
              id={`${idAwal}-tab-${t.kunci}`}
              aria-selected={terpilih}
              aria-controls={`${idAwal}-panel-${t.kunci}`}
              tabIndex={terpilih ? 0 : -1}
              onClick={() => onPilih(t.kunci)}
              onKeyDown={(e) => {
                const maju = e.key === 'ArrowDown' || e.key === 'ArrowRight'
                const mundur = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
                if (!maju && !mundur) return
                e.preventDefault()
                const berikut = item[(i + (maju ? 1 : item.length - 1)) % item.length]
                if (berikut) {
                  onPilih(berikut.kunci)
                  document.getElementById(`${idAwal}-tab-${berikut.kunci}`)?.focus()
                }
              }}
              className={cn(
                'flex shrink-0 items-start gap-2.5 rounded-md border-l-[3px] px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-full',
                terpilih ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                  terpilih ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm whitespace-nowrap lg:whitespace-normal', terpilih ? 'font-medium text-primary' : 'text-foreground')}>{t.label}</span>
                <span className="hidden text-xs text-muted-foreground lg:block">{t.deskripsi}</span>
              </span>
              {t.jumlah !== undefined ? (
                <span className="mt-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{t.jumlah}</span>
              ) : null}
              {t.perlu && !t.galat ? <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" role="img" aria-label="ada isian yang perlu dilengkapi" /> : null}
              {t.galat ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" role="img" aria-label="ada isian bermasalah" /> : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
