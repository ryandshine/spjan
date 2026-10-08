import { useEffect, useMemo } from 'react'
import {
  CameraIcon,
  ImageIcon,
  Loader2Icon,
  RotateCcwIcon,
  SparklesIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatUkuran } from '@/lib/format'
import { type HasilKompresi } from '@/lib/gambar'

export interface AmbilFotoDialogProps {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  hasilFoto: HasilKompresi | null
  sedangMemproses?: boolean
  sedangUnggah?: boolean
  onFotoUlang: () => void
  onKonfirmasiUnggah: (file: File) => Promise<void> | void
}

export function AmbilFotoDialog({
  buka,
  onBukaChange,
  hasilFoto,
  sedangMemproses = false,
  sedangUnggah = false,
  onFotoUlang,
  onKonfirmasiUnggah,
}: AmbilFotoDialogProps) {
  const file = hasilFoto?.file
  const previewUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const hematPersen =
    hasilFoto && hasilFoto.asliSize > hasilFoto.baruSize
      ? Math.round((1 - hasilFoto.baruSize / hasilFoto.asliSize) * 100)
      : 0

  return (
    <Dialog open={buka} onOpenChange={sedangUnggah ? undefined : onBukaChange}>
      <DialogContent className="max-w-2xl sm:max-w-xl max-h-[92vh] flex flex-col p-5 gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CameraIcon className="size-5 text-primary" />
            <span>Pratinjau Foto Bukti</span>
          </DialogTitle>
          <DialogDescription>
            Periksa ketajaman dan kelengkapan foto dokumen sebelum diproses oleh AI.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-1">
          {sedangMemproses ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
              <Loader2Icon className="size-8 animate-spin text-primary" />
              <span className="text-sm">Mengoptimalkan resolusi foto...</span>
            </div>
          ) : previewUrl && hasilFoto ? (
            <>
              {/* Bingkai Pratinjau Foto */}
              <div className="relative flex max-h-[50vh] min-h-[220px] w-full items-center justify-center overflow-hidden rounded-lg border bg-neutral-950/5 dark:bg-neutral-900/40">
                <img
                  src={previewUrl}
                  alt="Pratinjau foto bukti"
                  className="max-h-[50vh] w-auto max-w-full rounded-md object-contain shadow-sm"
                />
              </div>

              {/* Baris Informasi Foto */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground border">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ImageIcon className="size-3.5 text-sky-600" />
                  <span className="[overflow-wrap:anywhere]">
                    {hasilFoto.file.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasilFoto.lebar > 0 && (
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {hasilFoto.lebar} × {hasilFoto.tinggi} px
                    </Badge>
                  )}
                  <Badge variant="muted" className="text-[11px] font-mono">
                    {formatUkuran(hasilFoto.baruSize)}
                  </Badge>
                  {hematPersen > 0 && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Hemat {hematPersen}%
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Belum ada foto yang dipilih.
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sedangUnggah || sedangMemproses}
            onClick={onFotoUlang}
          >
            <RotateCcwIcon className="mr-1.5 size-4" /> Foto Ulang
          </Button>

          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sedangUnggah}
              onClick={() => onBukaChange(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={sedangUnggah || sedangMemproses || !hasilFoto}
              onClick={() => {
                if (hasilFoto) void onKonfirmasiUnggah(hasilFoto.file)
              }}
            >
              {sedangUnggah ? (
                <>
                  <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <SparklesIcon className="mr-1.5 size-4" />
                  Gunakan & Ekstraksi AI
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
