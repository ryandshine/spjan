import { PlusIcon, SparklesIcon } from 'lucide-react'
import type { PegawaiDto, PelaksanaHasil, PelaksanaPayload, Sbm } from '@spjan/shared'

import { PelaksanaCard } from '@/components/st/pelaksana-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { rupiah } from '@/lib/format'
import type { BagianPelaksana } from '@/lib/periksa'
import { cn } from '@/lib/utils'
import { cakupanGalat, type PetaGalat } from '@/lib/validasi'

/**
 * Langkah Pelaksana: daftar pelaksana (kolom di layar sangat lebar, baris di layar lain) dan satu pelaksana terpilih
 * ditampilkan penuh. `kunci` harus sejajar dengan `pelaksana`.
 */
export function TabPelaksanaSt({
  pelaksana,
  kunci,
  hasil,
  sbm,
  pegawai,
  provinsi,
  provinsiKedudukan,
  peta,
  terkunci,
  aktif,
  bagian,
  onPilih,
  onBagian,
  onUbah,
  onHapus,
  onTambah,
  onAutoIsiNoSpd,
}: {
  pelaksana: PelaksanaPayload[]
  kunci: string[]
  hasil: PelaksanaHasil[]
  sbm: Sbm
  pegawai: PegawaiDto[]
  provinsi: string[]
  provinsiKedudukan: string
  peta: PetaGalat
  terkunci: boolean
  /** Indeks pelaksana yang sedang dibuka. */
  aktif: number
  bagian: BagianPelaksana
  onPilih: (indeks: number) => void
  onBagian: (bagian: BagianPelaksana) => void
  onUbah: (indeks: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  onHapus: (indeks: number) => void
  onTambah: () => void
  onAutoIsiNoSpd: () => void
}) {
  const i = Math.min(aktif, pelaksana.length - 1)
  const p = pelaksana[i]

  return (
    <div className="grid items-start gap-4 2xl:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Daftar pelaksana" className="grid gap-2 2xl:sticky 2xl:top-24">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Pelaksana</h2>
          <div className="flex items-center gap-1">
            {pelaksana.length > 0 && !terkunci ? (
              <Button variant="ghost" size="sm" onClick={onAutoIsiNoSpd} title="Isi nomor SPD secara otomatis dan berurutan untuk semua pelaksana">
                <SparklesIcon className="mr-1 size-4 text-primary" /> Auto-isi No. SPD
              </Button>
            ) : null}
            {terkunci ? null : (
              <Button variant="outline" size="sm" onClick={onTambah}>
                <PlusIcon /> Tambah
              </Button>
            )}
          </div>
        </div>
        {pelaksana.length > 0 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1 2xl:flex-col 2xl:overflow-visible 2xl:pb-0">
            {pelaksana.map((x, j) => {
              const terpilih = j === i
              const perlu = (hasil[j]?.peringatan.length ?? 0) > 0
              const bergalat = Object.keys(cakupanGalat(peta, `pelaksana.${j}`)).length > 0
              return (
                <li key={kunci[j] ?? j} className="shrink-0 2xl:shrink">
                  <button
                    type="button"
                    onClick={() => onPilih(j)}
                    aria-current={terpilih ? 'true' : undefined}
                    className={cn(
                      'grid w-52 gap-1 rounded-lg border border-l-[3px] bg-card px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 2xl:w-full',
                      terpilih ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-accent/50',
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
        ) : null}
      </nav>

      {p ? (
        <PelaksanaCard
          key={kunci[i] ?? i}
          nomor={i + 1}
          bagian={bagian}
          onBagian={onBagian}
          p={p}
          hasil={hasil[i]}
          sbm={sbm}
          pegawai={pegawai}
          provinsi={provinsi}
          provinsiKedudukan={provinsiKedudukan}
          galat={cakupanGalat(peta, `pelaksana.${i}`)}
          terkunci={terkunci}
          onUbah={(fn) => onUbah(i, fn)}
          onHapus={() => onHapus(i)}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pelaksana.</p>
      )}
    </div>
  )
}
