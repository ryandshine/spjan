import { JENIS_BERKAS_LABEL, type JenisBerkas } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'

const WARNA_JENIS: Record<JenisBerkas, string> = {
  st: 'bg-slate-200 text-slate-700',
  tiket: 'bg-sky-100 text-sky-700',
  hotel: 'bg-violet-100 text-violet-700',
  transport: 'bg-amber-100 text-amber-800',
  belum: 'bg-muted text-muted-foreground',
  lainnya: 'bg-muted text-muted-foreground',
  dokumentasi: 'bg-muted text-muted-foreground',
  laporan: 'bg-muted text-muted-foreground',
}

/** Chip berwarna agar jenis berkas mudah dibedakan sekilas di tabel bukti. */
export function ChipJenisBerkas({ jenis }: { jenis: JenisBerkas }) {
  return (
    <Badge variant="muted" className={`font-normal ${WARNA_JENIS[jenis]}`}>
      {JENIS_BERKAS_LABEL[jenis]}
    </Badge>
  )
}
