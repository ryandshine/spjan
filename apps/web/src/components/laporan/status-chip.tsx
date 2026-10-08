import { AlertCircleIcon, CheckIcon, CircleDashedIcon, MinusIcon, PencilIcon } from 'lucide-react'
import type { KodeStatus } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'

const TAMPIL: Record<KodeStatus, { label: string; variant: 'default' | 'muted' | 'success' | 'warning'; ikon: typeof CheckIcon }> = {
  kosong: { label: 'Kosong', variant: 'warning', ikon: CircleDashedIcon },
  terisi: { label: 'Terisi', variant: 'success', ikon: CheckIcon },
  otomatis: { label: 'Otomatis', variant: 'default', ikon: CheckIcon },
  sendiri: { label: 'Ditulis sendiri', variant: 'muted', ikon: PencilIcon },
  lengkap: { label: 'Lengkap', variant: 'success', ikon: CheckIcon },
  perlu: { label: 'Perlu dilengkapi', variant: 'warning', ikon: AlertCircleIcon },
  'tanpa-data': { label: 'Belum ada data', variant: 'muted', ikon: MinusIcon },
}

/** Status bagian dengan ikon dan teks (tidak hanya warna). */
export function StatusChip({ status, detail }: { status: KodeStatus; detail?: string | null }) {
  const t = TAMPIL[status]
  const Ikon = t.ikon
  return (
    <Badge variant={t.variant} className="gap-1">
      <Ikon className="size-3" aria-hidden />
      {t.label}
      {detail && (status === 'perlu' || status === 'kosong') ? ` ${detail}` : ''}
    </Badge>
  )
}
