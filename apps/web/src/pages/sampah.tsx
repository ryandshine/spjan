import { useState } from 'react'
import { RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable, type Kolom } from '@/components/data-table'
import { DialogKonfirmasiPassword } from '@/components/dialog-konfirmasi-password'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { pesanGalat, waktuPendek } from '@/lib/format'
import { useSampah, useSampahMutations } from '@/lib/queries'

type Sampah = NonNullable<ReturnType<typeof useSampah>['data']>
type ItemSt = Sampah['suratTugas'][number]
type ItemBerkas = Sampah['berkas'][number]
type Target = { jenis: 'st'; item: ItemSt } | { jenis: 'berkas'; item: ItemBerkas }

export default function SampahPage() {
  const sampah = useSampah()
  const m = useSampahMutations()
  const [target, setTarget] = useState<Target | null>(null)

  async function pulihkan(aksi: () => Promise<void>, nama: string) {
    try {
      await aksi()
      toast.success(`${nama} dipulihkan.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolomSt: Kolom<ItemSt>[] = [
    { judul: 'Nomor', teks: (b) => b.nomor, sel: (b) => <span className="font-medium">{b.nomor}</span> },
    { judul: 'Pembuat', teks: (b) => b.dibuatOleh ?? '', sel: (b) => b.dibuatOleh ?? '-' },
    { judul: 'Dihapus oleh', sel: (b) => b.dihapusOleh ?? '-' },
    { judul: 'Dihapus', sel: (b) => <span className="text-muted-foreground">{waktuPendek(b.dihapusPada)}</span> },
    {
      judul: '',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => void pulihkan(() => m.pulihkanSt.mutateAsync(b.id), b.nomor)}>
            <RotateCcwIcon className="size-3.5" /> Pulihkan
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTarget({ jenis: 'st', item: b })}>
            <Trash2Icon className="size-3.5" /> Hapus permanen
          </Button>
        </div>
      ),
    },
  ]

  const kolomBerkas: Kolom<ItemBerkas>[] = [
    { judul: 'Berkas', teks: (b) => b.namaAsli, sel: (b) => <span className="font-medium">{b.namaAsli}</span> },
    { judul: 'Jenis', teks: (b) => b.jenis, sel: (b) => b.jenis },
    { judul: 'Surat tugas', sel: (b) => (b.stId !== null ? `#${b.stId}` : '-') },
    { judul: 'Dihapus oleh', sel: (b) => b.dihapusOleh ?? '-' },
    { judul: 'Dihapus', sel: (b) => <span className="text-muted-foreground">{waktuPendek(b.dihapusPada)}</span> },
    {
      judul: '',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => void pulihkan(() => m.pulihkanBerkas.mutateAsync(b.id), b.namaAsli)}>
            <RotateCcwIcon className="size-3.5" /> Pulihkan
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTarget({ jenis: 'berkas', item: b })}>
            <Trash2Icon className="size-3.5" /> Hapus permanen
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="grid gap-8">
      <PageHeader title="Tempat Sampah" description="Surat tugas dan berkas yang dihapus tersimpan di sini. Hapus permanen tidak bisa dibatalkan." />
      {sampah.isError ? (
        <Alert variant="destructive">{pesanGalat(sampah.error)}</Alert>
      ) : (
        <>
          <section className="grid gap-3">
            <h2 className="text-base font-semibold">Surat tugas</h2>
            <DataTable kolom={kolomSt} baris={sampah.data?.suratTugas ?? []} kosong={sampah.isPending ? 'Memuat...' : 'Tidak ada surat tugas di tempat sampah.'} />
          </section>
          <section className="grid gap-3">
            <h2 className="text-base font-semibold">Berkas</h2>
            <DataTable kolom={kolomBerkas} baris={sampah.data?.berkas ?? []} kosong={sampah.isPending ? 'Memuat...' : 'Tidak ada berkas di tempat sampah.'} />
          </section>
        </>
      )}
      <DialogKonfirmasiPassword
        buka={target !== null}
        onBukaChange={(b) => !b && setTarget(null)}
        judul="Hapus permanen?"
        deskripsi={
          target?.jenis === 'st'
            ? `${target.item.nomor} beserta seluruh pelaksana, biaya, berkas, dan laporannya dihapus selamanya.`
            : `Berkas "${target?.item.namaAsli ?? ''}" dihapus selamanya dari penyimpanan.`
        }
        labelAksi="Hapus permanen"
        bahaya
        onKonfirmasi={async ({ password }) => {
          if (!target) return
          if (target.jenis === 'st') await m.hapusPermanenSt.mutateAsync({ id: target.item.id, password })
          else await m.hapusPermanenBerkas.mutateAsync({ id: target.item.id, password })
          toast.success('Dihapus permanen.')
        }}
      />
    </div>
  )
}
