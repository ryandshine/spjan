import { useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, RotateCcwIcon, UserXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PegawaiPayloadSchema, STATUS_KODE, STATUS_LABEL, type PegawaiDto, type PegawaiPayload, type StatusKode } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { pesanGalat } from '@/lib/format'
import { usePegawai, usePegawaiMutations } from '@/lib/queries'

type Galat = Partial<Record<keyof PegawaiPayload, string>>

function FormPegawai({ awal, onSelesai }: { awal: PegawaiDto | null; onSelesai: () => void }) {
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
      if (awal) await ubah.mutateAsync({ id: awal.id, data: hasil.data })
      else await buat.mutateAsync(hasil.data)
      toast.success(awal ? 'Data pegawai diperbarui.' : 'Pegawai ditambahkan.')
      onSelesai()
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
        <Button variant="outline" onClick={onSelesai}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function PegawaiPage() {
  const [tampilNonaktif, setTampilNonaktif] = useState(false)
  const daftar = usePegawai(!tampilNonaktif)
  const { ubah, nonaktifkan } = usePegawaiMutations()
  const [dialog, setDialog] = useState<{ pegawai: PegawaiDto | null } | null>(null)

  async function nonaktif(p: PegawaiDto) {
    try {
      await nonaktifkan.mutateAsync(p.id)
      toast.success(`${p.nama} dinonaktifkan.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }
  async function aktifkan(p: PegawaiDto) {
    try {
      await ubah.mutateAsync({ id: p.id, data: {} })
      toast.success(`${p.nama} diaktifkan kembali.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<PegawaiDto>[] = [
    { judul: 'Nama', teks: (p) => p.nama, sel: (p) => <span className="font-medium">{p.nama}</span> },
    { judul: 'NIP', teks: (p) => p.nip, sel: (p) => <span className="tabular-nums">{p.nip}</span> },
    { judul: 'Jabatan', teks: (p) => p.jabatan, sel: (p) => p.jabatan || '-' },
    {
      judul: 'Status',
      teks: (p) => (p.status ? STATUS_LABEL[p.status] : ''),
      sel: (p) => (p.status ? <Badge>{STATUS_LABEL[p.status]}</Badge> : <Badge variant="warning">Belum dipilih</Badge>),
    },
    {
      judul: '',
      sel: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Ubah ${p.nama}`} onClick={() => setDialog({ pegawai: p })}>
            <PencilIcon />
          </Button>
          {p.aktif ? (
            <Button variant="ghost" size="icon" aria-label={`Nonaktifkan ${p.nama}`} onClick={() => nonaktif(p)}>
              <UserXIcon className="text-destructive" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label={`Aktifkan ${p.nama}`} onClick={() => aktifkan(p)}>
              <RotateCcwIcon />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pegawai"
        description="Data pegawai disimpan permanen dan dipilih saat menyusun surat tugas."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
              Tampilkan nonaktif
            </label>
            <Button onClick={() => setDialog({ pegawai: null })}>
              <PlusIcon /> Tambah pegawai
            </Button>
          </>
        }
      />
      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat...' : tampilNonaktif ? 'Tidak ada pegawai nonaktif.' : 'Belum ada pegawai.'}
        />
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.pegawai ? 'Ubah pegawai' : 'Tambah pegawai'}</DialogTitle>
            <DialogDescription>NIP harus unik. Status dapat diubah kapan saja; surat tugas lama tidak ikut berubah.</DialogDescription>
          </DialogHeader>
          {dialog ? <FormPegawai awal={dialog.pegawai} onSelesai={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
