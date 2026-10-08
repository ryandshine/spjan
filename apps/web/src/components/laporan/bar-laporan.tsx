import { Loader2Icon, TriangleAlertIcon, CheckCircle2Icon, FileTextIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type StatusSimpan = { jenis: 'tersimpan'; waktu: string | null } | { jenis: 'menyimpan' } | { jenis: 'gagal' }

/** Bar melekat: kemajuan penyusunan, satu indikator simpan otomatis, dan aksi utama Lihat PDF. */
export function BarLaporan({
  wajibSiap,
  wajibTotal,
  status,
  melihat,
  onLihatPdf,
  onCobaLagi,
}: {
  wajibSiap: number
  wajibTotal: number
  status: StatusSimpan
  melihat: boolean
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
          ) : (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2Icon className="size-3 text-success" /> Tersimpan otomatis{status.waktu ? ` · ${status.waktu}` : ''}
            </span>
          )}
        </p>
      </div>
      <Button type="button" className="h-10" disabled={melihat} onClick={onLihatPdf}>
        {melihat ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />} Lihat PDF
      </Button>
    </div>
  )
}
