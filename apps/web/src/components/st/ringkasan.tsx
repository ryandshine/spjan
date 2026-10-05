import type { SpjHasil } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { rupiah } from '@/lib/format'

/** Panel total keseluruhan dan status per pelaksana. */
export function RingkasanPanel({ hasil }: { hasil: SpjHasil }) {
  const jumlahPeringatan = hasil.pelaksana.reduce((n, p) => n + p.peringatan.length, 0)
  return (
    <Card className="xl:sticky xl:top-6 shadow-sm border-border">
      <CardContent className="grid gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total SPTB</p>
          <p className="text-2xl font-semibold tabular-nums">{rupiah(hasil.total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hasil.terbilang}</p>
        </div>
        <div className="grid gap-2 border-t pt-3">
          {hasil.pelaksana.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pelaksana.</p> : null}
          {hasil.pelaksana.map((p, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nama || `Pelaksana ${i + 1}`}</p>
                {p.peringatan.length > 0 ? (
                  <Badge variant="destructive">{p.peringatan.length} perlu diperiksa</Badge>
                ) : (
                  <Badge variant="success">Lengkap</Badge>
                )}
              </div>
              <span className="tabular-nums">{rupiah(p.total)}</span>
            </div>
          ))}
        </div>
        {jumlahPeringatan > 0 ? (
          <p className="text-xs text-destructive">{jumlahPeringatan} peringatan data. Lengkapi sebelum mencetak dokumen.</p>
        ) : hasil.pelaksana.length > 0 ? (
          <p className="text-xs text-success">Semua data lengkap.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
