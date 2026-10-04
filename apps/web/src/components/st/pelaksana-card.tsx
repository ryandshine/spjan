import { useState } from 'react'
import { PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import {
  STATUS_KODE,
  STATUS_LABEL,
  biayaKosong,
  etapeKosong,
  indeksBarisTransport,
  norm,
  pelaksanaDariPegawai,
  type BiayaPayload,
  type EtapePayload,
  type PegawaiDto,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
  type StatusKode,
} from '@spjan/shared'

import { FormPegawai } from '@/components/pegawai-form'
import { BiayaForm } from '@/components/st/biaya-form'
import { EtapeForm } from '@/components/st/etape-form'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'

export function PelaksanaCard({
  nomor,
  p,
  hasil,
  sbm,
  pegawai,
  provinsi,
  onUbah,
  onHapus,
}: {
  nomor: number
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  sbm: Sbm
  pegawai: PegawaiDto[]
  provinsi: string[]
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  onHapus: () => void
}) {
  const [dialogPegawai, setDialogPegawai] = useState(false)
  const id = (k: string) => `pel-${nomor}-${k}`
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined
  const indeks = indeksBarisTransport(p.biaya)

  const ubahEtape = (i: number, patch: Partial<EtapePayload>) =>
    onUbah((x) => ({ ...x, etape: x.etape.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))
  const ubahBiaya = (i: number, patch: Partial<BiayaPayload>) =>
    onUbah((x) => ({ ...x, biaya: x.biaya.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  const tambahBiaya = (b: BiayaPayload) => onUbah((x) => ({ ...x, biaya: [...x.biaya, b] }))

  function tambahTiketPergi() {
    const sudah = p.biaya.filter((b) => b.jenis === 'TIKET_PERGI').length
    tambahBiaya({ ...biayaKosong('TIKET_PERGI'), etapeIndex: sudah < p.etape.length ? sudah : null })
  }

  const batasHotel = (e: EtapePayload): number | null => {
    if (!cfg) return null
    return sbm.penginapan[norm(e.provinsi)]?.[cfg.kolomHotel - 1] ?? null
  }

  const umum = hasil?.peringatan.filter((w) => w.etape === undefined) ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>
          Pelaksana {nomor}
          {p.nama ? <span className="ml-2 font-normal text-muted-foreground">{p.nama}</span> : null}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onHapus}>
          <Trash2Icon className="text-destructive" /> Hapus pelaksana
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Pilih dari daftar pegawai" htmlFor={id('pil')} className="min-w-64 flex-1">
              <Select
                id={id('pil')}
                value={p.pegawaiId ?? ''}
                onChange={(e) => {
                  const dto = pegawai.find((g) => g.id === Number(e.target.value))
                  if (dto) onUbah((x) => pelaksanaDariPegawai(x, dto))
                  else onUbah((x) => ({ ...x, pegawaiId: null }))
                }}
              >
                <option value="">- ketik manual di bawah -</option>
                {pegawai.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="outline" onClick={() => setDialogPegawai(true)}>
              <UserPlusIcon /> Pegawai baru
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nama (dengan gelar)" htmlFor={id('nama')} className="lg:col-span-2">
              <Input id={id('nama')} value={p.nama} onChange={(e) => onUbah((x) => ({ ...x, nama: e.target.value }))} />
            </Field>
            <Field label="NIP" htmlFor={id('nip')}>
              <Input id={id('nip')} inputMode="numeric" value={p.nip} onChange={(e) => onUbah((x) => ({ ...x, nip: e.target.value }))} />
            </Field>
            <Field label="No. SPD" htmlFor={id('spd')}>
              <Input id={id('spd')} value={p.noSpd ?? ''} onChange={(e) => onUbah((x) => ({ ...x, noSpd: e.target.value || null }))} />
            </Field>
            <Field label="Jabatan" htmlFor={id('jab')} className="lg:col-span-2">
              <Input id={id('jab')} value={p.jabatan} onChange={(e) => onUbah((x) => ({ ...x, jabatan: e.target.value }))} />
            </Field>
            <Field label="Status / golongan" htmlFor={id('status')} className="lg:col-span-2">
              <Select
                id={id('status')}
                value={p.status ?? ''}
                onChange={(e) => onUbah((x) => ({ ...x, status: (e.target.value || null) as StatusKode | null }))}
              >
                <option value="">- belum dipilih -</option>
                {STATUS_KODE.map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Perjalanan (satu etape per kota tujuan)</h3>
          {p.etape.map((e, i) => (
            <EtapeForm
              key={i}
              idAwal={`${nomor}-${i + 1}`}
              nomor={i + 1}
              etape={e}
              provinsi={provinsi}
              bolehRepresentasi={(cfg?.barisRepresentasi ?? 0) > 0}
              batasHotel={batasHotel(e)}
              peringatan={hasil?.peringatan.filter((w) => w.etape === i) ?? []}
              bisaHapus={p.etape.length > 1}
              onUbah={(patch) => ubahEtape(i, patch)}
              onHapus={() =>
                onUbah((x) => ({
                  ...x,
                  etape: x.etape.filter((_, j) => j !== i),
                  biaya: x.biaya.map((b) => (b.etapeIndex != null && b.etapeIndex >= i ? { ...b, etapeIndex: b.etapeIndex === i ? null : b.etapeIndex - 1 } : b)),
                }))
              }
            />
          ))}
          <div>
            <Button variant="outline" size="sm" onClick={() => onUbah((x) => ({ ...x, etape: [...x.etape, etapeKosong()] }))}>
              <PlusIcon /> Tambah etape (kota lain)
            </Button>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Biaya transport dan biaya tambahan</h3>
          {p.biaya.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada biaya. Tambahkan tiket, taksi, atau biaya lain.</p> : null}
          {p.biaya.map((b, i) => (
            <BiayaForm
              key={i}
              biaya={b}
              etapeJumlah={p.etape.length}
              etapeLabel={(k) => `Etape ${k + 1}${p.etape[k]?.kota ? ` - ${p.etape[k]?.kota}` : ''}`}
              provinsi={provinsi}
              baris={indeks[i] != null ? hasil?.transport[indeks[i] as number] : null}
              onUbah={(patch) => ubahBiaya(i, patch)}
              onHapus={() => onUbah((x) => ({ ...x, biaya: x.biaya.filter((_, j) => j !== i) }))}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={tambahTiketPergi}>
              <PlusIcon /> Tiket pergi
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('TIKET_KEMBALI'))}>
              <PlusIcon /> Tiket kembali
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('TAKSI_KEDUDUKAN'))}>
              <PlusIcon /> Taksi dari kedudukan
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('LAINNYA'))}>
              <PlusIcon /> Biaya lain
            </Button>
          </div>
        </section>

        {hasil ? (
          <section className="grid gap-3 border-t pt-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              {(
                [
                  ['Transport', hasil.totalTransport],
                  ['Uang harian', hasil.totalUangHarian],
                  ['Representasi', hasil.totalRepresentasi],
                  ['Penginapan', hasil.totalPenginapan],
                ] as const
              ).map(([label, nilai]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{rupiah(nilai)}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">{hasil.terbilang}</span>
              <span className="text-lg font-semibold tabular-nums">{rupiah(hasil.total)}</span>
            </div>
            {umum.length > 0 ? (
              <Alert variant="warning">
                <ul className="grid gap-0.5">
                  {umum.map((w, i) => (
                    <li key={i}>{w.pesan}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            {hasil.catatan.length > 0 ? (
              <ul className="grid gap-0.5 text-xs text-muted-foreground">
                {hasil.catatan.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </CardContent>

      <Dialog open={dialogPegawai} onOpenChange={setDialogPegawai}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pegawai baru</DialogTitle>
            <DialogDescription>Disimpan permanen di daftar pegawai dan langsung dipakai pada pelaksana ini.</DialogDescription>
          </DialogHeader>
          <FormPegawai
            awal={null}
            onSelesai={(dto) => {
              if (dto) onUbah((x) => pelaksanaDariPegawai(x, dto))
              setDialogPegawai(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
