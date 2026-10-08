import { useRef, useState } from 'react'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const isoKeTeks = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** "dd/mm/yyyy" valid menjadi "yyyy-mm-dd"; selain itu null. */
function teksKeIso(teks: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(teks.trim())
  if (!m) return null
  const [h, b, t] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(t, b - 1, h))
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** Tanggal berformat Indonesia (dd/mm/yyyy) dengan tombol kalender; kosong = null. Isi awal dibaca sekali. */
export function InputTanggalId({ nilai, onUbah, label }: { nilai: string | null | undefined; onUbah: (iso: string | null) => void; label: string }) {
  const [teks, setTeks] = useState(isoKeTeks(nilai))
  const kalender = useRef<HTMLInputElement>(null)
  const salah = teks.trim() !== '' && teksKeIso(teks) === null
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <Input
          className="h-10"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-label={label}
          aria-invalid={salah}
          value={teks}
          onChange={(e) => {
            setTeks(e.target.value)
            if (e.target.value.trim() === '') onUbah(null)
            else {
              const iso = teksKeIso(e.target.value)
              if (iso) onUbah(iso)
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" aria-label="Pilih dari kalender" onClick={() => kalender.current?.showPicker()}>
          <CalendarIcon className="size-4" />
        </Button>
        <input
          ref={kalender}
          type="date"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute size-0 opacity-0"
          value={teksKeIso(teks) ?? ''}
          onChange={(e) => {
            setTeks(isoKeTeks(e.target.value))
            onUbah(e.target.value || null)
          }}
        />
      </div>
      {salah ? <p className="text-xs text-destructive">Tulis tanggal dengan format hari/bulan/tahun, mis. 13/09/2026.</p> : null}
    </div>
  )
}
