import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ApiError } from '@/lib/api'
import { useMe } from '@/lib/queries'

export function RequireAuth() {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Memuat...</div>
  }
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Navigate to="/login" replace state={{ dari: location.pathname }} />
    }
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-destructive">
        Tidak dapat menghubungi server. Muat ulang halaman ini.
      </div>
    )
  }
  return <Outlet />
}
