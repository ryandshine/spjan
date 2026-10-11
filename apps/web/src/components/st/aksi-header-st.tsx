import { FileTextIcon, LockIcon, LockOpenIcon, SaveIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { MenuAksi } from '@/components/ui/menu-aksi'

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

/**
 * Aksi di header halaman: dokumen, simpan, tandai selesai / buka kunci, dan menu hapus.
 * Menggantikan bar bawah; status validasi dan total ada di panel Ringkasan.
 */
export function AksiHeaderSt({
  id,
  kotor,
  menyimpan,
  dikunci,
  bolehUbah,
  onSimpan,
  onHapus,
  onKunci,
  onBukaKunci,
}: {
  id: number | null
  kotor: boolean
  menyimpan: boolean
  /** Status final dari server. */
  dikunci: boolean
  /** Admin atau pembuat surat tugas. */
  bolehUbah: boolean
  onSimpan: () => void
  onHapus: () => void
  onKunci: () => void
  onBukaKunci: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {id !== null ? (
        <Link
          to={`/st/${id}/dokumen`}
          className={buttonVariants({ variant: 'outline' }) + ' gap-2'}
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
      {bolehUbah && dikunci ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <LockIcon className="size-3.5" aria-hidden /> Terkunci
          </span>
          <Button variant="outline" className="gap-2" onClick={onBukaKunci}>
            <LockOpenIcon /> Buka kunci
          </Button>
        </>
      ) : null}
      {bolehUbah && !dikunci ? (
        <>
          {id !== null && !kotor ? (
            <Button variant="outline" className="gap-2" onClick={onKunci}>
              <LockIcon /> Tandai selesai
            </Button>
          ) : null}
          <Button className="gap-2 rounded-lg px-5 py-2 font-medium shadow-sm" onClick={onSimpan} disabled={menyimpan || (!kotor && id !== null)}>
            <SaveIcon /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </Button>
          {id !== null ? (
            <MenuAksi
              label="Atur surat tugas"
              item={[{ label: 'Hapus surat tugas', ikon: <Trash2Icon className="size-4" />, bahaya: true, onPilih: onHapus }]}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
