import { LockIcon, LockOpenIcon, SaveIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
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

/** Menu di header: kunci/buka kunci dan hapus (hapus hanya saat tidak terkunci); aksi simpan dan dokumen ada di bar bawah. */
export function AksiHeaderSt({
  terkunci,
  bisaKunci,
  onHapus,
  onKunci,
  onBukaKunci,
}: {
  terkunci: boolean
  /** Kunci hanya setelah semua perubahan tersimpan. */
  bisaKunci: boolean
  onHapus: () => void
  onKunci: () => void
  onBukaKunci: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {terkunci ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          <LockIcon className="size-3.5" aria-hidden /> Terkunci
        </span>
      ) : null}
      <MenuAksi
        label="Atur surat tugas"
        item={
          terkunci
            ? [{ label: 'Buka kunci', ikon: <LockOpenIcon className="size-4" />, onPilih: onBukaKunci }]
            : [
                { label: bisaKunci ? 'Tandai selesai (kunci)' : 'Tandai selesai (simpan dulu)', ikon: <LockIcon className="size-4" />, nonaktif: !bisaKunci, onPilih: onKunci },
                { label: 'Hapus surat tugas', ikon: <Trash2Icon className="size-4" />, bahaya: true, onPilih: onHapus },
              ]
        }
      />
    </div>
  )
}
