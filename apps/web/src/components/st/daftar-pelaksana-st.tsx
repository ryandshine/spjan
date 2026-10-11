import { PlusIcon, SparklesIcon } from 'lucide-react'
import type { PelaksanaHasil, PelaksanaPayload } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { rupiah } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cakupanGalat, type PetaGalat } from '@/lib/validasi'

/**
 * Daftar pelaksana untuk memilih satu pelaksana yang dibuka, plus tombol tambah dan auto-isi No. SPD.
 * `baris` = deretan yang bisa digulir mendatar (di dalam halaman); selain itu daftar menurun ringkas (di sidebar).
 */
export function DaftarPelaksanaSt({
  baris = false,
  pelaksana,
  kunci,
  hasil,
  peta,
  terkunci,
  aktif,
  onPilih,
  onTambah,
  onAutoIsiNoSpd,
}: {
  baris?: boolean
  pelaksana: PelaksanaPayload[]
  kunci: string[]
  hasil: PelaksanaHasil[]
  peta: PetaGalat
  terkunci: boolean
  aktif: number
  onPilih: (indeks: number) => void
  onTambah: () => void
  onAutoIsiNoSpd: () => void
}) {
  const i = Math.min(aktif, pelaksana.length - 1)
  return (
    <div className={cn('grid gap-1.5', baris ? 'mb-4' : 'mt-1 mb-1 ml-5 border-l pl-2.5')}>
      {pelaksana.length > 0 ? (
        <ul className={cn('gap-1.5', baris ? 'flex overflow-x-auto pb-1' : 'grid')}>
          {pelaksana.map((x, j) => {
            const terpilih = j === i
            const perlu = (hasil[j]?.peringatan.length ?? 0) > 0
            const bergalat = Object.keys(cakupanGalat(peta, `pelaksana.${j}`)).length > 0
            return (
              <li key={kunci[j] ?? j} className={baris ? 'shrink-0' : undefined}>
                <button
                  type="button"
                  onClick={() => onPilih(j)}
                  aria-current={terpilih ? 'true' : undefined}
                  className={cn(
                    'grid w-full gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    baris && 'w-52',
                    terpilih ? 'border-primary/40 bg-accent' : 'border-transparent hover:bg-accent/60',
                  )}
                >
                  <span className={cn('truncate text-sm font-medium', terpilih && 'text-primary')}>
                    {j + 1}. {x.nama || `Pelaksana ${j + 1}`}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{hasil[j] ? rupiah(hasil[j].total) : '-'}</span>
                    {bergalat ? <Badge variant="warning">Ada galat</Badge> : perlu ? <Badge variant="warning">Perlu diperiksa</Badge> : <Badge variant="success">Lengkap</Badge>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Belum ada pelaksana.</p>
      )}
      {terkunci ? null : (
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" onClick={onTambah}>
            <PlusIcon /> Tambah
          </Button>
          {pelaksana.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onAutoIsiNoSpd} title="Isi nomor SPD secara otomatis dan berurutan untuk semua pelaksana">
              <SparklesIcon className="mr-1 size-4 text-primary" /> Auto-isi No. SPD
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
