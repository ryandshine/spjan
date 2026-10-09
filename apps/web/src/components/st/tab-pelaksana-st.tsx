import { PlusIcon, SparklesIcon } from 'lucide-react'
import type { PegawaiDto, PelaksanaHasil, PelaksanaPayload, Sbm } from '@spjan/shared'

import { PelaksanaCard } from '@/components/st/pelaksana-card'
import { Button } from '@/components/ui/button'
import { cakupanGalat, type PetaGalat } from '@/lib/validasi'

/** Daftar kartu pelaksana beserta tombol tambah dan auto-isi No. SPD. `kunci` harus sejajar dengan `pelaksana`. */
export function TabPelaksanaSt({
  pelaksana,
  kunci,
  hasil,
  sbm,
  pegawai,
  provinsi,
  provinsiKedudukan,
  peta,
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
  onUbah: (indeks: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  onHapus: (indeks: number) => void
  onTambah: () => void
  onAutoIsiNoSpd: () => void
}) {
  return (
    <div className="grid gap-6">
      {pelaksana.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada pelaksana.
        </p>
      ) : null}
      {pelaksana.map((p, i) => (
        <PelaksanaCard
          key={kunci[i] ?? i}
          nomor={i + 1}
          p={p}
          hasil={hasil[i]}
          sbm={sbm}
          pegawai={pegawai}
          provinsi={provinsi}
          provinsiKedudukan={provinsiKedudukan}
          galat={cakupanGalat(peta, `pelaksana.${i}`)}
          onUbah={(fn) => onUbah(i, fn)}
          onHapus={() => onHapus(i)}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onTambah}>
          <PlusIcon /> Tambah pelaksana
        </Button>
        {pelaksana.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAutoIsiNoSpd}
            title="Isi nomor SPD secara otomatis dan berurutan untuk semua pelaksana"
          >
            <SparklesIcon className="mr-1 size-4 text-primary" /> Auto-isi No. SPD
          </Button>
        ) : null}
      </div>
    </div>
  )
}
