import type { Blocker } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function DialogTinggalkanHalaman({ blocker }: { blocker: Blocker }) {
  const tertahan = blocker.state === 'blocked'
  return (
    <Dialog open={tertahan} onOpenChange={(buka) => !buka && tertahan && blocker.reset()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tinggalkan halaman ini?</DialogTitle>
          <DialogDescription>Ada perubahan yang belum disimpan. Jika Anda keluar sekarang, perubahan tersebut akan hilang.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => tertahan && blocker.reset()}>
            Tetap di sini
          </Button>
          <Button variant="destructive" onClick={() => tertahan && blocker.proceed()}>
            Keluar tanpa menyimpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DialogKunciSt({
  buka,
  onBukaChange,
  kunci,
  nomor,
  memproses,
  onKonfirmasi,
}: {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  /** true = tandai selesai (kunci); false = buka kunci. */
  kunci: boolean
  nomor: string
  memproses: boolean
  onKonfirmasi: () => void
}) {
  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kunci ? 'Tandai surat tugas selesai?' : 'Buka kunci surat tugas?'}</DialogTitle>
          <DialogDescription>
            {kunci
              ? `${nomor} akan dikunci: data, bukti, dan laporan tidak bisa diubah atau dihapus sampai kunci dibuka. Dokumen tetap bisa dilihat dan dicetak.`
              : `${nomor} akan bisa diubah lagi. Pembukaan kunci dicatat. Kunci ulang setelah revisi selesai.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onBukaChange(false)}>
            Batal
          </Button>
          <Button onClick={onKonfirmasi} disabled={memproses}>
            {memproses ? 'Memproses...' : kunci ? 'Tandai selesai' : 'Buka kunci'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
