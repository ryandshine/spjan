import { useState } from 'react'
import { KeyRoundIcon, PlusIcon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { BuatPenggunaDariPegawaiSchema, BuatPenggunaManualSchema, PERAN, type PenggunaDto, type Peran } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { pesanGalat, tanggalPendek } from '@/lib/format'
import { useMe, usePegawai, usePengguna, usePenggunaMutations } from '@/lib/queries'

const LABEL_PERAN: Record<Peran, string> = { admin: 'Admin', operator: 'Operator' }

function DialogBuat({ buka, onBukaChange, pegawaiAwal }: { buka: boolean; onBukaChange: (b: boolean) => void; pegawaiAwal: number | null }) {
  const { buat } = usePenggunaMutations()
  const pegawai = usePegawai(true)
  const tanpaAkun = (pegawai.data ?? []).filter((p) => !p.punyaAkun)
  const [manual, setManual] = useState(false)
  const [pegawaiId, setPegawaiId] = useState<number | null>(pegawaiAwal)
  const [form, setForm] = useState({ username: '', nama: '', peran: 'operator' as Peran, password: '' })
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim() {
    const cek = manual
      ? BuatPenggunaManualSchema.safeParse(form)
      : BuatPenggunaDariPegawaiSchema.safeParse({ pegawaiId, peran: form.peran, password: form.password })
    if (!cek.success) return setGalat(!manual && pegawaiId === null ? 'Pilih pegawai dulu.' : (cek.error.issues[0]?.message ?? 'Isian belum benar.'))
    try {
      const dto = await buat.mutateAsync(cek.data)
      toast.success(`Akun ${dto.nama} dibuat. Login dengan ${dto.username}.`)
      setForm({ username: '', nama: '', peran: 'operator', password: '' })
      setPegawaiId(null)
      setGalat(null)
      onBukaChange(false)
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  return (
    <Dialog open={buka} onOpenChange={onBukaChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void kirim()
          }}
        >
          <DialogHeader>
            <DialogTitle>Tambah pengguna</DialogTitle>
            <DialogDescription>
              Akun dibuat dari data pegawai: nama dan NIP ikut data pegawai, dan login memakai NIP. Berikan password awal; pengguna bisa menggantinya sendiri.
            </DialogDescription>
          </DialogHeader>
          {manual ? (
            <>
              <Field label="Username" htmlFor="pg-username" mode="wajib" hint="Huruf kecil, angka, titik, garis bawah, atau strip.">
                <Input id="pg-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Nama lengkap" htmlFor="pg-nama" mode="wajib">
                <Input id="pg-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
              </Field>
            </>
          ) : (
            <Field
              label="Pegawai"
              htmlFor="pg-pegawai"
              mode="wajib"
              hint={tanpaAkun.length === 0 && !pegawai.isPending ? 'Semua pegawai aktif sudah punya akun. Tambah pegawai di menu Pegawai.' : undefined}
            >
              <Select id="pg-pegawai" value={pegawaiId ?? ''} onChange={(e) => setPegawaiId(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">- pilih pegawai -</option>
                {tanpaAkun.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.nip})
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Peran" htmlFor="pg-peran" mode="wajib" hint="Operator menyusun SPJ dan hanya mengubah surat tugas buatannya. Admin bisa semuanya.">
            <Select id="pg-peran" value={form.peran} onChange={(e) => setForm({ ...form, peran: e.target.value as Peran })}>
              {PERAN.map((p) => (
                <option key={p} value={p}>
                  {LABEL_PERAN[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Password awal" htmlFor="pg-password" mode="wajib" hint="Minimal 10 karakter.">
            <Input id="pg-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <button type="button" className="justify-self-start text-xs text-primary underline-offset-2 hover:underline" onClick={() => setManual((m) => !m)}>
            {manual ? 'Kembali: pilih dari data pegawai' : 'Akun sistem tanpa pegawai (khusus)'}
          </button>
          {galat ? <Alert variant="destructive">{galat}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onBukaChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={buat.isPending}>
              {buat.isPending ? 'Menyimpan...' : 'Tambah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DialogReset({ target, onTutup }: { target: PenggunaDto | null; onTutup: () => void }) {
  const { resetPassword } = usePenggunaMutations()
  const [password, setPassword] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim() {
    if (!target) return
    if (password.length < 10) return setGalat('Minimal 10 karakter.')
    try {
      await resetPassword.mutateAsync({ id: target.id, password })
      toast.success(`Password ${target.username} direset; semua sesinya keluar.`)
      setPassword('')
      setGalat(null)
      onTutup()
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(b) => !b && onTutup()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void kirim()
          }}
        >
          <DialogHeader>
            <DialogTitle>Reset password {target?.username}</DialogTitle>
            <DialogDescription>Semua sesi login akun ini akan keluar. Sampaikan password baru kepada pengguna.</DialogDescription>
          </DialogHeader>
          <Field label="Password baru" htmlFor="rp-password" mode="wajib" hint="Minimal 10 karakter.">
            <Input id="rp-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {galat ? <Alert variant="destructive">{galat}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button type="submit" disabled={resetPassword.isPending}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function PenggunaPage() {
  const daftar = usePengguna()
  const me = useMe()
  const { ubah } = usePenggunaMutations()
  const lokasi = useLocation()
  const awalId = (lokasi.state as { pegawaiId?: number } | null)?.pegawaiId ?? null
  const [buat, setBuat] = useState(awalId !== null)
  const [reset, setReset] = useState<PenggunaDto | null>(null)

  async function simpan(p: PenggunaDto, data: { peran?: Peran; aktif?: boolean }) {
    try {
      await ubah.mutateAsync({ id: p.id, data })
      toast.success(`Akun ${p.username} diperbarui.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<PenggunaDto>[] = [
    { judul: 'Nama', teks: (p) => p.nama, sel: (p) => <span className="font-medium">{p.nama}</span> },
    { judul: 'Username (NIP)', teks: (p) => p.username, sel: (p) => <span className="tabular-nums">{p.username}</span> },
    { judul: 'Pegawai', sel: (p) => (p.pegawaiId !== null ? <Badge variant="muted">Terhubung</Badge> : <span className="text-muted-foreground">Akun sistem</span>) },
    {
      judul: 'Peran',
      sel: (p) => (
        <Select
          aria-label={`Peran ${p.username}`}
          className="h-8 w-32"
          value={p.peran}
          disabled={ubah.isPending}
          onChange={(e) => void simpan(p, { peran: e.target.value as Peran })}
        >
          {PERAN.map((r) => (
            <option key={r} value={r}>
              {LABEL_PERAN[r]}
            </option>
          ))}
        </Select>
      ),
    },
    { judul: 'Status', sel: (p) => (p.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Nonaktif</Badge>) },
    { judul: 'Dibuat', sel: (p) => <span className="text-muted-foreground">{tanggalPendek(p.createdAt.slice(0, 10))}</span> },
    {
      judul: '',
      sel: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => setReset(p)}>
            <KeyRoundIcon className="size-3.5" /> Reset password
          </Button>
          <Button variant="ghost" size="sm" disabled={p.id === me.data?.id && p.aktif} title={p.id === me.data?.id ? 'Tidak bisa menonaktifkan akun sendiri' : undefined} onClick={() => void simpan(p, { aktif: !p.aktif })}>
            {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description="Satu orang satu akun. Operator hanya mengubah surat tugas buatannya; admin bisa semuanya."
        actions={
          <Button onClick={() => setBuat(true)}>
            <PlusIcon /> Tambah pengguna
          </Button>
        }
      />
      {daftar.isError ? <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert> : <DataTable kolom={kolom} baris={daftar.data ?? []} kosong={daftar.isPending ? 'Memuat...' : 'Belum ada pengguna.'} />}
      <DialogBuat key={awalId ?? 'baru'} buka={buat} onBukaChange={setBuat} pegawaiAwal={awalId} />
      <DialogReset target={reset} onTutup={() => setReset(null)} />
    </div>
  )
}
