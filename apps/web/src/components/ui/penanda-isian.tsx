import { SparklesIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

/** Wajib = harus diisi pengguna; otomatis = terisi sendiri dari data lain; opsional = boleh dikosongkan. */
export type ModeIsian = 'wajib' | 'otomatis' | 'opsional'

/** Penanda kecil di samping label isian. Mode otomatis yang sudah diubah tangan menampilkan tombol untuk kembali ke otomatis. */
export function PenandaIsian({ mode, otomatisAktif = true, onKembali }: { mode: ModeIsian; otomatisAktif?: boolean; onKembali?: () => void }) {
  if (mode === 'wajib') return <span className="text-xs font-semibold text-destructive">Wajib diisi</span>
  if (mode === 'opsional') return <span className="text-xs text-muted-foreground">Opsional</span>
  if (otomatisAktif) {
    return (
      <Badge variant="default" className="gap-1">
        <SparklesIcon className="size-3" aria-hidden /> Otomatis
      </Badge>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="muted">Diisi manual</Badge>
      {onKembali ? (
        <button type="button" className="text-xs font-medium text-primary underline underline-offset-2" onClick={onKembali}>
          Kembali ke otomatis
        </button>
      ) : null}
    </span>
  )
}

/** Penjelasan sekali di atas formulir, satu baris tanpa kotak. */
export function LegendaIsian() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
      <span>
        <PenandaIsian mode="wajib" /> harus Anda isi
      </span>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <PenandaIsian mode="otomatis" /> terisi sendiri dari data lain; ubah hanya bila perlu
      </span>
      <span>
        <PenandaIsian mode="opsional" /> boleh dikosongkan
      </span>
    </p>
  )
}
