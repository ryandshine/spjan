import * as React from 'react'
import { TriangleAlertIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/** Label + kontrol + pesan galat dalam satu blok. */
function Field({
  label,
  htmlFor,
  error,
  hint,
  warning,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  /** Peringatan (bukan galat): data belum lengkap tetapi masih boleh disimpan. */
  warning?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col justify-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
