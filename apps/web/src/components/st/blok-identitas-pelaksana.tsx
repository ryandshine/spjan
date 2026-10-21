import { useState } from 'react'
import { UserPlusIcon } from 'lucide-react'
import {
  INSTANSI_BAWAAN,
  STATUS_KODE,
  STATUS_LABEL,
  pelaksanaDariPegawai,
  type PegawaiDto,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type StatusKode,
} from '@spjan/shared'

import { FormPegawai } from '@/components/pegawai-form'
import { BlokForm } from '@/components/st/blok-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { Select } from '@/components/ui/select'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { tanggalPanjang } from '@/lib/format'
import type { PetaGalat } from '@/lib/validasi'

/** Identitas satu pelaksana: pilihan dari daftar pegawai, nama, NIP, status SBM, dan data SPD. */
export function BlokIdentitasPelaksana({
  nomor,
  p,
  hasil,
  pegawai,
  galat,
  onUbah,
}: {
  nomor: number
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  pegawai: PegawaiDto[]
  galat?: PetaGalat
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
}) {
  const [dialogPegawai, setDialogPegawai] = useState(false)
  const id = (k: string) => `pel-${nomor}-${k}`
  const peringatanKode = (kode: string) => hasil?.peringatan.find((w) => w.kode === kode && w.etape === undefined)?.pesan

  return (
    <>
      <BlokForm judul="Identitas Pelaksana">
        <Field label="Pilih dari daftar pegawai" htmlFor={id('pil')}>
          <div className="flex">
            <Select
              id={id('pil')}
              className="relative rounded-r-none focus-visible:z-10"
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
            <Button variant="outline" className="-ml-px rounded-l-none" onClick={() => setDialogPegawai(true)}>
              <UserPlusIcon /> Pegawai baru
            </Button>
          </div>
        </Field>
        <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Nama (dengan gelar)" htmlFor={id('nama')} error={galat?.nama} mode="wajib">
            <Input id={id('nama')} value={p.nama} onChange={(e) => onUbah((x) => ({ ...x, nama: e.target.value }))} />
          </Field>
          <Field label="NIP" htmlFor={id('nip')} error={galat?.nip} warning={peringatanKode('NIP_KOSONG')} mode="wajib">
            <Input id={id('nip')} inputMode="numeric" value={p.nip} onChange={(e) => onUbah((x) => ({ ...x, nip: e.target.value }))} />
          </Field>
          <Field label="Jabatan" htmlFor={id('jab')} error={galat?.jabatan} mode="opsional">
            <TextareaOtomatis id={id('jab')} value={p.jabatan} onChange={(e) => onUbah((x) => ({ ...x, jabatan: e.target.value }))} />
          </Field>
          <Field
            label="Instansi"
            htmlFor={id('instansi')}
            error={galat?.instansi}
            mode="otomatis"
            otomatisAktif={!p.instansi || p.instansi === INSTANSI_BAWAAN}
            onKembaliOtomatis={() => onUbah((x) => ({ ...x, instansi: INSTANSI_BAWAAN }))}
          >
            <TextareaOtomatis id={id('instansi')} value={p.instansi ?? ''} onChange={(e) => onUbah((x) => ({ ...x, instansi: e.target.value }))} />
          </Field>
          <Field label="Pangkat / golongan" htmlFor={id('pangkat')} error={galat?.pangkatGolongan} mode="opsional" hint="Mis. Penata Muda - III/a atau Ahli Pertama - IX.">
            <TextareaOtomatis id={id('pangkat')} value={p.pangkatGolongan ?? ''} onChange={(e) => onUbah((x) => ({ ...x, pangkatGolongan: e.target.value }))} />
          </Field>
          <Field label="Status (kelompok SBM)" htmlFor={id('status')} error={galat?.status} warning={peringatanKode('STATUS_PEGAWAI_KOSONG')} mode="wajib">
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
          <Field label="No. SPD" htmlFor={id('spd')} warning={peringatanKode('NO_SPD_KOSONG')} mode="wajib">
            <Input
              id={id('spd')}
              placeholder="contoh: 401/SPD/PPS/2026"
              value={p.noSpd ?? ''}
              onChange={(e) => onUbah((x) => ({ ...x, noSpd: e.target.value || null }))}
            />
          </Field>
          <Field
            label="Tanggal SPD"
            htmlFor={id('tgl-spd')}
            mode="otomatis"
            otomatisAktif={!p.tanggalSpd}
            onKembaliOtomatis={() => onUbah((x) => ({ ...x, tanggalSpd: null }))}
            hint={tanggalPanjang(p.tanggalSpd) || 'Otomatis: sama dengan tanggal surat tugas.'}
          >
            <InputTanggal id={id('tgl-spd')} label="Tanggal SPD" nilai={p.tanggalSpd} onUbah={(iso) => onUbah((x) => ({ ...x, tanggalSpd: iso }))} />
          </Field>
        </div>
      </BlokForm>

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
    </>
  )
}
