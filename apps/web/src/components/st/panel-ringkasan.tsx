import { CheckCircle2Icon, TriangleAlertIcon } from 'lucide-react'
import type { SpjHasil } from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { rupiah } from '@/lib/format'
import { sasaranPeringatan } from '@/lib/periksa'
import { rincianTotal } from '@/lib/st-editor'

/** Berpindah ke isian yang bermasalah (id elemen, nomor pelaksana mulai dari 1). */
export type PerbaikiIsian = (sasaranId: string, nomorPelaksana: number) => void

function RingkasanBiaya({ hasil }: { hasil: SpjHasil }) {
  return (
    <section aria-label="Ringkasan biaya" className="grid gap-3">
      <dl className="grid gap-1.5 text-sm">
        {rincianTotal(hasil.pelaksana).map(({ label, nilai }) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{rupiah(nilai)}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t pt-3" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Total SPTB</p>
          <p className="text-xl font-bold tabular-nums">{rupiah(hasil.total)}</p>
        </div>
        {hasil.total > 0 ? <p className="mt-1 text-xs leading-snug text-muted-foreground first-letter:uppercase">{hasil.terbilang}</p> : null}
      </div>
    </section>
  )
}

function PemeriksaanPelaksana({ p, nomor, onPerbaiki }: { p: SpjHasil['pelaksana'][number]; nomor: number; onPerbaiki: PerbaikiIsian }) {
  return (
    <section className="grid gap-1.5" aria-label={`Pemeriksaan ${p.nama || `Pelaksana ${nomor}`}`}>
      <div className="flex items-start justify-between gap-2 text-sm">
        <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{p.nama || `Pelaksana ${nomor}`}</p>
        <span className="shrink-0 tabular-nums text-muted-foreground">{rupiah(p.total)}</span>
      </div>
      {p.peringatan.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden /> Lengkap
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {p.peringatan.map((w, k) => (
            <li key={k} className="grid gap-0.5 text-xs">
              <span className="flex items-start gap-1.5 text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span className="[overflow-wrap:anywhere]">{w.pesan}</span>
              </span>
              <Button type="button" variant="ghost" size="sm" className="h-8 justify-start px-1 text-xs text-primary" onClick={() => onPerbaiki(sasaranPeringatan(w, nomor), nomor)}>
                Perbaiki →
              </Button>
            </li>
          ))}
        </ul>
      )}
      {p.catatan.length > 0 ? (
        <ul className="grid gap-0.5 text-xs leading-snug text-muted-foreground">
          {p.catatan.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** Panel kanan editor: rincian biaya dan total di atas, lalu hal yang perlu diperiksa per pelaksana. */
export function PanelRingkasan({ hasil, onPerbaiki }: { hasil: SpjHasil; onPerbaiki: PerbaikiIsian }) {
  const jumlah = hasil.pelaksana.reduce((n, p) => n + p.peringatan.length, 0)
  return (
    <Card className="shadow-sm xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
      <CardContent className="grid gap-4">
        <RingkasanBiaya hasil={hasil} />
        <section aria-label="Pemeriksaan" className="grid gap-3 border-t pt-4">
          <div>
            <h2 className="text-sm font-semibold">{jumlah > 0 ? `Periksa (${jumlah})` : 'Periksa'}</h2>
            {jumlah > 0 ? <p className="mt-1 text-xs text-muted-foreground">Dokumen tetap bisa dibuat, tetapi sebaiknya perbaiki dulu.</p> : null}
          </div>
          {hasil.pelaksana.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pelaksana.</p> : null}
          {jumlah === 0 && hasil.pelaksana.length > 0 ? (
            <p className="flex items-start gap-1.5 text-sm text-success">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> Tidak ada yang perlu diperiksa.
            </p>
          ) : null}
          {hasil.pelaksana.map((p, i) => (
            <div key={i} className="border-t pt-3 first:border-t-0 first:pt-0">
              <PemeriksaanPelaksana p={p} nomor={i + 1} onPerbaiki={onPerbaiki} />
            </div>
          ))}
        </section>
      </CardContent>
    </Card>
  )
}
