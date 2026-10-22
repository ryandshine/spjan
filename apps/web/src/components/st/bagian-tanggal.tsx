import type { ReactNode } from 'react'
import { CheckIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { labelTanggal } from '@/lib/tanggal-label'
import type { useTanggalTerpilih } from '@/lib/use-tanggal-terpilih'

const GAYA = {
  primer: {
    chipAda: 'bg-accent text-accent-foreground',
    tombolAktif: 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
    centang: '',
  },
  amber: {
    chipAda: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    tombolAktif:
      'border-amber-400 bg-amber-50 text-amber-900 shadow-sm hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
    centang: 'text-amber-600 dark:text-amber-400',
  },
  indigo: {
    chipAda: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
    tombolAktif:
      'border-indigo-400 bg-indigo-50 text-indigo-900 shadow-sm hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200',
    centang: 'text-indigo-600 dark:text-indigo-400',
  },
} as const

/**
 * Kotak centang pembuka + chip jumlah + deretan tombol tanggal. Isi tambahan (ringkasan, dasar aturan)
 * lewat `children`, tampil hanya saat bagian terbuka.
 */
export function BagianTanggal({
  judul,
  chip,
  petunjuk,
  gaya,
  akhiranTerpilih,
  listHari,
  tanggal,
  children,
}: {
  judul: ReactNode
  /** Teks chip jumlah ("2 dari 3 hari terpilih"). */
  chip: string
  petunjuk: string
  gaya: keyof typeof GAYA
  /** Teks kecil di tombol tanggal yang terpilih. */
  akhiranTerpilih?: string
  listHari: string[]
  tanggal: ReturnType<typeof useTanggalTerpilih>
  children?: ReactNode
}) {
  const g = GAYA[gaya]
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
          <input
            type="checkbox"
            checked={tanggal.buka}
            onChange={(e) => tanggal.ubahBuka(e.target.checked)}
            className="size-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="font-semibold text-foreground">{judul}</span>
        </label>
        {tanggal.buka ? (
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', tanggal.jumlah > 0 ? g.chipAda : 'bg-muted text-muted-foreground')}
            aria-live="polite"
          >
            {chip}
          </span>
        ) : null}
      </div>

      {tanggal.buka ? (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">{petunjuk}</p>
            <div className="flex items-center gap-3">
              <button type="button" className="text-xs text-primary hover:underline" onClick={tanggal.pilihSemua}>
                Pilih semua
              </button>
              <button type="button" className="text-xs text-primary hover:underline" onClick={tanggal.kosongkan}>
                Kosongkan
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {listHari.map((tgl) => {
              const dipilih = tanggal.aktif.includes(tgl)
              return (
                <button
                  key={tgl}
                  type="button"
                  aria-pressed={dipilih}
                  onClick={() => tanggal.ubahTanggal(tgl, !dipilih)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                    dipilih ? g.tombolAktif : 'border-input bg-card text-foreground hover:bg-accent',
                  )}
                >
                  {dipilih ? <CheckIcon className={cn('size-3.5 stroke-[3]', g.centang)} aria-hidden /> : null}
                  {labelTanggal(tgl)}
                  {dipilih && akhiranTerpilih ? <span className="ml-1 text-[10px] font-normal opacity-80">{akhiranTerpilih}</span> : null}
                </button>
              )
            })}
          </div>
          {children}
        </div>
      ) : null}
    </div>
  )
}
