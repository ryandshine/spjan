import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import type { Blok } from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { geser } from '@/lib/geser'

const LABEL: Record<Blok['tipe'], string> = {
  paragraf: 'Paragraf',
  subjudul: 'Subjudul',
  daftar: 'Daftar berbutir',
  nomor: 'Daftar bernomor',
}

const BARU: Record<Blok['tipe'], Blok> = {
  paragraf: { tipe: 'paragraf', teks: '' },
  subjudul: { tipe: 'subjudul', teks: '' },
  daftar: { tipe: 'daftar', butir: [''] },
  nomor: { tipe: 'nomor', butir: [''] },
}

export function BlokEditor({ blok, onUbah }: { blok: Blok[]; onUbah: (blok: Blok[]) => void }) {
  const ganti = (i: number, b: Blok) => onUbah(blok.map((x, n) => (n === i ? b : x)))
  return (
    <div className="grid gap-2">
      {blok.map((b, i) => (
        <div key={i} className="grid gap-1.5 rounded-md border bg-card p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{LABEL[b.tipe]}</span>
            <div className="flex items-center">
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Geser blok ke atas" disabled={i === 0} onClick={() => onUbah(geser(blok, i, -1))}>
                <ChevronUpIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Geser blok ke bawah" disabled={i === blok.length - 1} onClick={() => onUbah(geser(blok, i, 1))}>
                <ChevronDownIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Hapus blok" onClick={() => onUbah(blok.filter((_, n) => n !== i))}>
                <Trash2Icon className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
          {b.tipe === 'paragraf' ? (
            <Textarea rows={4} value={b.teks} onChange={(e) => ganti(i, { tipe: 'paragraf', teks: e.target.value })} />
          ) : b.tipe === 'subjudul' ? (
            <Input className="font-semibold" value={b.teks} onChange={(e) => ganti(i, { tipe: 'subjudul', teks: e.target.value })} />
          ) : (
            <Textarea
              rows={Math.max(3, b.butir.length + 1)}
              placeholder="Satu butir per baris"
              value={b.butir.join('\n')}
              onChange={(e) => ganti(i, { tipe: b.tipe, butir: e.target.value.split('\n') })}
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BARU) as Blok['tipe'][]).map((t) => (
          <Button key={t} type="button" variant="outline" size="sm" onClick={() => onUbah([...blok, BARU[t]])}>
            <PlusIcon className="size-3.5" /> {LABEL[t]}
          </Button>
        ))}
      </div>
    </div>
  )
}
