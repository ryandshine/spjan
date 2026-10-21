import { ArrowLeftIcon, ArrowRightIcon, SaveIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { LangkahItem } from '@/components/st/langkah-st'

/**
 * Tombol Kembali/Lanjut yang menempel di bawah layar supaya selalu terjangkau di halaman panjang.
 * Di ponsel (header tidak lengket) Simpan ikut di sini.
 */
export function NavigasiLangkah<K extends string>({
  sebelumnya,
  berikutnya,
  onPilih,
  tampilSimpan,
  menyimpan,
  simpanNonaktif,
  onSimpan,
}: {
  sebelumnya: LangkahItem<K> | undefined
  /** Kosong pada mode laporan: tombol Lanjut disembunyikan oleh pemanggil. */
  berikutnya: LangkahItem<K> | undefined
  onPilih: (kunci: K) => void
  tampilSimpan: boolean
  menyimpan: boolean
  simpanNonaktif: boolean
  onSimpan: () => void
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 -mb-6 flex items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur">
      {sebelumnya ? (
        <Button variant="outline" onClick={() => onPilih(sebelumnya.kunci)}>
          <ArrowLeftIcon /> Kembali
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {tampilSimpan ? (
          <Button className="gap-2 md:hidden" onClick={onSimpan} disabled={menyimpan || simpanNonaktif}>
            <SaveIcon /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </Button>
        ) : null}
        {berikutnya ? (
          <Button onClick={() => onPilih(berikutnya.kunci)}>
            Lanjut<span className="hidden sm:inline"> ke {berikutnya.label}</span> <ArrowRightIcon />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
