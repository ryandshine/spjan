import { CheckCircle2Icon, FileTextIcon, LockIcon, LockOpenIcon, SaveIcon, TriangleAlertIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { SpjHasil } from '@spjan/shared'

import { Button, buttonVariants } from '@/components/ui/button'
import { rupiah } from '@/lib/format'
import { kumpulkanPeriksa, type PerbaikiIsian } from '@/lib/periksa'
import { rincianTotal } from '@/lib/st-editor'

/** Rincian yang selalu tampil walau nol; komponen lain (representasi, pengeluaran riil) hanya bila ada nilainya. */
const RINCIAN_TETAP = new Set(['Transport', 'Penginapan', 'Uang harian'])

function ChipValidasi({ jumlah, onKlik }: { jumlah: number; onKlik: () => void }) {
  if (jumlah === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
        <CheckCircle2Icon className="size-3.5" aria-hidden /> Isian lengkap
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onKlik}
      title="Klik untuk menuju isian yang perlu dilengkapi"
      className="inline-flex items-center gap-1.5 cursor-pointer rounded-full bg-amber-100/60 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100/80 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <TriangleAlertIcon className="size-3.5" aria-hidden /> {jumlah} isian belum lengkap
    </button>
  )
}

/**
 * Dock tetap di bawah layar: status validasi, rincian biaya, total SPTB, dan aksi simpan.
 * Ditaruh di kanan sidebar kiri (lebar 15rem) pada layar md ke atas.
 */
export function BarBawahSt({
  id,
  hasil,
  kotor,
  menyimpan,
  onSimpan,
  terkunci = false,
  bisaBukaKunci = false,
  bisaKunci = true,
  onPerbaiki,
  onKunci,
  onBukaKunci,
}: {
  id: number | null
  hasil: SpjHasil
  kotor: boolean
  menyimpan: boolean
  onSimpan: () => void
  terkunci?: boolean
  bisaBukaKunci?: boolean
  bisaKunci?: boolean
  onPerbaiki: PerbaikiIsian
  onKunci: () => void
  onBukaKunci: () => void
}) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  const pertama = periksa[0]
  const rincian = rincianTotal(hasil.pelaksana).filter((r) => r.nilai > 0 || RINCIAN_TETAP.has(r.label))

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-6 py-3.5 shadow-lg backdrop-blur-md md:left-60 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {terkunci ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            <LockIcon className="size-3.5" aria-hidden /> {bisaBukaKunci ? 'Terkunci (selesai)' : bisaKunci ? 'Terkunci (selesai)' : 'Hanya lihat'}
          </span>
        ) : (
          <ChipValidasi jumlah={periksa.length} onKlik={() => pertama && onPerbaiki(pertama.sasaranId, pertama.nomorPelaksana)} />
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <p className="hidden flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums lg:flex dark:text-slate-400">
            {rincian.map((r, i) => (
              <span key={r.label}>
                {i > 0 ? <span aria-hidden className="mr-2">•</span> : null}
                {r.label}: {rupiah(r.nilai)}
              </span>
            ))}
          </p>
          <p className="flex items-baseline gap-1.5" title={hasil.terbilang} aria-live="polite">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total SPTB: </span>
            <span className="font-mono text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{rupiah(hasil.total)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {id !== null ? (
            <Link
              to={`/st/${id}/dokumen`}
              className={buttonVariants({ variant: 'outline' }) + ' gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}
              aria-disabled={kotor}
              onClick={(e) => {
                if (!kotor) return
                e.preventDefault()
                toast.info('Simpan perubahan dulu sebelum membuka dokumen.')
              }}
            >
              <FileTextIcon className="size-4" /> Dokumen
            </Link>
          ) : null}
          {terkunci ? (
            bisaBukaKunci ? (
              <Button variant="outline" className="gap-2" onClick={onBukaKunci}>
                <LockOpenIcon /> Buka kunci
              </Button>
            ) : null
          ) : (
            <>
              {id !== null && !kotor ? (
                <Button variant="outline" className="gap-2" onClick={onKunci}>
                  <LockIcon /> Tandai selesai
                </Button>
              ) : null}
              <Button className="gap-2 rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white shadow-sm hover:bg-emerald-700" onClick={onSimpan} disabled={menyimpan || (!kotor && id !== null)}>
                <SaveIcon /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
