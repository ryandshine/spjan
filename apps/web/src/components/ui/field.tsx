import * as React from 'react'
import { TriangleAlertIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { PenandaOtomatis, TandaWajib, type ModeIsian } from '@/components/ui/penanda-isian'

/** Label + kontrol + pesan galat dalam satu blok. */
function Field({
  label,
  htmlFor,
  error,
  hint,
  warning,
  mode,
  otomatisAktif,
  onKembaliOtomatis,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  /** Peringatan (bukan galat): data belum lengkap tetapi masih boleh disimpan. */
  warning?: string
  /** Wajib memberi tanda bintang di label, otomatis memberi ikon di ujung kanan, opsional tanpa penanda. */
  mode?: ModeIsian
  /** Untuk mode otomatis: true bila nilai sekarang masih otomatis, false bila sudah diisi tangan. */
  otomatisAktif?: boolean
  onKembaliOtomatis?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col justify-start gap-1.5', className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {mode === 'wajib' ? <TandaWajib /> : null}
        </Label>
        {mode === 'otomatis' ? <PenandaOtomatis aktif={otomatisAktif} onKembali={onKembaliOtomatis} /> : null}
      </div>
      {children}
      {hint && !error ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {warning && !error ? (
        <p className="flex items-start gap-1 text-xs font-medium text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {warning}
        </p>
      ) : null}
    </div>
  )
}

export { Field }
