import { Loader2Icon, TriangleAlertIcon, CheckCircle2Icon, FileTextIcon, SaveIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type StatusSimpan =
  | { jenis: 'tersimpan'; waktu: string | null }
  | { jenis: 'kotor' }
  | { jenis: 'menyimpan' }
  | { jenis: 'gagal' }

/** Bar melekat: kemajuan penyusunan, status simpan, dan aksi utama Simpan & Lihat PDF. */
export function BarLaporan({
  wajibSiap,
  wajibTotal,
  status,
  kotor,
  menyimpan,
  melihat,
  onSimpan,
  onLihatPdf,
  onCobaLagi,
}: {
  wajibSiap: number
  wajibTotal: number
  status: StatusSimpan
  kotor: boolean
  menyimpan: boolean
  melihat: boolean
  onSimpan: () => void
  onLihatPdf: () => void
  onCobaLagi: () => void
}) {
  const lengkap = wajibTotal > 0 && wajibSiap === wajibTotal
  return (
    <div className="sticky top-0 z-20 -mx-5 mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background px-5 py-2.5 md:-mx-8 md:px-8">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Laporan Perjalanan Dinas</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" aria-live="polite">
          <span className={lengkap ? 'font-medium text-success' : ''}>
            {wajibTotal === 0 ? 'Tidak ada bagian wajib' : lengkap ? 'Semua bagian wajib siap' : `${wajibSiap} dari ${wajibTotal} bagian wajib siap`}
          </span>
          <span aria-hidden>·</span>
          {status.jenis === 'menyimpan' ? (
            <span className="inline-flex items-center gap-1">
              <Loader2Icon className="size-3 animate-spin" /> Menyimpan...
            </span>
          ) : status.jenis === 'gagal' ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlertIcon className="size-3" /> Gagal menyimpan
              <button type="button" className="font-medium underline" onClick={onCobaLagi}>
                Coba lagi
              </button>
            </span>
          ) : status.jenis === 'kotor' ? (
            <span className="inline-flex items-center gap-1 text-warning-foreground">
              <span className="size-2 rounded-full bg-warning" aria-hidden /> Belum disimpan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2Icon className="size-3 text-success" /> Tersimpan{status.waktu ? ` · ${status.waktu}` : ''}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="default"
          className="h-10 gap-1.5"
          disabled={!kotor || menyimpan}
          onClick={onSimpan}
        >
          {menyimpan ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />} Simpan
        </Button>
        <Button type="button" variant="outline" className="h-10 gap-1.5" disabled={melihat} onClick={onLihatPdf}>
          {melihat ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />} Lihat PDF
        </Button>
      </div>
    </div>
  )
}
