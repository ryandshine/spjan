import { formatAngka, type PemakaianAiBaris } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pesanGalat } from '@/lib/format'
import { usePemakaianAi } from '@/lib/queries'

const namaBulan = (bulan: string) => {
  const [tahun, bln] = bulan.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(tahun ?? 2000, (bln ?? 1) - 1, 1))
}

const kolom: Kolom<PemakaianAiBaris>[] = [
  { judul: 'Bulan', sel: (b) => namaBulan(b.bulan) },
  { judul: 'Model', sel: (b) => b.model },
  { judul: 'Berkas', rataKanan: true, sel: (b) => formatAngka(b.berkas) },
  { judul: 'Panggilan', rataKanan: true, sel: (b) => formatAngka(b.panggilan) },
  { judul: 'Token masuk', rataKanan: true, sel: (b) => formatAngka(b.tokenMasuk) },
  { judul: 'Token keluar', rataKanan: true, sel: (b) => formatAngka(b.tokenKeluar) },
]

export function PemakaianAiCard() {
  const data = usePemakaianAi()
  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Pemakaian model AI</CardTitle>
        <CardDescription>
          Token pembacaan berkas 12 bulan terakhir, termasuk yang gagal atau diulang. Tagihan resmi ada di konsol penyedia model.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.isError ? (
          <Alert variant="destructive">{pesanGalat(data.error)}</Alert>
        ) : (
          <DataTable kolom={kolom} baris={data.data ?? []} cari={false} kosong={data.isPending ? 'Memuat...' : 'Belum ada pemakaian.'} />
        )}
      </CardContent>
    </Card>
  )
}
