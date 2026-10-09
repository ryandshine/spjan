import { useState } from 'react'
import { BedDoubleIcon, CalendarIcon, CheckIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import {
  daftarHariIso,
  isKotaJabodetabek,
  norm,
  parseTanggal,
  provinsiDariKotaJabodetabek,
  ringkasEtape,
  selisihHari,
  type EtapePayload,
  type Peringatan,
  type Sbm,
} from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Badge } from '@/components/ui/badge'
import { Istilah } from '@/components/ui/istilah'
import type { PetaGalat } from '@/lib/validasi'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { DasarAturan } from '@/components/st/dasar-aturan'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { rupiah, tanggalPanjang } from '@/lib/format'

function labelTanggal(iso: string): string {
  const t = parseTanggal(iso)
  if (!t) return iso
  const dt = new Date(Date.UTC(t.y, t.m - 1, t.d))
  return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function EtapeForm({
  idAwal,
  nomor,
  etape,
  provinsi,
  bolehRepresentasi,
  batasHotel,
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
  bolehRepresentasi: boolean
  batasHotel: number | null
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
  const tarif30 = batasHotel !== null ? Math.round(batasHotel * 0.3) : null
  const provNorm = norm(etape.provinsi)
  const tarifLuarKota = sbm?.uangHarian[provNorm]?.luarKota
  const tarifDalamKota = sbm?.uangHarian[provNorm]?.dalamKota8Jam
  // Opsi dalam kota hanya relevan untuk perjalanan 1 hari atau tujuan Jabodetabek; selain itu disembunyikan agar form tidak membingungkan.
  const tampilDalamKota = (etape.dalamKota8Jam ?? false) || hari === 1 || isKotaJabodetabek(etape.kota)
  const catatanOtomatis = (etape.dalamKota8Jam ?? false) && hari === 1 && isKotaJabodetabek(etape.kota)

  const tglAwal = parseTanggal(etape.berangkat)
  const tglAkhir = parseTanggal(etape.pulang)
  const listHari = tglAwal && tglAkhir && selisihHari(tglAwal, tglAkhir) >= 0 ? daftarHariIso(tglAwal, tglAkhir) : []
  const fullboardAktif = (etape.fullboardDates ?? []).filter((t) => listHari.includes(t))
  const jmlFullboard = fullboardAktif.length
  const jmlBiasa = listHari.length - jmlFullboard

  const [bukaFullboardManual, setBukaFullboardManual] = useState<boolean | null>(null)
  const bukaFullboard = bukaFullboardManual ?? ((etape.fullboardDates ?? []).length > 0)
  const setBukaFullboard = (aktif: boolean) => setBukaFullboardManual(aktif)

  const toggleFullboard = (tgl: string, checked: boolean) => {
    const prev = new Set(etape.fullboardDates ?? [])
    if (checked) {
      prev.add(tgl)
    } else {
      prev.delete(tgl)
    }
    onUbah({ fullboardDates: Array.from(prev).sort() })
  }

  const pilihSemuaFullboard = () => {
    onUbah({ fullboardDates: [...listHari].sort() })
  }

  const kosongkanFullboard = () => {
    onUbah({ fullboardDates: [] })
  }

  const handleToggleSection = (aktif: boolean) => {
    setBukaFullboard(aktif)
    if (!aktif) {
      onUbah({ fullboardDates: [] })
    }
  }

  return (
    <div className="grid gap-4 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold">Tujuan {nomor}</h4>
          {hari !== null ? (
            <Badge variant="muted">
              {hari} hari / {malam} malam
              {bukaFullboard && jmlFullboard > 0 ? ` (${jmlFullboard} hari paket rapat)` : ''}
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

      <div className="grid gap-3">
        <h5 className="text-sm font-semibold">Penginapan</h5>
        {hari === 1 && malam === 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <BedDoubleIcon className="size-4 shrink-0" aria-hidden />
            Perjalanan 1 hari tanpa menginap: biaya penginapan tidak dihitung.
            <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => onUbah({ malamOverride: 1 })}>
              Aktifkan jika menginap
            </Button>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 items-start">
            <Field label="Nama hotel / penginapan" htmlFor={id('hotel')} className="sm:col-span-2" mode="opsional">
              <TextareaOtomatis
                id={id('hotel')}
                value={etape.hotelNama ?? ''}
                placeholder={etape.hotel30Persen ? 'Biaya Penginapan 30% SBM' : 'Nama hotel atau penginapan'}
                onChange={(e) => onUbah({ hotelNama: e.target.value || null })}
              />
            </Field>
            <Field
              label="Tarif hotel per malam"
              htmlFor={id('tarif')}
              mode={etape.hotel30Persen ? 'otomatis' : 'wajib'}
              otomatisAktif={etape.hotelTarif == null}
              onKembaliOtomatis={() => onUbah({ hotelTarif: null })}
              warning={peringatanKode('TARIF_HOTEL_KOSONG') ?? peringatanKode('HOTEL_MELEBIHI_BATAS')}
              hint={
                etape.hotel30Persen
                  ? `30% SBM: ${tarif30 !== null ? rupiah(tarif30) : 'Otomatis'}`
                  : batasHotel !== null
                    ? `Batas SBM ${rupiah(batasHotel)}`
                    : undefined
              }
            >
              <RupiahInput
                id={id('tarif')}
                value={etape.hotelTarif ?? (etape.hotel30Persen && tarif30 !== null ? tarif30 : null)}
                onChange={(v) => onUbah({ hotelTarif: v })}
              />
            </Field>
            <Field
              label="Malam menginap"
              htmlFor={id('malam')}
              mode="otomatis"
              otomatisAktif={etape.malamOverride == null}
              onKembaliOtomatis={() => onUbah({ malamOverride: null })}
              hint={bukaFullboard && jmlFullboard > 0 && jmlFullboard === listHari.length ? 'Otomatis 0 malam (seluruh hari paket rapat).' : undefined}
            >
              <Input
                id={id('malam')}
                type="number"
                min={0}
                placeholder={malam !== null ? `Otomatis: ${malam} malam` : 'Otomatis'}
                value={etape.malamOverride ?? ''}
                onChange={(e) => onUbah({ malamOverride: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <h5 className="text-sm font-semibold">Opsi tambahan</h5>

        {tampilDalamKota ? (
          <div className="grid gap-1">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={etape.dalamKota8Jam ?? false}
                onChange={(e) => {
                  const aktif = e.target.checked
                  onUbah({ dalamKota8Jam: aktif, ...(aktif && hari === 1 ? { malamOverride: 0 } : {}) })
                }}
              />
              <span>
                <span className="font-medium text-foreground">Pulang-pergi di hari yang sama di sekitar Jakarta (lebih dari 8 jam, tanpa menginap)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Dihitung sebagai <strong>uang harian dalam kota</strong>
                  {tarifDalamKota ? ` ${rupiah(tarifDalamKota)}/hari` : ''}, bukan luar kota
                  {tarifLuarKota ? ` ${rupiah(tarifLuarKota)}/hari` : ''}.
                </span>
              </span>
            </label>
            {catatanOtomatis ? (
              <p className="pl-6 text-xs text-muted-foreground">
                Dicentang otomatis: {etape.kota} termasuk Jabodetabek dan perjalanan hanya 1 hari.
              </p>
            ) : null}
            <div className="pl-6">
              <DasarAturan judul="Uang harian dalam kota lebih dari 8 jam">
                <p>PMK 113/PMK.05/2012 Pasal 14 ayat (3): perjalanan dinas dalam kota lebih dari 8 jam dibayarkan uang harian dalam kota sebesar satu hari penuh sesuai tarif SBM.</p>
              </DasarAturan>
            </div>
          </div>
        ) : null}

        {listHari.length > 0 ? (
          <div className="grid gap-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
              <input
                type="checkbox"
                checked={bukaFullboard}
                onChange={(e) => handleToggleSection(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>
                <span className="font-medium text-foreground">
                  Ada paket rapat di hotel (<Istilah kata="Fullboard" />)
                  {bukaFullboard && jmlFullboard > 0 ? <Badge variant="default" className="ml-2">{jmlFullboard} dari {listHari.length} hari</Badge> : null}
                </span>
              </span>
            </label>

            {bukaFullboard ? (
              <div className="grid gap-2 pl-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-foreground">Pilih tanggal yang tercakup paket rapat:</p>
                  <Button type="button" variant="outline" size="sm" onClick={pilihSemuaFullboard}>
                    Pilih semua
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={kosongkanFullboard}>
                    Kosongkan
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {listHari.map((tgl) => {
                    const isChecked = fullboardAktif.includes(tgl)
                    return (
                      <button
                        key={tgl}
                        type="button"
                        aria-pressed={isChecked}
                        onClick={() => toggleFullboard(tgl, !isChecked)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          isChecked
                            ? 'border-primary bg-primary text-primary-foreground ring-1 ring-primary/30'
                            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {isChecked ? <CheckIcon className="size-3.5 stroke-[2.5]" /> : <CalendarIcon className="size-3.5 opacity-60" />}
                        {labelTanggal(tgl)}
                      </button>
                    )
                  })}
                </div>
                {jmlFullboard > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    <strong>{jmlFullboard} hari</strong> paket rapat (uang saku) dan <strong>{jmlBiasa} hari</strong> lain (uang harian penuh).
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-warning-foreground">
                    <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Belum ada tanggal yang dipilih. Klik tombol tanggal di atas untuk menandai hari kegiatan rapat.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {!(hari === 1 && malam === 0) ? (
          <div className="grid gap-1">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={etape.hotel30Persen ?? false}
                onChange={(e) => {
                  const aktif = e.target.checked
                  onUbah({
                    hotel30Persen: aktif,
                    hotelNama: aktif ? etape.hotelNama || 'Biaya Penginapan 30% SBM' : etape.hotelNama,
                    hotelTarif: aktif ? (tarif30 ?? etape.hotelTarif) : etape.hotelTarif,
                  })
                }}
              />
              <span>
                <span className="font-medium text-foreground">Menginap tanpa fasilitas hotel (biaya penginapan 30%)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Pelaksana yang tidak memakai hotel berhak atas 30% dari batas tertinggi SBM penginapan{tarif30 !== null ? ` (${rupiah(tarif30)}/malam)` : ''}, dan otomatis tercatat di <Istilah kata="DPR" />.
                </span>
              </span>
            </label>
            <div className="pl-6">
              <DasarAturan judul="Penginapan 30% tarif SBM">
                <p>PMK 113/PMK.05/2012 Pasal 16 ayat (2): pelaksana perjalanan dinas yang tidak menggunakan fasilitas hotel atau penginapan lainnya diberikan biaya penginapan sebesar 30% (tiga puluh persen) dari tarif hotel di kota tempat tujuan sesuai SBM.</p>
              </DasarAturan>
            </div>
          </div>
        ) : null}

        {bolehRepresentasi ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
            <input type="checkbox" className="size-4" checked={etape.dinasJabatan ?? false} onChange={(e) => onUbah({ dinasJabatan: e.target.checked })} />
            Perjalanan dinas jabatan (berhak uang representasi)
          </label>
        ) : null}
      </div>

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
