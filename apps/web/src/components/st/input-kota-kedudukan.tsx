import type { Sbm } from '@spjan/shared'

import { Input } from '@/components/ui/input'
import { saranKota } from '@/lib/saran-kota'

/** Isian kota tempat kedudukan dengan saran kota dari provinsi kedudukan (isian bebas tetap boleh). */
export function InputKotaKedudukan({
  id,
  value,
  provinsi,
  sbm,
  placeholder,
  onChange,
}: {
  id: string
  value: string
  provinsi: string
  sbm: Sbm | undefined
  placeholder?: string
  onChange: (kota: string) => void
}) {
  const idDaftar = `${id}-daftar`
  return (
    <>
      <Input id={id} list={idDaftar} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={idDaftar}>
        {saranKota(sbm, provinsi).map((nama) => (
          <option key={nama} value={nama} />
        ))}
      </datalist>
    </>
  )
}
