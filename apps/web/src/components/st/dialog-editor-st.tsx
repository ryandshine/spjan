import { useState } from 'react'
import type { Blocker } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { bacaNomorUrutAwal } from '@/lib/st-editor'

function FormNoSpd({
  jumlahPelaksana,
  sufiks,
  onKonfirmasi,
  onBatal,
}: {
  jumlahPelaksana: number
  sufiks: string
  onKonfirmasi: (angkaAwal: number) => void
  onBatal: () => void
}) {
  const [isian, setIsian] = useState('401')
  const [galat, setGalat] = useState<string | null>(null)

  function kirim() {
    const angka = bacaNomorUrutAwal(isian)
    if (angka === null) {
      setGalat('Isi dengan angka lebih dari 0, misalnya 401.')
      return
    }
    onKonfirmasi(angka)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        kirim()
      }}
    >
      <DialogHeader>
        <DialogTitle>Auto-isi nomor SPD</DialogTitle>
        <DialogDescription>
          Nomor diisi berurutan untuk {jumlahPelaksana} pelaksana, contoh: {isian || '401'}
          {sufiks}.
        </DialogDescription>
      </DialogHeader>
      <div className="my-4">
        <Field label="Nomor urut awal" htmlFor="spd-awal" error={galat ?? undefined}>
          <Input id="spd-awal" inputMode="numeric" autoFocus value={isian} onChange={(e) => setIsian(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBatal}>
          Batal
        </Button>
        <Button type="submit">Isi nomor</Button>
      </DialogFooter>
    </form>
  )
}

/** Meminta nomor urut awal SPD; formulir dipasang ulang setiap dialog dibuka sehingga isian dan galat selalu segar. */
export function DialogNoSpd({
  buka,
  onBukaChange,
  jumlahPelaksana,
  sufiks,
  onKonfirmasi,
}: {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  jumlahPelaksana: number
  sufiks: string
  onKonfirmasi: (angkaAwal: number) => void
}) {
  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent>
        <FormNoSpd
          jumlahPelaksana={jumlahPelaksana}
          sufiks={sufiks}
          onKonfirmasi={(angka) => {
            onKonfirmasi(angka)
            onBukaChange(false)
          }}
          onBatal={() => onBukaChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function DialogHapusSt({
  buka,
  onBukaChange,
  nomor,
  menghapus,
  onKonfirmasi,
}: {
  buka: boolean
  onBukaChange: (buka: boolean) => void
  nomor: string
  menghapus: boolean
  onKonfirmasi: () => void
}) {
  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus surat tugas?</DialogTitle>
          <DialogDescription>{nomor} beserta seluruh pelaksana, tujuan perjalanan, dan biayanya akan dihapus permanen.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onBukaChange(false)}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onKonfirmasi} disabled={menghapus}>
            {menghapus ? 'Menghapus...' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Konfirmasi saat pengguna berpindah halaman dengan perubahan yang belum disimpan. */
export function DialogTinggalkanHalaman({ blocker }: { blocker: Blocker }) {
  const tertahan = blocker.state === 'blocked'
  return (
    <Dialog open={tertahan} onOpenChange={(buka) => !buka && tertahan && blocker.reset()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tinggalkan halaman ini?</DialogTitle>
          <DialogDescription>Ada perubahan yang belum disimpan. Jika Anda keluar sekarang, perubahan tersebut akan hilang.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => tertahan && blocker.reset()}>
            Tetap di sini
          </Button>
          <Button variant="destructive" onClick={() => tertahan && blocker.proceed()}>
            Keluar tanpa menyimpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
