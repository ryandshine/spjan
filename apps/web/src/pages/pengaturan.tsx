import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PengaturanSchema, type PengaturanPayload } from '@spjan/shared'

import { ModelAiCard } from '@/components/model-ai-card'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { pesanGalat } from '@/lib/format'
import { useMe, usePengaturan, useSbm, useSimpanPengaturan, useVersiSbm } from '@/lib/queries'

type Galat = Partial<Record<keyof PengaturanPayload, string>>

function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{judul}</CardTitle>
      </CardHeader>
      <CardContent className="grid items-start gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

function FormPengaturan({ awal, admin }: { awal: PengaturanPayload; admin: boolean }) {
  const simpanMut = useSimpanPengaturan()
  const versi = useVersiSbm()
  const sbm = useSbm(versi.data?.[0]?.id)
  const provinsi = Object.keys(sbm.data?.data.uangHarian ?? {})
  const [form, setForm] = useState<PengaturanPayload>(awal)
  const [galat, setGalat] = useState<Galat>({})
  const [galatServer, setGalatServer] = useState<string | null>(null)

  const set = <K extends keyof PengaturanPayload>(k: K, v: PengaturanPayload[K]) => setForm((f) => ({ ...f, [k]: v }))
  const teks = (k: keyof PengaturanPayload, label: string, opsi?: { hint?: string; opsional?: boolean; kelas?: string; wajib?: boolean }) => (
    <Field label={label} htmlFor={k} error={galat[k]} hint={opsi?.hint} className={opsi?.kelas} mode={opsi?.wajib ? 'wajib' : undefined}>
      <Input
        id={k}
        value={(form[k] as string | null | undefined) ?? ''}
        onChange={(e) => set(k, (opsi?.opsional && e.target.value === '' ? null : e.target.value) as never)}
      />
    </Field>
  )

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setGalatServer(null)
    const hasil = PengaturanSchema.safeParse(form)
    if (!hasil.success) {
      const g: Galat = {}
      for (const isu of hasil.error.issues) g[isu.path[0] as keyof PengaturanPayload] ??= isu.message
      setGalat(g)
      toast.error('Periksa isian yang bertanda merah.')
      return
    }
    setGalat({})
    try {
      await simpanMut.mutateAsync(hasil.data)
      toast.success('Pengaturan disimpan.')
    } catch (error) {
      setGalatServer(pesanGalat(error))
    }
  }

  const tombolSimpan = (kelas?: string) => (
    <Button type="submit" form="form-pengaturan" className={kelas} disabled={simpanMut.isPending}>
      {simpanMut.isPending ? 'Menyimpan...' : 'Simpan pengaturan'}
    </Button>
  )

  return (
    <div>
      <PageHeader
        lengket
        title="Pengaturan"
        description="Data satuan kerja, pejabat, dan model pembaca dokumen yang dipakai di semua surat tugas."
        actions={admin ? tombolSimpan('hidden md:inline-flex') : null}
      />
      {admin ? null : <Alert className="mb-5">Hanya admin yang dapat mengubah pengaturan. Anda bisa melihatnya saja.</Alert>}
      <fieldset disabled={!admin} className="m-0 min-w-0 border-0 p-0">
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <form id="form-pengaturan" onSubmit={simpan} className="grid gap-6">
            {galatServer ? <Alert variant="destructive">{galatServer}</Alert> : null}
            <Bagian judul="Satuan kerja">
              {teks('kodeSatker', 'Kode satker')}
              <Field label="Tahun anggaran" htmlFor="tahunAnggaran" error={galat.tahunAnggaran} mode="wajib">
                <Input
                  id="tahunAnggaran"
                  type="number"
                  inputMode="numeric"
                  value={form.tahunAnggaran}
                  onChange={(e) => set('tahunAnggaran', Number(e.target.value))}
                />
              </Field>
              {teks('namaSatker', 'Nama satker', { kelas: 'sm:col-span-2' })}
              {teks('dasarDipa', 'Tanggal dan nomor DIPA', { kelas: 'sm:col-span-2' })}
              {teks('kodeAkunDefault', 'Kode akun (mata anggaran) bawaan', { kelas: 'sm:col-span-2' })}
            </Bagian>
            <Bagian judul="Pejabat penandatangan">
              {teks('ppkNama', 'Pejabat Pembuat Komitmen - nama')}
              {teks('ppkNip', 'Pejabat Pembuat Komitmen - NIP', { hint: 'Tulis seperti yang tercetak, mis. NIP. 19740218 200212 1 003' })}
              {teks('bendaharaNama', 'Bendahara Pengeluaran Pembantu - nama')}
              {teks('bendaharaNip', 'Bendahara Pengeluaran Pembantu - NIP')}
              {teks('pjNama', 'Pejabat yang bertanggung jawab - nama')}
              {teks('pjNip', 'Pejabat yang bertanggung jawab - NIP')}
              {teks('pjJabatan', 'Pejabat yang bertanggung jawab - jabatan', { kelas: 'sm:col-span-2' })}
              {teks('pembuatDaftarNama', 'Pembuat daftar - nama (opsional)', { opsional: true, hint: 'Kosong = pelaksana pertama pada surat tugas.' })}
              {teks('pembuatDaftarNip', 'Pembuat daftar - NIP (opsional)', { opsional: true })}
            </Bagian>
            <Bagian judul="Tempat kedudukan">
              {teks('kotaKedudukan', 'Kota tempat kedudukan', { wajib: true })}
              <Field label="Provinsi tempat kedudukan" htmlFor="provinsiKedudukan" error={galat.provinsiKedudukan} mode="wajib">
                {provinsi.length > 0 ? (
                  <Select id="provinsiKedudukan" value={form.provinsiKedudukan} onChange={(e) => set('provinsiKedudukan', e.target.value)}>
                    {!provinsi.includes(form.provinsiKedudukan) ? <option value={form.provinsiKedudukan}>{form.provinsiKedudukan}</option> : null}
                    {provinsi.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id="provinsiKedudukan" value={form.provinsiKedudukan} onChange={(e) => set('provinsiKedudukan', e.target.value)} />
                )}
              </Field>
            </Bagian>
            {admin ? <div className="md:hidden">{tombolSimpan()}</div> : null}
          </form>
          <div className="xl:sticky xl:top-24">
            <ModelAiCard />
          </div>
        </div>
      </fieldset>
    </div>
  )
}

export default function PengaturanPage() {
  const data = usePengaturan()
  const me = useMe()
  if (data.data) return <FormPengaturan awal={data.data} admin={me.data?.peran === 'admin'} />
  return (
    <div>
      <PageHeader title="Pengaturan" />
      {data.isError ? <Alert variant="destructive">{pesanGalat(data.error)}</Alert> : <p className="text-sm text-muted-foreground">Memuat...</p>}
    </div>
  )
}
