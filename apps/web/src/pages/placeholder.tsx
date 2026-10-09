import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'

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
