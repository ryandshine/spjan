import { useRef, useState } from 'react'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const isoKeTeks = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

function teksKeIso(teks: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(teks.trim())
  if (!m) return null
  const [h, b, t] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(t, b - 1, h))
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * Tanggal berformat Indonesia (hari/bulan/tahun) dengan tombol kalender. Nilai di luar berbentuk "yyyy-mm-dd"
 * ("" atau null = kosong); `onUbah` menerima "yyyy-mm-dd" atau null saat dikosongkan.
 */
export function InputTanggal({
  id,
  nilai,
  onUbah,
  label,
  className,
}: {
  id?: string
  nilai: string | null | undefined
  onUbah: (iso: string | null) => void
  label: string
  className?: string
}) {
  const [mengetik, setMengetik] = useState(false)
  const [teks, setTeks] = useState('')
  const kalender = useRef<HTMLInputElement>(null)
  const tampil = mengetik ? teks : isoKeTeks(nilai)
  const salah = mengetik && teks.trim() !== '' && teksKeIso(teks) === null
  return (
    <div className={className}>
      <div className="relative flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          placeholder="hh/bb/tttt"
          aria-label={label}
          aria-invalid={salah}
          value={tampil}
          onFocus={() => {
            setTeks(isoKeTeks(nilai))
            setMengetik(true)
          }}
          onBlur={() => setMengetik(false)}
          onChange={(e) => {
            setTeks(e.target.value)
            if (e.target.value.trim() === '') onUbah(null)
            else {
              const iso = teksKeIso(e.target.value)
              if (iso) onUbah(iso)
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={`Pilih ${label} dari kalender`} onClick={() => kalender.current?.showPicker()}>
          <CalendarIcon className="size-4" />
        </Button>
        <input
          ref={kalender}
          type="date"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 size-0 opacity-0"
          value={nilai ?? ''}
          onChange={(e) => onUbah(e.target.value || null)}
        />
      </div>
      {salah ? <p className="mt-1 text-xs text-destructive">Tulis tanggal dengan format hari/bulan/tahun, mis. 13/09/2026.</p> : null}
    </div>
  )
}
