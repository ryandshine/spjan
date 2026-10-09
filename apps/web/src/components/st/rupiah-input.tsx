import type { ComponentProps } from 'react'
import { formatAngka } from '@spjan/shared'

import { Input } from '@/components/ui/input'

/** Input angka rupiah dengan pemisah ribuan titik. Nilai kosong = null. */
export function RupiahInput({
  value,
  onChange,
  nolKosong = false,
  awalan = false,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number | null | undefined
  onChange: (v: number | null) => void
  /** Tampilkan 0 sebagai kosong. */
  nolKosong?: boolean
  /** Tampilkan awalan statis "Rp" di sisi kiri dalam input. */
  awalan?: boolean
}) {
  const tampil = value == null || (nolKosong && value === 0) ? '' : formatAngka(value)
  const input = (
    <Input
      inputMode="numeric"
      className={awalan ? 'pl-9 text-right tabular-nums' : 'text-right tabular-nums'}
      value={tampil}
      onChange={(e) => {
        const digit = e.target.value.replace(/\D/g, '')
        onChange(digit === '' ? null : Number(digit))
      }}
      {...props}
    />
  )
  if (!awalan) return input
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground" aria-hidden>
        Rp
      </span>
      {input}
    </div>
  )
}
