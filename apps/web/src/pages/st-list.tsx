import { useState } from 'react'
import { FileTextIcon, FileUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pesanGalat, rupiah, tanggalPendek, waktuPendek } from '@/lib/format'
import { useDaftarSuratTugas, useHapusSuratTugas } from '@/lib/queries'
import type { SuratTugasRingkasDto } from '@spjan/shared'

export default function SuratTugasListPage() {
  const daftar = useDaftarSuratTugas()
  const hapus = useHapusSuratTugas()
  const [target, setTarget] = useState<SuratTugasRingkasDto | null>(null)

  async function konfirmasiHapus() {
    if (!target) return
    try {
      await hapus.mutateAsync(target.id)
      toast.success('Surat tugas dihapus.')
      setTarget(null)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<SuratTugasRingkasDto>[] = [
    {
      judul: 'Nomor',
      teks: (b) => b.nomor,
      sel: (b) => (
        <Link to={`/st/${b.id}`} className="font-medium text-primary hover:underline">
          {b.nomor}
        </Link>
      ),
    },
    { judul: 'Tanggal', teks: (b) => tanggalPendek(b.tanggal), sel: (b) => tanggalPendek(b.tanggal) },
    { judul: 'Pelaksana', rataKanan: true, sel: (b) => b.jumlahPelaksana },
    { judul: 'Total', rataKanan: true, sel: (b) => (b.jumlahPelaksana > 0 ? rupiah(b.total) : <span className="text-muted-foreground">-</span>) },
    {
      judul: 'Status',
      sel: (b) =>
        b.jumlahPelaksana === 0 ? (
          <Badge variant="muted">Belum ada pelaksana</Badge>
        ) : b.jumlahPeringatan > 0 ? (
          <Badge variant="warning">{b.jumlahPeringatan} perlu diperiksa</Badge>
        ) : (
          <Badge variant="success">Siap cetak</Badge>
        ),
    },
    { judul: 'Diperbarui', sel: (b) => <span className="text-muted-foreground">{waktuPendek(b.updatedAt)}</span> },
    {
      judul: '',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Link to={`/st/${b.id}/dokumen`} className={buttonVariants({ variant: 'outline', size: 'sm' })} aria-label={`Dokumen ${b.nomor}`}>
            <FileTextIcon className="size-3.5" /> Dokumen
          </Link>
          <Button variant="ghost" size="icon" aria-label={`Hapus ${b.nomor}`} onClick={() => setTarget(b)}>
            <Trash2Icon className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Surat Tugas"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/st/buat-dari-st" className={buttonVariants({ variant: 'outline' })}>
              <FileUpIcon className="size-4" /> Buat dari ST
            </Link>
            <Link to="/st/baru" className={buttonVariants()}>
              <PlusIcon className="size-4" /> Surat tugas baru
            </Link>
          </div>
        }
      />
      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat...' : 'Belum ada surat tugas.'}
        />
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus surat tugas?</DialogTitle>
            <DialogDescription>
              {target?.nomor} beserta seluruh pelaksana, tujuan perjalanan, dan biayanya akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={konfirmasiHapus} disabled={hapus.isPending}>
              {hapus.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
