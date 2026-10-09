import { TriangleAlertIcon } from 'lucide-react'
import type { SpjHasil } from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { kumpulkanPeriksa, type PerbaikiIsian } from '@/lib/periksa'

const MAKS_TAMPIL = 4

/** Peringatan ringkas di atas form: daftar singkat isian yang belum lengkap dan tombol menuju isian pertama. */
export function BannerPeriksa({ hasil, onPerbaiki }: { hasil: SpjHasil; onPerbaiki: PerbaikiIsian }) {
  const periksa = kumpulkanPeriksa(hasil.pelaksana)
  const pertama = periksa[0]
  if (!pertama) return null
  const sisa = periksa.length - MAKS_TAMPIL

  return (
    <Alert variant="warning" className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlertIcon className="size-4 shrink-0" aria-hidden /> {periksa.length} isian perlu dilengkapi
          </p>
          <ul className="mt-1 grid gap-0.5 text-xs">
            {periksa.slice(0, MAKS_TAMPIL).map((item, i) => (
              <li key={i} className="[overflow-wrap:anywhere]">
                <span className="font-medium">{item.namaPelaksana}:</span> {item.pesan}
              </li>
            ))}
            {sisa > 0 ? <li>dan {sisa} lainnya</li> : null}
          </ul>
          <p className="mt-1 text-xs opacity-80">Dokumen tetap bisa dibuat, tetapi sebaiknya perbaiki dulu.</p>
        </div>
        <Button size="sm" onClick={() => onPerbaiki(pertama.sasaranId, pertama.nomorPelaksana)}>
          Lengkapi Sekarang
        </Button>
      </div>
    </Alert>
  )
}
