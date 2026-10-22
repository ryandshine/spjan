import { useState } from 'react'
import { CheckCircle2Icon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react'
import type { SpjHasil } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { rupiah } from '@/lib/format'
import { kumpulkanPeriksa, type ItemPeriksa, type PerbaikiIsian } from '@/lib/periksa'
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

/** Dialog modal yang menampilkan seluruh daftar isian yang perlu dilengkapi */
function DialogPerluDilengkapi({
  buka,
  onTutup,
  periksa,
  onPerbaiki,
}: {
  buka: boolean
  onTutup: () => void
  periksa: ItemPeriksa[]
  onPerbaiki: PerbaikiIsian
}) {
  const [cari, setCari] = useState('')

  const difilter = cari.trim()
    ? periksa.filter(
        (p) =>
          p.namaPelaksana.toLowerCase().includes(cari.toLowerCase()) ||
          p.pesan.toLowerCase().includes(cari.toLowerCase()),
      )
    : periksa

  return (
    <Dialog open={buka} onOpenChange={(open) => !open && onTutup()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TriangleAlertIcon className="size-4 text-warning" aria-hidden />
            Isian Perlu Dilengkapi ({periksa.length})
          </DialogTitle>
          <DialogDescription>
            Pilih salah satu butir untuk langsung menuju formulir isian yang bersangkutan.
          </DialogDescription>
        </DialogHeader>

        {periksa.length > 5 ? (
          <div className="relative my-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari pelaksana atau keterangan isian..."
              className="pl-8 text-xs sm:text-sm"
              autoFocus
            />
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {difilter.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Tidak ada isian yang cocok dengan pencarian.</p>
          ) : (
            <ul className="grid gap-1.5">
              {difilter.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onPerbaiki(item.sasaranId, item.nomorPelaksana)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-left text-xs text-warning-foreground transition-colors hover:border-warning/60 hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span className="font-semibold text-foreground">{item.namaPelaksana}:</span> {item.pesan}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Daftar isian yang perlu dilengkapi (tiap butir menuju isiannya), atau penanda bahwa isian sudah lengkap. */
function DaftarPerlu({ hasil, onPerbaiki }: { hasil: SpjHasil; onPerbaiki: PerbaikiIsian }) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  const [tampilkanSemua, setTampilkanSemua] = useState(false)
  const [bukaDialog, setBukaDialog] = useState(false)
  const [cari, setCari] = useState('')

  if (periksa.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2Icon className="size-4" aria-hidden /> Isian lengkap
      </p>
    )
  }

  const sisa = periksa.length - MAKS_TAMPIL
  const difilter = cari.trim()
    ? periksa.filter(
        (p) =>
          p.namaPelaksana.toLowerCase().includes(cari.toLowerCase()) ||
          p.pesan.toLowerCase().includes(cari.toLowerCase()),
      )
    : periksa

  const itemDitampilkan = tampilkanSemua ? difilter : periksa.slice(0, MAKS_TAMPIL)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-warning-foreground uppercase">
          <TriangleAlertIcon className="size-4 text-warning" aria-hidden /> Perlu dilengkapi ({periksa.length})
        </p>
        {periksa.length > MAKS_TAMPIL ? (
          <button
            type="button"
            onClick={() => setBukaDialog(true)}
            title="Buka dialog daftar lengkap"
            className="cursor-pointer text-[11px] font-medium text-warning hover:underline"
          >
            Buka pop-up
          </button>
        ) : null}
      </div>

      {tampilkanSemua && periksa.length > 5 ? (
        <div className="relative mb-2">
          <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari pelaksana atau isian..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      ) : null}

      <ul className={cn('grid gap-1.5', tampilkanSemua && 'max-h-80 overflow-y-auto pr-1')}>
        {itemDitampilkan.map((item, i) => (
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

      {sisa > 0 && !tampilkanSemua ? (
        <button
          type="button"
          onClick={() => setTampilkanSemua(true)}
          className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-xs font-medium text-warning-foreground transition-colors hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span>Lihat {sisa} lainnya (more)</span>
          <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
        </button>
      ) : null}

      {tampilkanSemua ? (
        <button
          type="button"
          onClick={() => {
            setTampilkanSemua(false)
            setCari('')
          }}
          className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span>Tampilkan lebih sedikit</span>
          <ChevronUpIcon className="size-3.5 shrink-0" aria-hidden />
        </button>
      ) : null}

      <DialogPerluDilengkapi
        buka={bukaDialog}
        onTutup={() => setBukaDialog(false)}
        periksa={periksa}
        onPerbaiki={(sasaranId, nomorPelaksana) => {
          setBukaDialog(false)
          onPerbaiki(sasaranId, nomorPelaksana)
        }}
      />
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
export function RingkasanRingkas({
  hasil,
  onPerbaiki,
  jumlahPerlu,
  labelPerlu,
}: {
  hasil: SpjHasil
  onPerbaiki: PerbaikiIsian
  jumlahPerlu?: number
  labelPerlu?: string
}) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  const pertama = periksa[0]
  const count = jumlahPerlu !== undefined ? jumlahPerlu : periksa.length
  const [bukaDialog, setBukaDialog] = useState(false)

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3" role="complementary" aria-label="Ringkasan surat tugas">
      <p className="flex items-baseline gap-2" title={hasil.terbilang} aria-live="polite">
        <span className="text-sm text-muted-foreground">Total SPTB</span>
        <span className="font-mono text-lg font-bold text-primary tabular-nums">{rupiah(hasil.total)}</span>
      </p>
      {count > 0 && pertama ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (periksa.length > 1) {
                setBukaDialog(true)
              } else {
                onPerbaiki(pertama.sasaranId, pertama.nomorPelaksana)
              }
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning-foreground transition-colors hover:bg-warning/25 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <TriangleAlertIcon className="size-3.5" aria-hidden /> {count} {labelPerlu ?? 'isian perlu diperiksa'}
          </button>
          <DialogPerluDilengkapi
            buka={bukaDialog}
            onTutup={() => setBukaDialog(false)}
            periksa={periksa}
            onPerbaiki={(sasaranId, nomorPelaksana) => {
              setBukaDialog(false)
              onPerbaiki(sasaranId, nomorPelaksana)
            }}
          />
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <CheckCircle2Icon className="size-3.5" aria-hidden /> Isian lengkap
        </span>
      )}
    </div>
  )
}
