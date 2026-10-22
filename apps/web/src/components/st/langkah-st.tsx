import type { ReactNode } from 'react'
import { TriangleAlertIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { RingkasanProgresSpj } from '@/lib/progres-spj'

export interface LangkahItem<K extends string> {
  kunci: K
  label: string
  /** Keterangan satu baris di bawah label. */
  deskripsi: string
  /** Angka kecil di kanan, mis. jumlah pelaksana. */
  jumlah?: number
  /** Jumlah isian yang perlu diperiksa/dilengkapi di tahap ini. */
  jumlahPerlu?: number
  /** Ada isian bermasalah (titik merah). */
  galat?: boolean
  /** Ada isian yang perlu dilengkapi (segitiga kuning). */
  perlu?: boolean
}

function IsiLangkah<K extends string>({ t, nomor, terpilih }: { t: LangkahItem<K>; nomor: number; terpilih: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
          terpilih ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {nomor}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', terpilih ? 'font-medium text-primary' : 'text-foreground')}>{t.label}</span>
        <span className="hidden text-xs text-muted-foreground md:block">{t.deskripsi}</span>
      </span>
      {t.jumlah !== undefined ? <span className="mt-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{t.jumlah}</span> : null}
      {t.jumlahPerlu && t.jumlahPerlu > 0 ? (
        <span
          className="mt-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-amber-700 dark:text-amber-400"
          title={`${t.jumlahPerlu} isian perlu diperiksa`}
        >
          {t.jumlahPerlu} isian
        </span>
      ) : t.perlu && !t.galat ? (
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" role="img" aria-label="ada isian yang perlu dilengkapi" />
      ) : null}
      {t.galat ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" role="img" aria-label="ada isian bermasalah" /> : null}
    </>
  )
}

/**
 * Langkah surat tugas dalam dua rupa:
 * - baris tab (default): dipasang di dalam halaman pada layar sempit, memakai id yang sama dengan `TabPanel` (`{idAwal}-tab-{kunci}`);
 * - `kolom`: menu di sidebar aplikasi, dengan `anak` (mis. daftar pelaksana) di bawah langkah yang sedang dibuka.
 */
export function LangkahSt<K extends string>({
  item,
  aktif,
  onPilih,
  idAwal,
  label,
  kolom = false,
  anak,
  progres,
}: {
  item: LangkahItem<K>[]
  aktif: K
  onPilih: (kunci: K) => void
  idAwal: string
  label: string
  kolom?: boolean
  anak?: Partial<Record<K, ReactNode>>
  progres?: RingkasanProgresSpj
}) {
  if (kolom) {
    return (
      <nav aria-label={label} className="border-t pt-3">
        {progres ? (
          <div className="mb-3 rounded-lg border bg-card p-3 shadow-xs">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Kelengkapan SPJ</span>
              <span
                className={cn(
                  'text-xs font-bold tabular-nums',
                  progres.persen === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary',
                )}
              >
                {progres.persen}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  progres.persen === 100
                    ? 'bg-emerald-600 dark:bg-emerald-500'
                    : progres.totalPeringatan > 0
                      ? 'bg-amber-500'
                      : 'bg-primary',
                )}
                style={{ width: `${progres.persen}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {progres.totalPeringatan > 0
                ? `${progres.totalPeringatan} isian perlu dilengkapi`
                : progres.persen === 100
                  ? 'Semua isian lengkap & valid'
                  : `${progres.totalValid} dari ${progres.totalWajib} isian lengkap`}
            </p>
          </div>
        ) : null}
        <p className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tahap pengisian</p>
        <ul className="grid gap-0.5">
          {item.map((t, i) => {
            const terpilih = t.kunci === aktif
            return (
              <li key={t.kunci}>
                <button
                  type="button"
                  onClick={() => onPilih(t.kunci)}
                  aria-current={terpilih ? 'step' : undefined}
                  className={cn(
                    'relative flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    terpilih ? 'bg-primary/10 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary' : 'hover:bg-accent',
                  )}
                >
                  <IsiLangkah t={t} nomor={i + 1} terpilih={terpilih} />
                </button>
                {terpilih ? anak?.[t.kunci] : null}
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  return (
    <div className="mb-4">
      {progres ? (
        <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs">
          <span className="text-muted-foreground">Kelengkapan SPJ:</span>
          <span className={cn('font-semibold tabular-nums', progres.persen === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary')}>
            {progres.persen}% {progres.totalPeringatan > 0 ? `(${progres.totalPeringatan} isian perlu diperiksa)` : '(Lengkap)'}
          </span>
        </div>
      ) : null}
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-lg border bg-sidebar p-1">
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
                const maju = e.key === 'ArrowRight'
                if (!maju && e.key !== 'ArrowLeft') return
                e.preventDefault()
                const berikut = item[(i + (maju ? 1 : item.length - 1)) % item.length]
                if (berikut) {
                  onPilih(berikut.kunci)
                  document.getElementById(`${idAwal}-tab-${berikut.kunci}`)?.focus()
                }
              }}
              className={cn(
                'flex shrink-0 items-start gap-2 rounded-md border-b-2 px-2.5 py-2 text-left whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                terpilih ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50',
              )}
            >
              <IsiLangkah t={t} nomor={i + 1} terpilih={terpilih} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
