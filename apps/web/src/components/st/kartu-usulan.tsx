import type { ReactNode } from 'react'
import { CheckCircle2Icon, CheckIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import type { PelaksanaPayload, StatusUsulan } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

const BADGE_STATUS: Record<StatusUsulan, ReactNode> = {
  menunggu: <Badge variant="warning">Usulan Baru</Badge>,
  diterapkan: (
    <Badge variant="success">
      <CheckCircle2Icon className="mr-1 size-3" /> Diterapkan
    </Badge>
  ),
  diabaikan: <Badge variant="muted">Diabaikan</Badge>,
}

/** Badge status usulan; usulan yang sudah diproses mendapat tombol teks kecil untuk mengembalikannya ke antrean. */
export function StatusUsulanChip({ status, sedangProses, onReset }: { status: StatusUsulan; sedangProses: boolean; onReset: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {BADGE_STATUS[status]}
      {status === 'menunggu' ? null : (
        <Button variant="link" size="sm" className="h-auto gap-1 p-0 text-xs" disabled={sedangProses} onClick={onReset}>
          <RotateCcwIcon className="size-3" aria-hidden /> Reset
        </Button>
      )}
    </div>
  )
}

export function PilihanTerapkan({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

/**
 * Bagian "Terapkan ke" pada kartu usulan: dua kolom (pelaksana | pilihan lain seperti tujuan dan jenis biaya)
 * dengan tombol aksi di baris bawahnya, sehingga tidak patah walau teks pilihan panjang.
 */
export function FormTerapkan({
  pelaksanaList,
  pelaksana,
  onPilihPelaksana,
  sedangProses,
  onAbaikan,
  onTerapkan,
  children,
}: {
  pelaksanaList: PelaksanaPayload[]
  pelaksana: number
  onPilihPelaksana: (indeks: number) => void
  sedangProses: boolean
  onAbaikan: () => void
  onTerapkan: () => void
  children: ReactNode
}) {
  return (
    <div className="mt-3 grid gap-3 border-t pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <PilihanTerapkan label="Terapkan ke pelaksana">
          <Select className="w-full text-xs" value={pelaksana} onChange={(e) => onPilihPelaksana(Number(e.target.value))}>
            {pelaksanaList.map((p, idx) => (
              <option key={idx} value={idx}>
                {idx + 1}. {p.nama || '(Tanpa nama)'}
              </option>
            ))}
          </Select>
        </PilihanTerapkan>
        <div className="grid min-w-0 gap-3">{children}</div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={sedangProses} onClick={onAbaikan} className="text-xs text-muted-foreground hover:text-foreground">
          <XIcon className="mr-1 size-3.5" /> Abaikan
        </Button>
        <Button size="sm" disabled={sedangProses || pelaksanaList.length === 0} onClick={onTerapkan} className="text-xs">
          <CheckIcon className="mr-1 size-3.5" /> Terapkan ke Biaya
        </Button>
      </div>
    </div>
  )
}
