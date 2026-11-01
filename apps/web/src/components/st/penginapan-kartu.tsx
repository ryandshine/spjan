import {
  BedDoubleIcon,
  CheckIcon,
  InfoIcon,
  LockIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import {
  daftarHariIso,
  parseTanggal,
  ringkasEtape,
  selisihHari,
  type EtapePayload,
  type HotelTambahan,
  type Peringatan,
  type Sbm,
} from '@spjan/shared'

import { BagianTanggal } from '@/components/st/bagian-tanggal'
import { DasarAturan } from '@/components/st/dasar-aturan'
import { RupiahInput } from '@/components/st/rupiah-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Istilah } from '@/components/ui/istilah'
import { Label } from '@/components/ui/label'
import { TandaWajib } from '@/components/ui/penanda-isian'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { rupiah } from '@/lib/format'
import { labelTanggal } from '@/lib/tanggal-label'
import { cn } from '@/lib/utils'
import { useTanggalTerpilih } from '@/lib/use-tanggal-terpilih'

/**
 * Kartu Penginapan untuk satu tujuan: nama hotel, tarif per malam, malam otomatis/manual, subtotal,
 * lalu sub-kartu opsi tambahan (paket rapat, 30%, dalam kota, representasi) yang mengubah cara hitung.
 */
export function PenginapanEtapeKartu({
  idAwal,
  nomor,
  etape,
  batasHotel,
  peringatan,
  onUbah,
}: {
  idAwal: string
  nomor: number
  etape: EtapePayload
  batasHotel: number | null
  sbm?: Sbm
  peringatan: Peringatan[]
  onUbah: (patch: Partial<EtapePayload>) => void
}) {
  const { hari, malam } = ringkasEtape(etape)
  const peringatanKode = (kode: string) => peringatan.find((w) => w.kode === kode)?.pesan
  const id = (k: string) => `etape-${idAwal}-${k}`
  const tarif30 = batasHotel !== null ? Math.round(batasHotel * 0.3) : null

  const tglAwal = parseTanggal(etape.berangkat)
  const tglAkhir = parseTanggal(etape.pulang)
  const listHari = tglAwal && tglAkhir && selisihHari(tglAwal, tglAkhir) >= 0 ? daftarHariIso(tglAwal, tglAkhir) : []

  const semuaFullboard = (etape.fullboardDates ?? []).length >= (hari ?? 0) && (hari ?? 0) > 0
  const defaultMalam = hari ? (semuaFullboard ? 0 : Math.max(hari - 1, 0)) : 0
  const isManualMalam = etape.malamOverride != null
  const tanpaMenginap = hari === 1 && malam === 0 && !isManualMalam

  const listMalamDasar = listHari.slice(0, Math.max(0, etape.malamOverride ?? defaultMalam))
  const hotelPihakLain = useTanggalTerpilih(etape, 'hotelPihakLainDates', listMalamDasar, onUbah)
  const tempatLain = etape.hotelTambahan ?? []
  const malamBisaDipilih = listMalamDasar.filter((t) => !hotelPihakLain.aktif.includes(t))
  const tglTempatLain = tempatLain.flatMap((r) => r.tanggal).filter((t) => malamBisaDipilih.includes(t))
  const listMalam = malamBisaDipilih.filter((t) => !tglTempatLain.includes(t))
  const ubahTempat = (i: number, patch: Partial<HotelTambahan>) =>
    onUbah({ hotelTambahan: tempatLain.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const subtotalTempatLain = tempatLain.reduce((s, r) => s + r.tarif * r.tanggal.filter((t) => malamBisaDipilih.includes(t)).length, 0)
  const tglUangHarianPihakLain = (etape.tanpaUangHarianDates ?? []).filter((t) => listMalamDasar.includes(t))
  const hotel30 = useTanggalTerpilih(etape, 'hotel30Dates', listMalam, (patch) => {
    const dates = patch.hotel30Dates ?? []
    onUbah({
      ...patch,
      hotel30Persen: dates.length > 0,
      hotelNama: dates.length === listMalam.length && listMalam.length > 0 ? etape.hotelNama || 'Biaya Penginapan 30% SBM' : etape.hotelNama,
    })
  })
  const jmlHotel30 = hotel30.jumlah
  const jmlMalamHotel = Math.max(0, listMalam.length - jmlHotel30)
  const isSemua30 = jmlHotel30 > 0 && jmlHotel30 === listMalam.length
  const isSebagian30 = jmlHotel30 > 0 && jmlHotel30 < listMalam.length

  const tarifEfektif = isSemua30 ? (etape.hotelTarif ?? (tarif30 !== null ? tarif30 : null)) : etape.hotelTarif
  const subtotal = (jmlMalamHotel * (etape.hotelTarif ?? 0)) + (jmlHotel30 * (tarif30 ?? 0)) + subtotalTempatLain
  const peringatanTarif = peringatanKode('TARIF_HOTEL_KOSONG') ?? peringatanKode('HOTEL_MELEBIHI_BATAS')
  const tarifKosong = (malam ?? 0) > 0 && jmlMalamHotel > 0 && !etape.hotelTarif
  const judulBaris = `Tujuan ${nomor}${etape.kota ? ` - ${etape.kota}` : ''}`

  return (
    <div className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-base font-semibold">{judulBaris}</h4>
      {peringatanKode('MALAM_BERLEBIH') ? (
        <p className="flex items-start gap-1 text-sm font-medium text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> {peringatanKode('MALAM_BERLEBIH')}
        </p>
      ) : null}
      {tanpaMenginap ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <BedDoubleIcon className="size-4 shrink-0" aria-hidden />
          Perjalanan 1 hari tanpa menginap: biaya penginapan tidak dihitung.
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => onUbah({ malamOverride: 1 })}>
            Aktifkan jika menginap
          </Button>
        </p>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={id('hotel')}>Nama hotel / penginapan</Label>
              <TextareaOtomatis
                id={id('hotel')}
                value={etape.hotelNama ?? ''}
                placeholder={
                  (malam ?? 0) === 0
                    ? 'Opsional (penginapan 0 malam)'
                    : isSemua30
                      ? 'Biaya Penginapan 30% SBM'
                      : isSebagian30
                        ? 'Nama hotel (untuk malam hotel riil)'
                        : 'Nama hotel atau penginapan'
                }
                onChange={(e) => onUbah({ hotelNama: e.target.value || null })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={id('tarif')}>
                Tarif hotel per malam
                {!isSemua30 && jmlMalamHotel > 0 ? <TandaWajib /> : null}
              </Label>
              <div className="relative">
                <RupiahInput
                  awalan
                  id={id('tarif')}
                  className={`font-mono ${isSemua30 ? 'pr-8' : ''}`}
                  value={tarifEfektif}
                  onChange={(v) => onUbah({ hotelTarif: v })}
                />
                {isSemua30 && etape.hotelTarif != null ? (
                  <button
                    type="button"
                    title="Kembali ke tarif 30% otomatis"
                    aria-label="Kembali ke tarif otomatis"
                    onClick={() => onUbah({ hotelTarif: null })}
                    className="absolute inset-y-0 right-2 flex items-center rounded px-0.5 text-muted-foreground hover:text-primary"
                  >
                    <RotateCcwIcon className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
              {(malam ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Tarif tidak dibebankan ke SPJ (0 malam).</p>
              ) : isSemua30 ? (
                <p className="text-xs text-muted-foreground tabular-nums">30% SBM: {tarif30 !== null ? rupiah(tarif30) : 'Otomatis'}</p>
              ) : isSebagian30 ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {jmlMalamHotel} malam hotel riil + {jmlHotel30} malam 30% SBM ({rupiah(tarif30 ?? 0)}/malam)
                </p>
              ) : batasHotel !== null ? (
                <p className="text-xs text-muted-foreground tabular-nums">Batas SBM {rupiah(batasHotel)}</p>
              ) : null}
              {tarifKosong ? <p className="text-xs text-warning-foreground">Belum ada tarif (tidak dicetak)</p> : null}
              {peringatanTarif && !tarifKosong ? (
                <p className="flex items-start gap-1 text-xs font-medium text-warning-foreground">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {peringatanTarif}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Malam menginap</span>
              {!isManualMalam ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-primary gap-1 hover:bg-accent"
                  onClick={() => onUbah({ malamOverride: malam ?? 0 })}
                >
                  <PencilIcon className="size-3" aria-hidden /> Ubah manual
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => onUbah({ malamOverride: null })}
                  title="Kembali ke hitungan otomatis dari tanggal"
                >
                  <RotateCcwIcon className="size-3" aria-hidden /> Kembali otomatis
                </Button>
              )}
            </div>

            {!isManualMalam ? (
              <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">{malam !== null ? `${malam} malam` : '-'}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  <LockIcon className="size-3" aria-hidden /> Otomatis dari Tanggal
                </span>
              </div>
            ) : (
              <div className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 rounded-md border-border bg-background"
                      disabled={(etape.malamOverride ?? 0) <= 0}
                      onClick={() => onUbah({ malamOverride: Math.max(0, (etape.malamOverride ?? 0) - 1) })}
                      aria-label="Kurangi 1 malam"
                    >
                      <MinusIcon className="size-3.5" aria-hidden />
                    </Button>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={etape.malamOverride ?? 0}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 0) onUbah({ malamOverride: v })
                      }}
                      className="h-7 w-14 rounded-md border border-input bg-background px-2 text-center text-sm font-semibold font-mono tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 rounded-md border-border bg-background"
                      onClick={() => onUbah({ malamOverride: (etape.malamOverride ?? 0) + 1 })}
                      aria-label="Tambah 1 malam"
                    >
                      <PlusIcon className="size-3.5" aria-hidden />
                    </Button>
                    <span className="text-sm font-medium text-foreground">malam</span>
                  </div>

                  {(etape.malamOverride ?? 0) > 0 ? null : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckIcon className="size-3 stroke-[3]" aria-hidden /> Ditanggung pihak lain
                    </span>
                  )}
                </div>

                {(etape.malamOverride ?? 0) === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <InfoIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span>0 malam: seluruh penginapan ditanggung pihak lain/panitia (tidak dibebankan ke SPJ).</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Diatur manual ({etape.malamOverride} malam). Hitungan tanggal bawaan: {defaultMalam} malam.
                  </p>
                )}
              </div>
            )}

            {semuaFullboard && !isManualMalam ? (
              <p className="text-xs text-muted-foreground">Otomatis 0 malam (seluruh hari paket rapat fullboard diatur pada tab Uang Harian).</p>
            ) : null}
            <p className="mt-1 flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Subtotal Penginapan</span>
              <span className="font-mono tabular-nums">{rupiah(subtotal)}</span>
            </p>
          </div>
        </div>
      )}

      {!tanpaMenginap && listMalamDasar.length > 0 ? (
        <div className="grid gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-sm font-semibold text-muted-foreground">Tempat menginap lain (pindah hotel, homestay)</h5>
            <span className="text-xs text-muted-foreground tabular-nums">
              Hotel utama {listMalam.length} | Tempat lain {tglTempatLain.length} | Pihak lain {hotelPihakLain.jumlah} malam
            </span>
          </div>
          {tempatLain.map((r, i) => {
            const nomorTempat = i + 1
            const dipakaiLain = tempatLain.filter((_, j) => j !== i).flatMap((x) => x.tanggal)
            return (
              <div key={i} className="grid gap-2 rounded-lg border p-3">
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_auto]">
                  <Input aria-label={`Nama tempat menginap ${nomorTempat}`} placeholder="Nama hotel / penginapan" value={r.nama} onChange={(e) => ubahTempat(i, { nama: e.target.value })} />
                  <RupiahInput awalan className="font-mono" aria-label={`Tarif per malam ${nomorTempat}`} value={r.tarif || null} onChange={(v) => ubahTempat(i, { tarif: v ?? 0 })} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Hapus tempat menginap ${nomorTempat}`} onClick={() => onUbah({ hotelTambahan: tempatLain.filter((_, j) => j !== i) })}>
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {malamBisaDipilih.map((t) => {
                    const dipilih = r.tanggal.includes(t)
                    const terpakai = dipakaiLain.includes(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={dipilih}
                        disabled={terpakai}
                        onClick={() => ubahTempat(i, { tanggal: dipilih ? r.tanggal.filter((x) => x !== t) : [...r.tanggal, t].sort() })}
                        className={cn(
                          'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                          dipilih ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-accent',
                        )}
                      >
                        {dipilih ? <CheckIcon className="size-3.5 stroke-[3]" aria-hidden /> : null}
                        {labelTanggal(t)}
                      </button>
                    )
                  })}
                </div>
                {batasHotel !== null && r.tarif > batasHotel ? (
                  <p className="text-xs font-medium text-warning-foreground">Melebihi batas SBM {rupiah(batasHotel)}.</p>
                ) : null}
              </div>
            )
          })}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onUbah({ hotelTambahan: [...tempatLain, { nama: '', tarif: 0, tanggal: [] }] })}>
            <PlusIcon /> Tambah tempat menginap
          </Button>
          <p className="text-xs text-muted-foreground">Pilih malam di tempat ini. Malam yang tidak dipilih tetap dihitung di hotel utama.</p>
        </div>
      ) : null}

      {listMalamDasar.length > 0 ? (
        <div className="grid gap-3 border-t pt-4">
          <h5 className="text-sm font-semibold text-muted-foreground">Opsi Penginapan Tambahan</h5>
          <BagianTanggal
            judul="Penginapan ditanggung pihak lain"
            chip={`Pihak lain ${hotelPihakLain.jumlah} malam | Dibayar SPJ ${listMalam.length} malam`}
            petunjuk="Pilih malam yang penginapannya dibayar pihak lain:"
            gaya="amber"
            akhiranTerpilih="(pihak lain)"
            listHari={listMalamDasar}
            tanggal={hotelPihakLain}
          >
            {tglUangHarianPihakLain.length > 0 ? (
              <button
                type="button"
                className="w-fit text-xs text-primary hover:underline"
                onClick={() => onUbah({ hotelPihakLainDates: tglUangHarianPihakLain })}
              >
                Samakan dengan tanggal uang harian pihak lain
              </button>
            ) : null}
          </BagianTanggal>
          {listMalam.length > 0 ? (
          <BagianTanggal
            judul="Menginap tanpa fasilitas hotel (biaya penginapan 30%)"
            chip={`${jmlHotel30} dari ${listMalam.length} malam (30%)`}
            petunjuk="Pilih tanggal/malam menginap tanpa fasilitas hotel (30% dari tarif SBM):"
            gaya="primer"
            akhiranTerpilih="(30%)"
            listHari={listMalam}
            tanggal={hotel30}
          >
            {jmlHotel30 > 0 ? (
              <div className="grid gap-2">
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <strong>{jmlHotel30} malam</strong> tanpa fasilitas hotel berhak atas <strong>30% SBM</strong>
                    {tarif30 !== null ? ` (${rupiah(tarif30)}/malam)` : ''} dan otomatis tercatat di <Istilah kata="DPR" />.{' '}
                    {jmlMalamHotel > 0 ? (
                      <>
                        Sisa <strong>{jmlMalamHotel} malam</strong> dihitung sesuai tarif hotel riil terlampir.
                      </>
                    ) : (
                      <>Seluruh malam menginap tanpa fasilitas hotel.</>
                    )}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Belum ada malam yang dipilih. Klik tombol tanggal di atas untuk menandai malam yang berhak 30% SBM.
              </p>
            )}
            <DasarAturan judul="Penginapan 30% tarif SBM">
              <p>
                PMK 113/PMK.05/2012 Pasal 16 ayat (2): pelaksana perjalanan dinas yang tidak menggunakan fasilitas hotel atau penginapan lainnya diberikan biaya penginapan sebesar 30% (tiga puluh persen) dari tarif hotel di kota tempat tujuan sesuai SBM.
              </p>
            </DasarAturan>
          </BagianTanggal>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
