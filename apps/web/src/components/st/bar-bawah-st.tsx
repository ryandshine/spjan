import { CheckCircle2Icon, FileTextIcon, SaveIcon, TriangleAlertIcon } from 'lucide-react'
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
      className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-xs font-medium text-warning-foreground transition-colors hover:bg-warning/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
  onPerbaiki,
}: {
  id: number | null
  hasil: SpjHasil
  kotor: boolean
  menyimpan: boolean
  onSimpan: () => void
  onPerbaiki: PerbaikiIsian
}) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  const pertama = periksa[0]
  const rincian = rincianTotal(hasil.pelaksana).filter((r) => r.nilai > 0 || RINCIAN_TETAP.has(r.label))

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-5 py-3 shadow-lg backdrop-blur md:left-60 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ChipValidasi jumlah={periksa.length} onKlik={() => pertama && onPerbaiki(pertama.sasaranId, pertama.nomorPelaksana)} />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-end gap-x-4 gap-y-1">
          <p className="hidden flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums lg:flex">
            {rincian.map((r, i) => (
              <span key={r.label}>
                {i > 0 ? <span aria-hidden>• </span> : null}
                {r.label}: {rupiah(r.nilai)}
              </span>
            ))}
          </p>
          <p className="text-lg font-bold text-primary tabular-nums" title={hasil.terbilang} aria-live="polite">
            <span className="mr-2 text-sm font-semibold text-foreground">Total SPTB</span>
            {rupiah(hasil.total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {id !== null ? (
            <Link
              to={`/st/${id}/dokumen`}
              className={buttonVariants({ variant: 'outline' })}
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
          <Button onClick={onSimpan} disabled={menyimpan || (!kotor && id !== null)}>
            <SaveIcon /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
