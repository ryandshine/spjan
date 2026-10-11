import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface TabItem<K extends string> {
  kunci: K
  label: string
  /** Teks kecil di samping label, misalnya jumlah pelaksana. */
  jumlah?: number
  /** Menandai tab yang berisi isian bermasalah (titik merah). */
  galat?: boolean
  ikon?: ReactNode
}

/** Tab sederhana: konten setiap tab tetap dirender oleh pemanggil (disembunyikan, bukan dibuang) agar isian tidak hilang saat berpindah. */
export function Tabs<K extends string>({
  item,
  aktif,
  onPilih,
  idAwal,
  label,
  gaya = 'garis',
}: {
  item: TabItem<K>[]
  aktif: K
  onPilih: (kunci: K) => void
  idAwal: string
  label: string
  /** `garis` = tab bergaris bawah (bagian utama); `segmen` = pilihan kecil dalam kotak (sub-bagian di dalam satu langkah). */
  gaya?: 'garis' | 'segmen'
}) {
  const segmen = gaya === 'segmen'
  return (
    <div
      role="tablist"
      aria-label={label}
      className={segmen ? 'mb-4 flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-sidebar p-0.5' : 'mb-5 flex gap-1 overflow-x-auto border-b'}
    >
      {item.map((t) => {
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
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const i = item.findIndex((x) => x.kunci === aktif)
              const berikut = item[(i + (e.key === 'ArrowRight' ? 1 : item.length - 1)) % item.length]
              if (berikut) {
                onPilih(berikut.kunci)
                document.getElementById(`${idAwal}-tab-${berikut.kunci}`)?.focus()
              }
            }}
            className={cn(
              'flex shrink-0 items-center gap-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              segmen
                ? cn('rounded-md px-3 py-1.5', terpilih ? 'border bg-card text-primary shadow-xs' : 'border border-transparent text-muted-foreground hover:text-foreground')
                : cn('-mb-px border-b-2 px-4 py-2.5', terpilih ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'),
            )}
          >
            {t.ikon}
            {t.label}
            {t.jumlah !== undefined ? (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{t.jumlah}</span>
            ) : null}
            {t.galat ? (
              <span className="size-2 rounded-full bg-destructive" role="img" aria-label="ada isian bermasalah" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Pembungkus panel tab; `hidden` menjaga komponen anak tetap terpasang. */
export function TabPanel({ idAwal, kunci, aktif, children }: { idAwal: string; kunci: string; aktif: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idAwal}-panel-${kunci}`} aria-labelledby={`${idAwal}-tab-${kunci}`} hidden={!aktif} className="min-w-0">
      {children}
    </div>
  )
}
