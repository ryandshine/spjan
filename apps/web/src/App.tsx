import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import { Alert } from '@/components/ui/alert'
import { useMe } from '@/lib/queries'
import BuatDariStPage from '@/pages/buat-dari-st'
import LoginPage from '@/pages/login'
import AuditPage from '@/pages/audit'
import PegawaiPage from '@/pages/pegawai'
import PengaturanPage from '@/pages/pengaturan'
import PenggunaPage from '@/pages/pengguna'
import SampahPage from '@/pages/sampah'
import SbmPage from '@/pages/sbm'
import StEditorPage from '@/pages/st-editor'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage } from '@/pages/placeholder'

// Dokumen memuat @react-pdf/renderer (besar), jadi dimuat saat dibutuhkan.
const DokumenPage = lazy(() => import('@/pages/dokumen'))

function WajibAdmin({ children }: { children: ReactNode }) {
  const me = useMe()
  if (me.data?.peran !== 'admin') return <Alert variant="destructive">Halaman ini hanya untuk admin.</Alert>
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<StEditorPage />} />
          <Route path="st/buat-dari-st" element={<BuatDariStPage />} />
          <Route path="st/:id" element={<StEditorPage />} />
          <Route
            path="st/:id/dokumen"
            element={
              <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat...</p>}>
                <DokumenPage />
              </Suspense>
            }
          />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="sbm" element={<SbmPage />} />
          <Route path="pengguna" element={<WajibAdmin><PenggunaPage /></WajibAdmin>} />
          <Route path="sampah" element={<WajibAdmin><SampahPage /></WajibAdmin>} />
          <Route path="audit" element={<WajibAdmin><AuditPage /></WajibAdmin>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
