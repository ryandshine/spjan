import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import PengaturanPage from '@/pages/pengaturan'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<SegeraPage judul="Surat tugas baru" />} />
          <Route path="st/:id" element={<SegeraPage judul="Editor surat tugas" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
