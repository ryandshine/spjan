import { toast } from 'sonner'
import type { BerkasDto } from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pesanGalat } from '@/lib/format'
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

  async function tanganiHapus() {
    if (!berkas) return
    try {
      await hapus.mutateAsync(berkas.id)
      toast.success(`Berkas "${berkas.namaAsli}" berhasil dihapus.`)
      onTerhapus?.(berkas)
      onTutup()
    } catch (err) {
      toast.error(`Gagal menghapus berkas: ${pesanGalat(err)}`)
    }
  }

  return (
    <Dialog open={berkas !== null} onOpenChange={(open) => !open && onTutup()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus berkas?</DialogTitle>
          <DialogDescription>
            Berkas &quot;{berkas?.namaAsli}&quot; dan hasil ekstraksi datanya akan dihapus permanen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button variant="destructive" onClick={() => void tanganiHapus()} disabled={hapus.isPending}>
            {hapus.isPending ? 'Menghapus...' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
