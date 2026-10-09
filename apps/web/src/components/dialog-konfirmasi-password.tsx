import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { pesanGalat } from '@/lib/format'

/**
 * Konfirmasi aksi berbahaya (hapus, buka kunci) dengan password pengguna yang sedang login.
 * Galat dari server (mis. password salah) tampil di dalam dialog; dialog menutup setelah `onKonfirmasi` berhasil.
 */
export function DialogKonfirmasiPassword({
  buka,
  onBukaChange,
  judul,
  deskripsi,
  labelAksi,
  bahaya = false,
  perluAlasan = false,
  onKonfirmasi,
}: {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  judul: string
  deskripsi: string
  labelAksi: string
  bahaya?: boolean
  /** Minta alasan tertulis (dicatat di log audit). */
  perluAlasan?: boolean
  onKonfirmasi: (v: { password: string; alasan: string }) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  const alasanKurang = perluAlasan && alasan.trim().length < 5

  function ubahBuka(b: boolean) {
    if (!b) {
      setPassword('')
      setAlasan('')
      setGalat(null)
    }
    onBukaChange(b)
  }

  async function kirim() {
    setMemproses(true)
    setGalat(null)
    try {
      await onKonfirmasi({ password, alasan: alasan.trim() })
      ubahBuka(false)
    } catch (error) {
      setGalat(pesanGalat(error))
      setPassword('')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <Dialog open={buka} onOpenChange={ubahBuka}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (password && !alasanKurang && !memproses) void kirim()
          }}
        >
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            <DialogDescription>{deskripsi}</DialogDescription>
          </DialogHeader>
          {perluAlasan ? (
            <div className="grid gap-1.5">
              <Label htmlFor="konfirmasi-alasan">Alasan (minimal 5 karakter)</Label>
              <Textarea id="konfirmasi-alasan" rows={2} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: revisi nominal tiket" />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="konfirmasi-password">Password Anda</Label>
            <Input
              id="konfirmasi-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={galat !== null}
            />
            {galat ? (
              <p role="alert" className="text-xs text-destructive">
                {galat}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => ubahBuka(false)}>
              Batal
            </Button>
            <Button type="submit" variant={bahaya ? 'destructive' : 'default'} disabled={!password || alasanKurang || memproses}>
              {memproses ? 'Memproses...' : labelAksi}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
