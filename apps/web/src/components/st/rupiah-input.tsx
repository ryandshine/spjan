import type { ComponentProps } from 'react'
import { formatAngka } from '@spjan/shared'

import { Input } from '@/components/ui/input'

/** Input angka rupiah dengan pemisah ribuan titik. Nilai kosong = null. */
export function RupiahInput({
  value,
  onChange,
  nolKosong = false,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number | null | undefined
  onChange: (v: number | null) => void
  /** Tampilkan 0 sebagai kosong. */
  nolKosong?: boolean
}) {
  const tampil = value == null || (nolKosong && value === 0) ? '' : formatAngka(value)
  return (
    <Input
      inputMode="numeric"
      className="text-right tabular-nums"
      value={tampil}
      onChange={(e) => {
        const digit = e.target.value.replace(/\D/g, '')
        onChange(digit === '' ? null : Number(digit))
      }}
      {...props}
    />
  )
}
