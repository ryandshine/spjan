import { useEffect, useRef, useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, PencilLineIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Menu aksi struktur per bagian: ganti judul, ubah urutan di laporan, hapus. */
export function MenuBagian({
  bisaNaik,
  bisaTurun,
  onGantiJudul,
  onNaik,
  onTurun,
  onHapus,
}: {
  bisaNaik: boolean
  bisaTurun: boolean
  onGantiJudul: () => void
  onNaik: () => void
  onTurun: () => void
  onHapus: () => void
}) {
  const [buka, setBuka] = useState(false)
  const akar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent) => {
      if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setBuka(false)
    document.addEventListener('mousedown', luar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', luar)
      document.removeEventListener('keydown', esc)
    }
  }, [buka])

  const item = (label: string, ikon: React.ReactNode, aksi: () => void, opsi?: { disabled?: boolean; bahaya?: boolean }) => (
    <button
      type="button"
      role="menuitem"
      disabled={opsi?.disabled}
      className={`flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 ${opsi?.bahaya ? 'text-destructive' : ''}`}
      onClick={() => {
        setBuka(false)
        aksi()
      }}
    >
      {ikon}
      {label}
    </button>
  )

  return (
    <div ref={akar} className="relative">
      <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Atur bagian ini" aria-haspopup="menu" aria-expanded={buka} onClick={() => setBuka((b) => !b)}>
        <MoreHorizontalIcon className="size-4" />
      </Button>
      {buka ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-64 rounded-md border bg-card p-1 shadow-md">
          {item('Ganti nama judul', <PencilLineIcon className="size-4" />, onGantiJudul)}
          {item('Naikkan urutan di laporan', <ArrowUpIcon className="size-4" />, onNaik, { disabled: !bisaNaik })}
          {item('Turunkan urutan di laporan', <ArrowDownIcon className="size-4" />, onTurun, { disabled: !bisaTurun })}
          <div className="my-1 h-px bg-border" />
          {item('Hapus bagian', <Trash2Icon className="size-4" />, onHapus, { bahaya: true })}
        </div>
      ) : null}
    </div>
  )
}
