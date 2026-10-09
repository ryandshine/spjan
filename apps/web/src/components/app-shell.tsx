import { BookOpenIcon, FileTextIcon, LogOutIcon, SettingsIcon, UserIcon, UsersIcon } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ZoomHalaman } from '@/components/zoom-halaman'
import { useLogout, useMe } from '@/lib/queries'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Surat Tugas', icon: FileTextIcon, end: true },
  { to: '/pegawai', label: 'Pegawai', icon: UsersIcon, end: false },
  { to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon, end: false },
  { to: '/sbm', label: 'Tabel SBM', icon: BookOpenIcon, end: false },
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

function KartuPengguna({ username, keluar, sedangKeluar }: { username: string | undefined; keluar: () => void; sedangKeluar: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
          {username ? username.slice(0, 2).toUpperCase() : <UserIcon className="size-4" />}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{username ?? 'Pengguna'}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden /> Online
          </p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0" onClick={keluar} disabled={sedangKeluar} title="Keluar" aria-label="Keluar">
        <LogOutIcon />
      </Button>
    </div>
  )
}

export function AppShell() {
  const navigate = useNavigate()
  const me = useMe()
  const logout = useLogout()

  async function keluar() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between border-b border-border bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-5 py-4">
            <Merek />
            <ZoomHalaman className="ml-auto md:hidden" />
            <Button variant="ghost" size="icon" className="md:hidden" onClick={keluar} disabled={logout.isPending} title="Keluar" aria-label="Keluar">
              <LogOutIcon />
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Menu utama">
            {NAV.map(({ to, label, icon: Icon, end }) => (
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
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hidden flex-col gap-3 border-t p-3 md:flex">
          <ZoomHalaman className="w-full" />
          <KartuPengguna username={me.data?.username} keluar={keluar} sedangKeluar={logout.isPending} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
