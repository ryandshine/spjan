import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useLogin, useMe } from '@/lib/queries'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const me = useMe()
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const dari = (location.state as { dari?: string } | null)?.dari ?? '/'

  if (me.data) return <Navigate to={dari} replace />

  async function kirim(e: FormEvent) {
    e.preventDefault()
    try {
      await login.mutateAsync({ username: username.trim(), password })
      navigate(dari, { replace: true })
    } catch {
      /* pesan galat ditampilkan dari login.error */
    }
  }

  const galat =
    login.error instanceof ApiError
      ? login.error.status === 429
        ? 'Terlalu banyak percobaan. Coba lagi sebentar lagi.'
        : login.error.message
      : login.error
        ? 'Tidak dapat menghubungi server.'
        : null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      {/* Latar Belakang Gambar Penuh dengan Overlay Sinematik */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 ease-out"
        style={{ backgroundImage: "url('/login-bg.webp')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden="true" />

      {/* Kartu Login Elegan Mengambang */}
      <div className="relative z-10 w-full max-w-sm">
        <Card className="border-white/15 bg-background/95 shadow-2xl backdrop-blur-md">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/50 p-2 shadow-inner">
              <img src="/logo-spjan.png" alt="Logo SPJAN" className="size-10 object-contain drop-shadow-sm" />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight">SPJAN</CardTitle>
            <p className="text-xs font-medium text-muted-foreground">Sistem Pertanggungjawaban Perjalanan Dinas</p>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={kirim} className="grid gap-4">
              {galat ? <Alert variant="destructive">{galat}</Alert> : null}
              <Field label="Nama pengguna" htmlFor="username">
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  placeholder="Masukkan nama pengguna"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field label="Kata sandi" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" className="mt-1 h-10 w-full font-semibold" disabled={login.isPending || !username || !password}>
                {login.isPending ? 'Memeriksa...' : 'Masuk'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Catatan / Kutipan Bawah */}
        <p className="mt-4 text-center text-xs text-white/70 drop-shadow">
          “Melangkah menuntaskan amanah, menembus jarak dan waktu.”
        </p>
      </div>
    </div>
  )
}
