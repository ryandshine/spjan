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
}: {
  kolom: Kolom<T>[]
  baris: T[]
  cari?: boolean
  kosong?: string
  maksBaris?: number
  kartuMobile?: (baris: T, indeks: number) => ReactNode
}) {
  const [kata, setKata] = useState('')
  const tersaring = useMemo(() => {
    const q = kata.trim().toLowerCase()
    if (!q) return baris
    return baris.filter((b) => kolom.some((k) => k.teks?.(b).toLowerCase().includes(q)))
  }, [baris, kata, kolom])
  const tampil = tersaring.slice(0, maksBaris)

  return (
    <div className="grid gap-3">
      {cari ? (
        <div className="relative max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={kata} onChange={(e) => setKata(e.target.value)} placeholder="Cari..." className="pl-8" />
        </div>
      ) : null}
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
