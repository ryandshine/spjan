import type { Ref } from 'react'
import { LockOpenIcon } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Pemberitahuan status surat tugas: hanya lihat, atau terkunci (dengan jalan pintas buka kunci). */
export function BannerStatusSt({
  bolehUbah,
  dikunci,
  pembuat,
  onBukaKunci,
}: {
  bolehUbah: boolean
  dikunci: boolean
  pembuat: string | null
  onBukaKunci: () => void
}) {
  if (!bolehUbah) {
    return (
      <Alert className="mb-5">
        Surat tugas ini dibuat oleh {pembuat ?? 'pengguna lain'}. Anda tercantum sebagai pelaksana, jadi bisa melihat serta mengunduh dokumen dan berkasnya; perubahan hanya oleh pembuat atau admin.
      </Alert>
    )
  }
  if (!dikunci) return null
  return (
    <Alert className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <span>Surat tugas ini sudah ditandai selesai dan terkunci, jadi data, bukti, dan laporan tidak bisa diubah. Dokumen tetap bisa dicetak.</span>
      <Button size="sm" variant="outline" onClick={onBukaKunci}>
        <LockOpenIcon /> Buka kunci
      </Button>
    </Alert>
  )
}

/** Daftar isian yang belum benar saat simpan gagal (juga ditandai merah di kolomnya). */
export function BannerGalatSimpan({ pesan, alertRef }: { pesan: string[]; alertRef: Ref<HTMLDivElement> }) {
  if (pesan.length === 0) return null
  return (
    <div ref={alertRef}>
      <Alert variant="destructive" className="mb-5">
        <p className="mb-1 font-medium">Belum bisa disimpan. Perbaiki {pesan.length} isian berikut (juga ditandai merah di kolomnya):</p>
        <ul className="list-inside list-disc">
          {pesan.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </Alert>
    </div>
  )
}
