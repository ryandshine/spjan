import { useState } from 'react'
import { CalendarIcon, CheckIcon, Trash2Icon } from 'lucide-react'
import { daftarHariIso, parseTanggal, ringkasEtape, selisihHari, type EtapePayload, type Peringatan } from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { rupiah } from '@/lib/format'

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
  const tarif30 = batasHotel !== null ? Math.round(batasHotel * 0.3) : null

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
    <div className="grid gap-3.5 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Tujuan {nomor}</h4>
          {hari !== null ? (
            <Badge variant="muted">
              {hari} hari / {malam} malam
              {bukaFullboard && jmlFullboard > 0 ? ` (${jmlFullboard} fullboard)` : ''}
            </Badge>
          ) : null}
        </div>
        {bisaHapus ? (
          <Button variant="ghost" size="sm" onClick={onHapus} aria-label={`Hapus tujuan ${nomor}`}>
            <Trash2Icon className="text-destructive" /> Hapus tujuan
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      {listHari.length > 0 ? (
        <div className="rounded-lg border border-border/80 bg-background/80 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bukaFullboard}
                onChange={(e) => handleToggleSection(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Paket Rapat / Pertemuan (Fullboard)
                  </span>
                  {bukaFullboard && jmlFullboard > 0 ? (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 font-medium">
                      {jmlFullboard} dari {listHari.length} hari
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Centang jika perjalanan dinas ini mencakup paket pertemuan/rapat di hotel.
                </p>
              </div>
            </label>

            {bukaFullboard ? (
              <div className="flex items-center gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={pilihSemuaFullboard}
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={kosongkanFullboard}
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Kosongkan
                </Button>
              </div>
            ) : null}
          </div>

          {bukaFullboard ? (
            <div className="space-y-2.5 border-t pt-3">
              <p className="text-xs font-medium text-foreground">
                Tandai tanggal kegiatan fullboard:
              </p>
              <div className="flex flex-wrap gap-2">
                {listHari.map((tgl) => {
                  const isChecked = fullboardAktif.includes(tgl)
                  return (
                    <button
                      key={tgl}
                      type="button"
                      onClick={() => toggleFullboard(tgl, !isChecked)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        isChecked
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/30'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border hover:border-border/80'
                      }`}
                    >
                      {isChecked ? (
                        <CheckIcon className="size-3.5 stroke-[2.5]" />
                      ) : (
                        <CalendarIcon className="size-3.5 opacity-60" />
                      )}
                      <span>{labelTanggal(tgl)}</span>
                      {isChecked ? (
                        <span className="ml-0.5 text-[10px] bg-white/20 px-1 py-0.2 rounded font-semibold">
                          Fullboard
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {jmlFullboard > 0 ? (
                <div className="grid gap-1.5 sm:grid-cols-2 bg-muted/40 p-2.5 rounded-md border border-border/60 text-xs">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="size-2 rounded-full bg-primary inline-block" />
                    <span>
                      <strong>{jmlFullboard} hari</strong> Fullboard (Uang Saku SBM)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2 rounded-full bg-muted-foreground/40 inline-block" />
                    <span>
                      <strong>{jmlBiasa} hari</strong> Transit PP (Uang Harian Penuh)
                    </span>
                  </div>
                  {jmlFullboard === listHari.length ? (
                    <p className="sm:col-span-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                      ✓ Seluruh hari adalah fullboard. Penginapan ditanggung panitia (malam menginap otomatis 0).
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Belum ada tanggal fullboard yang dipilih. Klik tombol tanggal di atas untuk menandai hari kegiatan rapat.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label="Kegiatan / tujuan (untuk uraian SPTB)" htmlFor={id('keg')}>
        <Textarea id={id('keg')} rows={2} value={etape.kegiatan} onChange={(e) => onUbah({ kegiatan: e.target.value })} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Nama hotel / penginapan" htmlFor={id('hotel')} className="xl:col-span-2">
          <Input
            id={id('hotel')}
            value={etape.hotelNama ?? ''}
            placeholder={etape.hotel30Persen ? 'Biaya Penginapan 30% SBM' : 'Nama hotel / penginapan...'}
            onChange={(e) => onUbah({ hotelNama: e.target.value || null })}
          />
        </Field>
        <Field
          label="Tarif hotel per malam"
          htmlFor={id('tarif')}
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
          hint={bukaFullboard && jmlFullboard > 0 && jmlFullboard === listHari.length ? 'Otomatis 0 malam (fullboard).' : 'Kosong = otomatis.'}
        >
          <Input
            id={id('malam')}
            type="number"
            min={0}
            value={etape.malamOverride ?? ''}
            onChange={(e) => onUbah({ malamOverride: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
        <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
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
          <div className="grid gap-0.5">
            <span className="font-medium text-foreground">
              Menginap tanpa fasilitas hotel (dapat biaya penginapan 30% tarif SBM)
            </span>
            <p className="text-xs text-muted-foreground">
              Sesuai PMK 113/PMK.05/2012 Pasal 16 ayat (2), pelaksana yang tidak menggunakan fasilitas hotel/penginapan berhak atas 30% dari batas tertinggi SBM penginapan {tarif30 !== null ? `(${rupiah(tarif30)}/malam)` : ''} dan otomatis dicantumkan pada Daftar Pengeluaran Riil (DPR).
            </p>
          </div>
        </label>
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
