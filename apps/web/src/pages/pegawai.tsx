import { useState } from 'react'
import { PencilIcon, PlusIcon, RotateCcwIcon, UserXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { STATUS_LABEL, type PegawaiDto } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { FormPegawai } from '@/components/pegawai-form'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pesanGalat } from '@/lib/format'
import { usePegawai, usePegawaiMutations } from '@/lib/queries'

export default function PegawaiPage() {
  const [tampilNonaktif, setTampilNonaktif] = useState(false)
  const daftar = usePegawai(!tampilNonaktif)
  const { ubah, nonaktifkan } = usePegawaiMutations()
  const [dialog, setDialog] = useState<{ pegawai: PegawaiDto | null } | null>(null)

  async function nonaktif(p: PegawaiDto) {
    try {
      await nonaktifkan.mutateAsync(p.id)
      toast.success(`${p.nama} dinonaktifkan.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }
  async function aktifkan(p: PegawaiDto) {
    try {
      await ubah.mutateAsync({ id: p.id, data: {} })
      toast.success(`${p.nama} diaktifkan kembali.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<PegawaiDto>[] = [
    { judul: 'Nama', teks: (p) => p.nama, sel: (p) => <span className="font-medium">{p.nama}</span> },
    { judul: 'NIP', teks: (p) => p.nip, sel: (p) => <span className="tabular-nums">{p.nip}</span> },
    { judul: 'Jabatan', teks: (p) => p.jabatan, sel: (p) => p.jabatan || '-' },
    { judul: 'Pangkat / golongan', teks: (p) => p.pangkatGolongan, sel: (p) => p.pangkatGolongan || '-' },
    { judul: 'Instansi', teks: (p) => p.instansi, sel: (p) => p.instansi || '-' },
    {
      judul: 'Status',
      teks: (p) => (p.status ? STATUS_LABEL[p.status] : ''),
      sel: (p) => (p.status ? <Badge>{STATUS_LABEL[p.status]}</Badge> : <Badge variant="warning">Belum dipilih</Badge>),
    },
    {
      judul: '',
      sel: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Ubah ${p.nama}`} onClick={() => setDialog({ pegawai: p })}>
            <PencilIcon />
          </Button>
          {p.aktif ? (
            <Button variant="ghost" size="icon" aria-label={`Nonaktifkan ${p.nama}`} onClick={() => nonaktif(p)}>
              <UserXIcon className="text-destructive" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label={`Aktifkan ${p.nama}`} onClick={() => aktifkan(p)}>
              <RotateCcwIcon />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pegawai"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
              Tampilkan nonaktif
            </label>
            <Button onClick={() => setDialog({ pegawai: null })}>
              <PlusIcon /> Tambah pegawai
            </Button>
          </>
        }
      />
      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat...' : tampilNonaktif ? 'Tidak ada pegawai nonaktif.' : 'Belum ada pegawai.'}
        />
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.pegawai ? 'Ubah pegawai' : 'Tambah pegawai'}</DialogTitle>
            <DialogDescription>NIP harus unik. Status dapat diubah kapan saja; surat tugas lama tidak ikut berubah.</DialogDescription>
          </DialogHeader>
          {dialog ? <FormPegawai awal={dialog.pegawai} onSelesai={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
