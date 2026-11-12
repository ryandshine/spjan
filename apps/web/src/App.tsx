import { lazy, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import { Alert } from '@/components/ui/alert'
import { useMe } from '@/lib/queries'
import LoginPage from '@/pages/login'
import { NotFoundPage } from '@/pages/placeholder'

// Setiap halaman dimuat saat dibutuhkan agar bundel awal kecil (Tiptap, react-pdf, dll. tidak ikut
// di chunk utama). Fallback Suspense ada di AppShell, di sekitar <Outlet />.
const BuatDariStPage = lazy(() => import('@/pages/buat-dari-st'))
const AuditPage = lazy(() => import('@/pages/audit'))
const PegawaiPage = lazy(() => import('@/pages/pegawai'))
const PengaturanPage = lazy(() => import('@/pages/pengaturan'))
const PenggunaPage = lazy(() => import('@/pages/pengguna'))
const SampahPage = lazy(() => import('@/pages/sampah'))
const SbmPage = lazy(() => import('@/pages/sbm'))
const StEditorPage = lazy(() => import('@/pages/st-editor'))
const SuratTugasListPage = lazy(() => import('@/pages/st-list'))
const NaskahStListPage = lazy(() => import('@/pages/st-naskah-list'))
const NaskahStEditorPage = lazy(() => import('@/pages/st-naskah-editor'))
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
          <Route path="st-naskah" element={<NaskahStListPage />} />
          <Route path="st-naskah/baru" element={<NaskahStEditorPage />} />
          <Route path="st-naskah/:id" element={<NaskahStEditorPage />} />
          <Route path="st/baru" element={<StEditorPage />} />

          <Route path="st/buat-dari-st" element={<BuatDariStPage />} />
          <Route path="st/:id" element={<StEditorPage />} />
          <Route path="st/:id/dokumen" element={<DokumenPage />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<WajibAdmin><PengaturanPage /></WajibAdmin>} />
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
