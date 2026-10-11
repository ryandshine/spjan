import { CheckCircle2Icon, ChevronRightIcon, TriangleAlertIcon } from 'lucide-react'
import type { SpjHasil } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { rupiah } from '@/lib/format'
import { kumpulkanPeriksa, type PerbaikiIsian } from '@/lib/periksa'
import { rincianTotal } from '@/lib/st-editor'
import { cn } from '@/lib/utils'

const MAKS_TAMPIL = 4
/** Rincian yang selalu tampil walau nol; komponen lain (representasi, pengeluaran riil) hanya bila ada nilainya. */
const RINCIAN_TETAP = new Set(['Transport', 'Penginapan', 'Uang harian'])

export interface StatusSt {
  /** Status final dari server. */
  dikunci: boolean
  /** Admin atau pembuat; selain itu hanya boleh melihat. */
  bolehUbah: boolean
  /** Ada perubahan yang belum disimpan. */
  kotor: boolean
}

function teksStatus({ dikunci, bolehUbah, kotor }: StatusSt): { teks: string; warna: string } {
  if (!bolehUbah) return { teks: 'Hanya lihat', warna: 'bg-muted-foreground/40' }
  if (dikunci) return { teks: 'Selesai • terkunci', warna: 'bg-success' }
  if (kotor) return { teks: 'Ada perubahan belum disimpan', warna: 'bg-warning' }
  return { teks: 'Draft • belum dikunci', warna: 'bg-muted-foreground/40' }
}

/** Daftar isian yang perlu dilengkapi (tiap butir menuju isiannya), atau penanda bahwa isian sudah lengkap. */
function DaftarPerlu({ hasil, onPerbaiki }: { hasil: SpjHasil; onPerbaiki: PerbaikiIsian }) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  if (periksa.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2Icon className="size-4" aria-hidden /> Isian lengkap
      </p>
    )
  }
  const sisa = periksa.length - MAKS_TAMPIL
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-warning-foreground uppercase">
        <TriangleAlertIcon className="size-4 text-warning" aria-hidden /> Perlu dilengkapi ({periksa.length})
      </p>
      <ul className="grid gap-1.5">
        {periksa.slice(0, MAKS_TAMPIL).map((item, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPerbaiki(item.sasaranId, item.nomorPelaksana)}
              title="Menuju isian ini"
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-left text-xs text-warning-foreground transition-colors hover:bg-warning/20 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span className="font-medium">{item.namaPelaksana}:</span> {item.pesan}
              </span>
              <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {sisa > 0 ? <p className="mt-1.5 text-xs text-muted-foreground">dan {sisa} lainnya</p> : null}
    </div>
  )
}

/**
 * Panel ringkasan di kanan: total biaya, rincian per pelaksana dan per komponen, isian yang perlu dilengkapi, dan status.
 * Menggantikan bar bawah dan banner peringatan; tombol simpan/kunci ada di header halaman.
 */
export function RingkasanSt({ hasil, status, onPerbaiki, className }: { hasil: SpjHasil; status: StatusSt; onPerbaiki: PerbaikiIsian; className?: string }) {
  const rincian = rincianTotal(hasil.pelaksana).filter((r) => r.nilai > 0 || RINCIAN_TETAP.has(r.label))
  const st = teksStatus(status)

  return (
    <Card className={cn('flex flex-col gap-4 p-5', className)} aria-label="Ringkasan surat tugas" role="complementary">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Ringkasan</h2>
        <Badge variant="muted">{hasil.pelaksana.length} pelaksana</Badge>
      </div>

      <div className="rounded-md bg-primary p-3 text-primary-foreground dark:border dark:border-primary/50 dark:bg-primary/10 dark:text-foreground" title={hasil.terbilang} aria-live="polite">
        <p className="text-xs tracking-wide text-primary-foreground/80 uppercase dark:text-primary">Total SPTB</p>
        <p className="font-mono text-xl font-bold tracking-tight tabular-nums">{rupiah(hasil.total)}</p>
      </div>

      {hasil.pelaksana.length > 0 ? (
        <section aria-label="Rincian per pelaksana" className="border-t pt-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rincian pelaksana</h3>
          <ul className="grid gap-2">
            {hasil.pelaksana.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {i + 1}. {p.nama || `Pelaksana ${i + 1}`}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{rupiah(p.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Rincian per komponen" className="border-t pt-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Per komponen</h3>
        <ul className="grid gap-1 text-xs text-muted-foreground tabular-nums">
          {rincian.map((r) => (
            <li key={r.label} className="flex justify-between gap-2">
              <span>{r.label}</span>
              <span>{rupiah(r.nilai)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="border-t pt-4">
        <DaftarPerlu hasil={hasil} onPerbaiki={onPerbaiki} />
      </div>

      <p className="mt-auto flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className={cn('size-2 rounded-full', st.warna)} aria-hidden /> {st.teks}
      </p>
    </Card>
  )
}

/** Versi ringkas untuk layar yang belum cukup lebar bagi panel kanan: total dan jumlah isian yang perlu dilengkapi dalam satu baris. */
export function RingkasanRingkas({ hasil, onPerbaiki }: { hasil: SpjHasil; onPerbaiki: PerbaikiIsian }) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  const pertama = periksa[0]
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3" role="complementary" aria-label="Ringkasan surat tugas">
      <p className="flex items-baseline gap-2" title={hasil.terbilang} aria-live="polite">
        <span className="text-sm text-muted-foreground">Total SPTB</span>
        <span className="font-mono text-lg font-bold text-primary tabular-nums">{rupiah(hasil.total)}</span>
      </p>
      {pertama ? (
        <button
          type="button"
          onClick={() => onPerbaiki(pertama.sasaranId, pertama.nomorPelaksana)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning-foreground transition-colors hover:bg-warning/25 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <TriangleAlertIcon className="size-3.5" aria-hidden /> {periksa.length} isian perlu dilengkapi
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <CheckCircle2Icon className="size-3.5" aria-hidden /> Isian lengkap
        </span>
      )}
    </div>
  )
}
