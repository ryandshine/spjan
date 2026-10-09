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
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">SJ</span>
          <div className="leading-tight">
            <p className="text-lg font-semibold">SPJAN</p>
            <p className="text-xs text-muted-foreground">SPJ Perjalanan Dinas</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={kirim} className="grid gap-4">
              {galat ? <Alert variant="destructive">{galat}</Alert> : null}
              <Field label="Nama pengguna" htmlFor="username">
                <Input id="username" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label="Kata sandi" htmlFor="password">
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" disabled={login.isPending || !username || !password}>
                {login.isPending ? 'Memeriksa...' : 'Masuk'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
