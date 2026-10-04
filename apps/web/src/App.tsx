import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SegeraPage judul="Surat Tugas" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
