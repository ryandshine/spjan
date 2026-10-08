import { BookOpenIcon, FileTextIcon, LogOutIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useLogout, useMe } from '@/lib/queries'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Surat Tugas', icon: FileTextIcon, end: true },
  { to: '/pegawai', label: 'Pegawai', icon: UsersIcon, end: false },
  { to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon, end: false },
  { to: '/sbm', label: 'Tabel SBM', icon: BookOpenIcon, end: false },
]

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
      <aside className="flex shrink-0 flex-col border-b bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">SJ</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">SPJAN</p>
            <p className="text-xs text-muted-foreground">SPJ Perjalanan Dinas</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={keluar} disabled={logout.isPending} aria-label="Keluar">
            <LogOutIcon />
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center justify-between gap-2 border-t px-4 py-3 md:flex">
          <span className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">{me.data?.username}</span>
          <Button variant="ghost" size="sm" onClick={keluar} disabled={logout.isPending}>
            <LogOutIcon /> Keluar
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
