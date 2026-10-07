import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** `lengket` menempelkan header (judul + tombol aksi) di atas layar saat halaman panjang digulir. */
export function PageHeader({
  title,
  description,
  actions,
  lengket = false,
}: {
  title: string
  description?: string
  actions?: ReactNode
  lengket?: boolean
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-start justify-between gap-3',
        // Hanya lengket di layar lebar: di ponsel header setinggi ~20% layar akan terlalu memakan ruang.
        lengket && 'md:sticky md:top-0 md:z-20 md:-mx-8 md:-mt-6 md:mb-5 md:border-b md:bg-background md:px-8 md:py-3',
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
