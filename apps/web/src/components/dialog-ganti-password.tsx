import { useState } from 'react'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { pesanGalat } from '@/lib/format'
import { useGantiPassword } from '@/lib/queries'

export function DialogGantiPassword({ buka, onBukaChange }: { buka: boolean; onBukaChange: (b: boolean) => void }) {
  const ganti = useGantiPassword()
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  function tutup(b: boolean) {
    if (!b) {
      setLama('')
      setBaru('')
      setUlang('')
      setGalat(null)
    }
    onBukaChange(b)
  }

  async function kirim() {
    if (baru.length < 10) return setGalat('Password baru minimal 10 karakter.')
    if (baru !== ulang) return setGalat('Ulangi password baru dengan sama persis.')
    try {
      await ganti.mutateAsync({ passwordLama: lama, passwordBaru: baru })
      toast.success('Password diganti. Sesi di perangkat lain keluar.')
      tutup(false)
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  return (
    <Dialog open={buka} onOpenChange={tutup}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void kirim()
          }}
        >
          <DialogHeader>
            <DialogTitle>Ganti password</DialogTitle>
            <DialogDescription>Password dipakai juga untuk mengonfirmasi hapus dan buka kunci.</DialogDescription>
          </DialogHeader>
          <Field label="Password lama" htmlFor="gp-lama" mode="wajib">
            <Input id="gp-lama" type="password" autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} />
          </Field>
          <Field label="Password baru" htmlFor="gp-baru" mode="wajib" hint="Minimal 10 karakter.">
            <Input id="gp-baru" type="password" autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} />
          </Field>
          <Field label="Ulangi password baru" htmlFor="gp-ulang" mode="wajib">
            <Input id="gp-ulang" type="password" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} />
          </Field>
          {galat ? <Alert variant="destructive">{galat}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => tutup(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={ganti.isPending || !lama || !baru}>
              {ganti.isPending ? 'Menyimpan...' : 'Ganti password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
