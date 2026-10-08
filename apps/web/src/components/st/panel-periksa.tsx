import { CheckCircle2Icon, TriangleAlertIcon } from 'lucide-react'
import type { SpjHasil } from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { lompatKeIsian, sasaranPeringatan } from '@/lib/periksa'
import { rupiah } from '@/lib/format'

/** Daftar semua hal yang perlu diperiksa, dikelompokkan per pelaksana, dengan tombol loncat ke isiannya. */
export function PanelPeriksa({ hasil }: { hasil: SpjHasil }) {
  const jumlah = hasil.pelaksana.reduce((n, p) => n + p.peringatan.length, 0)
  return (
    <Card className="border-border shadow-sm xl:sticky xl:top-24">
      <CardContent className="grid gap-4">
        <div>
          <h2 className="text-base font-semibold">{jumlah > 0 ? `Periksa (${jumlah})` : 'Periksa'}</h2>
          {jumlah === 0 && hasil.pelaksana.length > 0 ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-success">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> Tidak ada yang perlu diperiksa.
            </p>
          ) : null}
          {jumlah > 0 ? <p className="mt-1 text-xs text-muted-foreground">Dokumen tetap bisa dibuat, tetapi sebaiknya perbaiki dulu.</p> : null}
        </div>
        {hasil.pelaksana.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pelaksana.</p> : null}
        {hasil.pelaksana.map((p, i) => (
          <section key={i} className="grid gap-1.5 border-t pt-3 first:border-t-0 first:pt-0" aria-label={`Pemeriksaan ${p.nama || `Pelaksana ${i + 1}`}`}>
            <div className="flex items-start justify-between gap-2 text-sm">
              <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{p.nama || `Pelaksana ${i + 1}`}</p>
              <span className="shrink-0 tabular-nums text-muted-foreground">{rupiah(p.total)}</span>
            </div>
            {p.peringatan.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden /> Lengkap
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {p.peringatan.map((w, k) => (
                  <li key={k} className="grid gap-1 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                    <span className="flex items-start gap-1.5 text-warning-foreground">
                      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span className="[overflow-wrap:anywhere]">{w.pesan}</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="h-8 justify-start px-1 text-xs text-primary" onClick={() => lompatKeIsian(sasaranPeringatan(w, i + 1), i + 1)}>
                      Perbaiki →
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
