import { useMemo, useState, type ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Kolom<T> {
  judul: string
  sel: (baris: T) => ReactNode
  /** Teks yang dipakai pencarian; kosongkan agar kolom tidak ikut dicari. */
  teks?: (baris: T) => string
  rataKanan?: boolean
  className?: string
}

export function DataTable<T>({
  kolom,
  baris,
  cari = true,
  kosong = 'Tidak ada data.',
  maksBaris = 500,
  kartuMobile,
  teksCari,
  petunjukCari = 'Cari...',
  kata: kataLuar,
  onKata,
  diBawahCari,
}: {
  kolom: Kolom<T>[]
  baris: T[]
  cari?: boolean
  kosong?: string
  maksBaris?: number
  kartuMobile?: (baris: T, indeks: number) => ReactNode
  /** Teks tambahan yang ikut dicari walau tidak tampil sebagai kolom. */
  teksCari?: (baris: T) => string
  petunjukCari?: string
  /** Kata pencarian dikendalikan dari luar (bila halaman perlu memakainya juga). */
  kata?: string
  onKata?: (kata: string) => void
  /** Isi tambahan di bawah kolom pencarian, mis. ringkasan hasil. */
  diBawahCari?: ReactNode
}) {
  const [kataSendiri, setKataSendiri] = useState('')
  const kata = kataLuar ?? kataSendiri
  const setKata = onKata ?? setKataSendiri
  const tersaring = useMemo(() => {
    // Spasi diabaikan agar NIP yang ditulis "1980 0120 ..." tetap cocok.
    const rapat = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    const q = rapat(kata)
    if (!q) return baris
    return baris.filter((b) => kolom.some((k) => rapat(k.teks?.(b) ?? '').includes(q)) || rapat(teksCari?.(b) ?? '').includes(q))
  }, [baris, kata, kolom, teksCari])
  const tampil = tersaring.slice(0, maksBaris)

  return (
    <div className="grid gap-3">
      {cari ? (
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={kata} onChange={(e) => setKata(e.target.value)} placeholder={petunjukCari} aria-label={petunjukCari} className="pl-8" />
        </div>
      ) : null}
      {diBawahCari}
      {kartuMobile ? (
        <div className="grid gap-3 md:hidden">
          {tampil.length === 0 ? (
            <div className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground">
              {kosong}
            </div>
          ) : (
            tampil.map((b, i) => <div key={i}>{kartuMobile(b, i)}</div>)
          )}
        </div>
      ) : null}
      <div className={cn('rounded-lg border bg-card', kartuMobile && 'hidden md:block')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {kolom.map((k) => (
                <TableHead key={k.judul} className={cn(k.rataKanan && 'text-right', k.className)}>
                  {k.judul}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tampil.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={kolom.length} className="py-10 text-center text-muted-foreground">
                  {kosong}
                </TableCell>
              </TableRow>
            ) : (
              tampil.map((b, i) => (
                <TableRow key={i}>
                  {kolom.map((k) => (
                    <TableCell key={k.judul} className={cn(k.rataKanan && 'text-right tabular-nums', k.className)}>
                      {k.sel(b)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {tersaring.length > maksBaris ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan {maksBaris} dari {tersaring.length} baris.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{tersaring.length} baris</p>
      )}
    </div>
  )
}
