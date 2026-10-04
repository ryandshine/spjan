import { Trash2Icon } from 'lucide-react'
import { ringkasEtape, type EtapePayload, type Peringatan } from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { rupiah } from '@/lib/format'

export function EtapeForm({
  idAwal,
  nomor,
  etape,
  provinsi,
  bolehRepresentasi,
  batasHotel,
  peringatan,
  bisaHapus,
  onUbah,
  onHapus,
}: {
  /** Awalan id elemen agar unik di antara beberapa pelaksana. */
  idAwal: string
  nomor: number
  etape: EtapePayload
  provinsi: string[]
  bolehRepresentasi: boolean
  batasHotel: number | null
  peringatan: Peringatan[]
  bisaHapus: boolean
  onUbah: (patch: Partial<EtapePayload>) => void
  onHapus: () => void
}) {
  const { hari, malam } = ringkasEtape(etape)
  const id = (k: string) => `etape-${idAwal}-${k}`
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Etape {nomor}</h4>
          {hari !== null ? (
            <Badge variant="muted">
              {hari} hari / {malam} malam
            </Badge>
          ) : null}
        </div>
        {bisaHapus ? (
          <Button variant="ghost" size="sm" onClick={onHapus} aria-label={`Hapus etape ${nomor}`}>
            <Trash2Icon className="text-destructive" /> Hapus etape
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Provinsi tujuan" htmlFor={id('prov')}>
          <Select id={id('prov')} value={etape.provinsi} onChange={(e) => onUbah({ provinsi: e.target.value })}>
            <option value="">- pilih provinsi -</option>
            {provinsi.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kota tujuan" htmlFor={id('kota')} hint="Dipakai pada uraian tiket.">
          <Input id={id('kota')} value={etape.kota} onChange={(e) => onUbah({ kota: e.target.value })} />
        </Field>
        <Field label="Berangkat" htmlFor={id('brkt')}>
          <Input id={id('brkt')} type="date" value={etape.berangkat} onChange={(e) => onUbah({ berangkat: e.target.value })} />
        </Field>
        <Field label="Pulang" htmlFor={id('plg')}>
          <Input id={id('plg')} type="date" value={etape.pulang} onChange={(e) => onUbah({ pulang: e.target.value })} />
        </Field>
      </div>
      <Field label="Kegiatan / tujuan (untuk uraian SPTB)" htmlFor={id('keg')}>
        <Textarea id={id('keg')} rows={2} value={etape.kegiatan} onChange={(e) => onUbah({ kegiatan: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nama hotel" htmlFor={id('hotel')} className="lg:col-span-2">
          <Input id={id('hotel')} value={etape.hotelNama ?? ''} onChange={(e) => onUbah({ hotelNama: e.target.value || null })} />
        </Field>
        <Field
          label="Tarif hotel per malam"
          htmlFor={id('tarif')}
          hint={batasHotel !== null ? `Batas SBM ${rupiah(batasHotel)}` : undefined}
        >
          <RupiahInput id={id('tarif')} value={etape.hotelTarif} onChange={(v) => onUbah({ hotelTarif: v })} />
        </Field>
        <Field label="Malam menginap" htmlFor={id('malam')} hint="Kosong = otomatis.">
          <Input
            id={id('malam')}
            type="number"
            min={0}
            value={etape.malamOverride ?? ''}
            onChange={(e) => onUbah({ malamOverride: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
      </div>
      {bolehRepresentasi ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={etape.dinasJabatan ?? false} onChange={(e) => onUbah({ dinasJabatan: e.target.checked })} />
          Perjalanan dinas jabatan (berhak uang representasi)
        </label>
      ) : null}
      {peringatan.length > 0 ? (
        <ul className="grid gap-1 text-xs text-destructive">
          {peringatan.map((p, i) => (
            <li key={i}>{p.pesan}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
