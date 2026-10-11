import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { DialogGantiPassword } from '@/components/dialog-ganti-password'
import { Button } from '@/components/ui/button'
import { ZoomHalaman } from '@/components/zoom-halaman'
import { useLogout, useMe } from '@/lib/queries'
import { SlotSidebarContext } from '@/lib/slot-sidebar'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Surat Tugas', end: true },
  { to: '/pegawai', label: 'Pegawai', end: false },
  { to: '/pengaturan', label: 'Pengaturan', end: false },
  { to: '/sbm', label: 'Tabel SBM', end: false },
]

const NAV_ADMIN = [
  { to: '/pengguna', label: 'Pengguna', end: false },
  { to: '/sampah', label: 'Tempat Sampah', end: false },
  { to: '/audit', label: 'Log Audit', end: false },
]

function Merek() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">SJ</span>
      <div className="leading-tight">
        <p className="text-base font-bold">SPJAN</p>
        <p className="text-xs text-muted-foreground">SPJ Perjalanan Dinas</p>
      </div>
    </div>
  )
}

function KartuPengguna({
  username,
  nama,
  peran,
  keluar,
  sedangKeluar,
  onGantiPassword,
}: {
  username: string | undefined
  nama: string | undefined
  peran: string | undefined
  keluar: () => void
  sedangKeluar: boolean
  onGantiPassword: () => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
          {(username ?? 'P').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{nama || username || 'Pengguna'}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden /> {peran === 'admin' ? 'Admin' : 'Operator'}
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onGantiPassword}>
          Ganti password
        </Button>
        <Button variant="outline" size="sm" onClick={keluar} disabled={sedangKeluar}>
          Keluar
        </Button>
      </div>
    </div>
  )
}

export function AppShell() {
  const navigate = useNavigate()
  const me = useMe()
  const logout = useLogout()
  const [gantiPw, setGantiPw] = useState(false)
  const [slotSidebar, setSlotSidebar] = useState<HTMLElement | null>(null)
  const menu = me.data?.peran === 'admin' ? [...NAV, ...NAV_ADMIN] : NAV

  async function keluar() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <SlotSidebarContext.Provider value={slotSidebar}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col justify-between border-b border-border bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
          <div className="flex min-h-0 flex-col md:flex-1 md:overflow-y-auto">
            <div className="flex items-center gap-2 px-5 py-4">
              <Merek />
              <ZoomHalaman className="ml-auto md:hidden" />
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setGantiPw(true)}>
                Ganti password
              </Button>
              <Button variant="ghost" size="sm" className="md:hidden" onClick={keluar} disabled={logout.isPending}>
                Keluar
              </Button>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Menu utama">
              {menu.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <div ref={setSlotSidebar} className="hidden px-3 pt-3 pb-3 md:block md:empty:hidden" />
          </div>
          <div className="hidden flex-col gap-3 border-t p-3 md:flex">
            <ZoomHalaman className="w-full" />
            <KartuPengguna username={me.data?.username} nama={me.data?.nama} peran={me.data?.peran} keluar={keluar} sedangKeluar={logout.isPending} onGantiPassword={() => setGantiPw(true)} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
          <Outlet />
        </main>
        <DialogGantiPassword buka={gantiPw} onBukaChange={setGantiPw} />
      </div>
    </SlotSidebarContext.Provider>
  )
}
