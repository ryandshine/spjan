import type { PegawaiDto, PelaksanaHasil, PelaksanaPayload, Sbm } from '@spjan/shared'

import { DaftarPelaksanaSt } from '@/components/st/daftar-pelaksana-st'
import { PelaksanaCard } from '@/components/st/pelaksana-card'
import type { BagianPelaksana } from '@/lib/periksa'
import { cakupanGalat, type PetaGalat } from '@/lib/validasi'

/**
 * Langkah Pelaksana: satu pelaksana terpilih ditampilkan penuh. Daftar pelaksananya ada di sidebar aplikasi;
 * pada layar sempit (tanpa sidebar) daftar itu tampil sebagai baris di atas kartu. `kunci` harus sejajar dengan `pelaksana`.
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
}) {
  const i = Math.min(aktif, pelaksana.length - 1)
  const p = pelaksana[i]

  return (
    <div>
      <div className="md:hidden">
        <DaftarPelaksanaSt
          baris
          pelaksana={pelaksana}
          kunci={kunci}
          hasil={hasil}
          peta={peta}
          terkunci={terkunci}
          aktif={aktif}
          onPilih={onPilih}
          onTambah={onTambah}
        />
      </div>
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
        <p className="hidden rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:block">
          Belum ada pelaksana. Tambahkan lewat daftar Pelaksana di menu samping.
        </p>
      )}
    </div>
  )
}
