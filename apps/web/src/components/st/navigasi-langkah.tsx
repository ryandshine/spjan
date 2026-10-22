import { ArrowLeftIcon, ArrowRightIcon, SaveIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface NavigasiAksi {
  label: string
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary'
}

/**
 * Tombol Kembali/Lanjut yang menempel di bawah layar supaya selalu terjangkau di halaman panjang.
 * Bergerak secara linier antar-tahap dan antar sub-tab pelaksana.
 * Di ponsel (header tidak lengket) Simpan ikut di sini.
 */
export function NavigasiLangkah({
  sebelumnya,
  berikutnya,
  ekstraBerikutnya,
  tampilSimpan,
  menyimpan,
  simpanNonaktif,
  onSimpan,
}: {
  sebelumnya?: NavigasiAksi | null
  berikutnya?: NavigasiAksi | null
  ekstraBerikutnya?: NavigasiAksi | null
  tampilSimpan: boolean
  menyimpan: boolean
  simpanNonaktif: boolean
  onSimpan: () => void
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 -mb-6 flex items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur">
      {sebelumnya ? (
        <Button variant="outline" onClick={sebelumnya.onClick} className="gap-1.5">
          <ArrowLeftIcon className="size-4" />
          <span>{sebelumnya.label}</span>
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {tampilSimpan ? (
          <Button className="gap-2 md:hidden" onClick={onSimpan} disabled={menyimpan || simpanNonaktif}>
            <SaveIcon className="size-4" /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </Button>
        ) : null}
        {ekstraBerikutnya ? (
          <Button variant={ekstraBerikutnya.variant ?? 'outline'} onClick={ekstraBerikutnya.onClick} className="gap-1.5">
            <span>{ekstraBerikutnya.label}</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : null}
        {berikutnya ? (
          <Button variant={berikutnya.variant ?? 'default'} onClick={berikutnya.onClick} className="gap-1.5">
            <span>{berikutnya.label}</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
