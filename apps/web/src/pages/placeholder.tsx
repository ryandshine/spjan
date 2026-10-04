import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function SegeraPage({ judul }: { judul: string }) {
  return (
    <div>
      <PageHeader title={judul} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Halaman ini dikerjakan pada tahap berikutnya (editor surat tugas dan dokumen).
          <div className="mt-4">
            <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Kembali ke daftar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Halaman tidak ditemukan" />
      <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Ke beranda
      </Link>
    </div>
  )
}
