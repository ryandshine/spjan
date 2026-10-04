import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PegawaiPayloadSchema, STATUS_KODE, STATUS_LABEL, type PegawaiDto, type PegawaiPayload, type StatusKode } from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { pesanGalat } from '@/lib/format'
import { usePegawaiMutations } from '@/lib/queries'

type Galat = Partial<Record<keyof PegawaiPayload, string>>

/** Formulir tambah/ubah pegawai. onSelesai(dto) dipanggil setelah tersimpan, onSelesai(null) saat dibatalkan. */
export function FormPegawai({ awal, onSelesai }: { awal: PegawaiDto | null; onSelesai: (disimpan: PegawaiDto | null) => void }) {
  const { buat, ubah } = usePegawaiMutations()
  const [nama, setNama] = useState(awal?.nama ?? '')
  const [nip, setNip] = useState(awal?.nip ?? '')
  const [jabatan, setJabatan] = useState(awal?.jabatan ?? '')
  const [status, setStatus] = useState<StatusKode | ''>(awal?.status ?? '')
  const [galat, setGalat] = useState<Galat>({})
  const [galatServer, setGalatServer] = useState<string | null>(null)
  const sibuk = buat.isPending || ubah.isPending

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setGalatServer(null)
    const data = { nama: nama.trim(), nip: nip.replace(/\s/g, ''), jabatan: jabatan.trim(), status: status || null }
    const hasil = PegawaiPayloadSchema.safeParse(data)
    if (!hasil.success) {
      const g: Galat = {}
      for (const isu of hasil.error.issues) {
        const kunci = isu.path[0] as keyof PegawaiPayload
        g[kunci] ??= isu.message
      }
      setGalat(g)
      return
    }
    setGalat({})
    try {
      const dto = awal ? await ubah.mutateAsync({ id: awal.id, data: hasil.data }) : await buat.mutateAsync(hasil.data)
      toast.success(awal ? 'Data pegawai diperbarui.' : 'Pegawai ditambahkan.')
      onSelesai(dto)
    } catch (error) {
      setGalatServer(error instanceof ApiError && error.status === 409 ? 'NIP sudah terdaftar.' : pesanGalat(error))
    }
  }

  return (
    <form onSubmit={simpan} className="grid gap-4">
      {galatServer ? <Alert variant="destructive">{galatServer}</Alert> : null}
      <Field label="Nama (dengan gelar)" htmlFor="nama" error={galat.nama}>
        <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
      </Field>
      <Field label="NIP" htmlFor="nip" error={galat.nip} hint="Angka saja, tanpa spasi.">
        <Input id="nip" inputMode="numeric" value={nip} onChange={(e) => setNip(e.target.value)} />
      </Field>
      <Field label="Jabatan" htmlFor="jabatan" error={galat.jabatan}>
        <Input id="jabatan" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
      </Field>
      <Field label="Status / golongan" htmlFor="status" hint="Menentukan batas hotel, uang representasi, dan kelas tiket.">
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusKode | '')}>
          <option value="">- belum dipilih -</option>
          {STATUS_KODE.map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onSelesai(null)}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  )
}
