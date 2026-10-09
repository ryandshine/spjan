import { SaveIcon, Trash2Icon } from 'lucide-react'

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

/** Menu hapus di header; aksi simpan dan dokumen ada di bar bawah. */
export function AksiHeaderSt({ onHapus }: { onHapus: () => void }) {
  return (
    <MenuAksi
      label="Atur surat tugas"
      item={[{ label: 'Hapus surat tugas', ikon: <Trash2Icon className="size-4" />, bahaya: true, onPilih: onHapus }]}
    />
  )
}
