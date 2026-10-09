import { Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import {
  isKotaJabodetabek,
  provinsiDariKotaJabodetabek,
  ringkasEtape,
  type EtapePayload,
  type Peringatan,
  type Sbm,
} from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import type { PetaGalat } from '@/lib/validasi'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { tanggalPanjang } from '@/lib/format'

export function EtapeForm({
  idAwal,
  nomor,
  etape,
  provinsi,
  sbm,
  peringatan,
  galat,
  bisaHapus,
  onUbah,
  onHapus,
}: {
  /** Awalan id elemen agar unik di antara beberapa pelaksana. */
  idAwal: string
  nomor: number
  etape: EtapePayload
  provinsi: string[]
  sbm?: Sbm
  peringatan: Peringatan[]
  /** Galat validasi per kolom untuk tujuan ini (kunci: provinsi, kota, kegiatan, berangkat, pulang, ...). */
  galat?: PetaGalat
  bisaHapus: boolean
  onUbah: (patch: Partial<EtapePayload>) => void
  onHapus: () => void
}) {
  const { hari, malam } = ringkasEtape(etape)
  const peringatanKode = (kode: string) => peringatan.find((w) => w.kode === kode)?.pesan
  // Peringatan yang sudah tampil di isiannya tidak diulang di bawah.
  const sisaPeringatan = peringatan.filter((w) => !['TARIF_HOTEL_KOSONG', 'HOTEL_MELEBIHI_BATAS', 'TANGGAL_SALAH'].includes(w.kode))
  const id = (k: string) => `etape-${idAwal}-${k}`
  const jmlFullboard = (etape.fullboardDates ?? []).length

  return (
    <div className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold">Tujuan {nomor}</h4>
          {hari !== null ? (
            <Badge variant="muted">
              {hari} hari / {malam} malam
              {jmlFullboard > 0 ? ` (${jmlFullboard} hari paket rapat)` : ''}
            </Badge>
          ) : null}
        </div>
        {bisaHapus ? (
          <Button variant="ghost" size="sm" onClick={onHapus} aria-label={`Hapus tujuan ${nomor}`}>
            <Trash2Icon className="text-destructive" /> Hapus tujuan
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 items-start">
        <Field label="Provinsi tujuan" htmlFor={id('prov')} error={galat?.provinsi} mode="wajib">
          <Select id={id('prov')} value={etape.provinsi} onChange={(e) => onUbah({ provinsi: e.target.value })}>
            <option value="">- pilih provinsi -</option>
            {provinsi.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kota tujuan" htmlFor={id('kota')} error={galat?.kota} mode="wajib">
          <Input
            id={id('kota')}
            list={id('list-kota')}
            value={etape.kota}
            onChange={(e) => {
              const val = e.target.value
              const patch: Partial<EtapePayload> = { kota: val }
              if (isKotaJabodetabek(val)) {
                if (hari === 1) {
                  patch.dalamKota8Jam = true
                  patch.malamOverride = 0
                }
                const prov = provinsiDariKotaJabodetabek(val)
                if (prov && !etape.provinsi) {
                  patch.provinsi = prov
                }
              }
              onUbah(patch)
            }}
          />
          <datalist id={id('list-kota')}>
            {(sbm?.transportJakarta ?? []).map((t) => (
              <option key={t.kabKota} value={t.kabKota} />
            ))}
          </datalist>
        </Field>
        <Field label="Berangkat" htmlFor={id('brkt')} error={galat?.berangkat} hint={tanggalPanjang(etape.berangkat) || undefined} warning={peringatanKode('TANGGAL_SALAH')} mode="wajib">
          <InputTanggal
            id={id('brkt')}
            label="Tanggal berangkat"
            nilai={etape.berangkat}
            onUbah={(iso) => {
              const val = iso ?? ''
              const baru = { ...etape, berangkat: val }
              const { hari: hariBaru } = ringkasEtape(baru)
              const patch: Partial<EtapePayload> = { berangkat: val }
              if (hariBaru === 1 && isKotaJabodetabek(etape.kota) && !etape.dalamKota8Jam) {
                patch.dalamKota8Jam = true
                patch.malamOverride = 0
              }
              onUbah(patch)
            }}
          />
        </Field>
        <Field label="Pulang" htmlFor={id('plg')} error={galat?.pulang} hint={tanggalPanjang(etape.pulang) || undefined} mode="wajib">
          <InputTanggal
            id={id('plg')}
            label="Tanggal pulang"
            nilai={etape.pulang}
            onUbah={(iso) => {
              const val = iso ?? ''
              const baru = { ...etape, pulang: val }
              const { hari: hariBaru } = ringkasEtape(baru)
              const patch: Partial<EtapePayload> = { pulang: val }
              if (hariBaru === 1 && isKotaJabodetabek(etape.kota) && !etape.dalamKota8Jam) {
                patch.dalamKota8Jam = true
                patch.malamOverride = 0
              }
              onUbah(patch)
            }}
          />
        </Field>
      </div>

      <Field label="Kegiatan / tujuan (untuk uraian SPTB)" htmlFor={id('keg')} mode="wajib">
        <Textarea id={id('keg')} rows={2} value={etape.kegiatan} onChange={(e) => onUbah({ kegiatan: e.target.value })} />
      </Field>

      {sisaPeringatan.length > 0 ? (
        <ul className="grid gap-1 text-xs text-warning-foreground">
          {sisaPeringatan.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {p.pesan}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
