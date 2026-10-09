import { toast } from 'sonner'
import type { BerkasDto } from '@spjan/shared'

import { DialogKonfirmasiPassword } from '@/components/dialog-konfirmasi-password'
import { useHapusBerkas } from '@/lib/queries'

export function HapusBerkasDialog({
  berkas,
  onTutup,
  onTerhapus,
}: {
  berkas: BerkasDto | null
  onTutup: () => void
  onTerhapus?: (b: BerkasDto) => void
}) {
  const hapus = useHapusBerkas()

  return (
    <DialogKonfirmasiPassword
      buka={berkas !== null}
      onBukaChange={(b) => !b && onTutup()}
      judul="Hapus berkas?"
      deskripsi={`Berkas "${berkas?.namaAsli ?? ''}" dipindah ke tempat sampah. Admin masih bisa memulihkannya.`}
      labelAksi="Hapus"
      bahaya
      onKonfirmasi={async ({ password }) => {
        if (!berkas) return
        await hapus.mutateAsync({ id: berkas.id, password })
        toast.success(`Berkas "${berkas.namaAsli}" dipindah ke tempat sampah.`)
        onTerhapus?.(berkas)
      }}
    />
  )
}
