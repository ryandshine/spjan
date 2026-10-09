import { FileTextIcon, SaveIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { MenuAksi } from '@/components/ui/menu-aksi'

function TombolSimpan({ menyimpan, nonaktif, onSimpan }: { menyimpan: boolean; nonaktif?: boolean; onSimpan: () => void }) {
  return (
    <Button onClick={onSimpan} disabled={menyimpan || nonaktif}>
      <SaveIcon /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
    </Button>
  )
}

/** Dipakai di tab Laporan, yang memiliki header sendiri: hanya mengingatkan bila data surat tugas belum tersimpan. */
export function PeringatanBelumSimpan({ menyimpan, onSimpan }: { menyimpan: boolean; onSimpan: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-sm">
      Data surat tugas belum disimpan
      <Button size="sm" onClick={onSimpan} disabled={menyimpan}>
        <SaveIcon /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </div>
  )
}

/** Tautan Dokumen, tombol Simpan, dan menu hapus. `id` null berarti surat tugas belum tersimpan. */
export function AksiHeaderSt({
  id,
  kotor,
  menyimpan,
  onSimpan,
  onHapus,
}: {
  id: number | null
  kotor: boolean
  menyimpan: boolean
  onSimpan: () => void
  onHapus: () => void
}) {
  return (
    <>
      {id !== null ? (
        <Link
          to={`/st/${id}/dokumen`}
          className={buttonVariants({ variant: 'outline' })}
          aria-disabled={kotor}
          onClick={(e) => {
            if (!kotor) return
            e.preventDefault()
            toast.info('Simpan perubahan dulu sebelum membuka dokumen.')
          }}
        >
          <FileTextIcon className="size-4" /> Dokumen
        </Link>
      ) : null}
      <TombolSimpan menyimpan={menyimpan} nonaktif={!kotor && id !== null} onSimpan={onSimpan} />
      {id !== null ? (
        <MenuAksi
          label="Atur surat tugas"
          item={[{ label: 'Hapus surat tugas', ikon: <Trash2Icon className="size-4" />, bahaya: true, onPilih: onHapus }]}
        />
      ) : null}
    </>
  )
}
