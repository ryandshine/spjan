import {
  BedDoubleIcon,
  CheckIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import {
  daftarHariIso,
  formatDaftarTanggal,
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
  rincianManual = false,
  onPindahkan,
  onUbah,
}: {
  idAwal: string
  nomor: number
  etape: EtapePayload
  batasHotel: number | null
  sbm?: Sbm
  peringatan: Peringatan[]
  /** Pelaksana punya baris rincian manual penginapan. */
  rincianManual?: boolean
  /** Ada bila rincian manual bisa dipindah ke daftar tanpa mengubah total. */
  onPindahkan?: () => void
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
  const tglHotelUtama = listMalam.filter((t) => !hotel30.aktif.includes(t))
  const isSemua30 = jmlHotel30 > 0 && jmlHotel30 === listMalam.length
  const isSebagian30 = jmlHotel30 > 0 && jmlHotel30 < listMalam.length

  const tarifEfektif = isSemua30 ? (etape.hotelTarif ?? (tarif30 !== null ? tarif30 : null)) : etape.hotelTarif
  const tarif30Aktif = isSemua30 ? (tarifEfektif ?? 0) : (tarif30 ?? 0)
  const subtotalHotelUtama = jmlMalamHotel * (etape.hotelTarif ?? 0)
  const subtotal30 = jmlHotel30 * tarif30Aktif
  const subtotal = subtotalHotelUtama + subtotal30 + subtotalTempatLain
  const peringatanTarif = peringatanKode('TARIF_HOTEL_KOSONG') ?? peringatanKode('HOTEL_MELEBIHI_BATAS')
  const tarifKosong = (malam ?? 0) > 0 && jmlMalamHotel > 0 && !etape.hotelTarif
  const malamPerjalanan = etape.malamOverride != null ? Math.max(defaultMalam, listMalamDasar.length) : listMalamDasar.length
  const malamTerisi = listMalamDasar.length
  const judulBaris = `Tujuan ${nomor}${etape.kota ? ` - ${etape.kota}` : ''}`
  const namaHotelUtama = etape.hotelNama?.trim() || 'Hotel pertama'

  return (
    <div className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-base font-semibold">{judulBaris}</h4>
      {peringatanKode('MALAM_BERLEBIH') ? (
        <p className="flex items-start gap-1 text-sm font-medium text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> {peringatanKode('MALAM_BERLEBIH')}
        </p>
      ) : null}
      {etape.malamOverride === 0 && hari !== null ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <BedDoubleIcon className="size-4 shrink-0" aria-hidden />
          {rincianManual ? 'Penginapan dicatat di Rincian Manual di bawah.' : 'Tidak menginap: biaya penginapan tidak dihitung.'}
          {onPindahkan ? (
            <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onPindahkan}>
              Pindahkan ke daftar penginapan
            </Button>
          ) : null}
          {!rincianManual ? (
            <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => onUbah({ malamOverride: hari === 1 ? 1 : null })}>
              Aktifkan jika menginap
            </Button>
          ) : null}
        </div>
      ) : tanpaMenginap ? (
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor={id('hotel')}>Nama hotel / penginapan</Label>
                {malamTerisi > 0 ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
                    {isSemua30
                      ? `${jmlHotel30} malam (30% SBM)`
                      : `${jmlMalamHotel} malam${tglHotelUtama.length > 0 ? ` (${formatDaftarTanggal(tglHotelUtama)})` : ''}`}
                  </span>
                ) : null}
              </div>
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
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                  {batasHotel !== null ? <span>Batas SBM {rupiah(batasHotel)}</span> : <span />}
                  {jmlMalamHotel > 0 && (etape.hotelTarif ?? 0) > 0 ? (
                    <span className="font-medium text-foreground/80">
                      {jmlMalamHotel} malam × {rupiah(etape.hotelTarif ?? 0)} = {rupiah(subtotalHotelUtama)}
                    </span>
                  ) : null}
                </div>
              )}
              {tarifKosong ? <p className="text-xs text-warning-foreground">Belum ada tarif (tidak dicetak)</p> : null}
              {peringatanTarif && !tarifKosong ? (
                <p className="flex items-start gap-1 text-xs font-medium text-warning-foreground">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {peringatanTarif}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {malamTerisi} dari {malamPerjalanan} malam terisi
              </span>
              {malamTerisi === malamPerjalanan ? <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Lengkap" /> : null}
            </div>
            {malamTerisi < malamPerjalanan ? (
              <p className="flex items-start gap-1 text-xs font-medium text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {malamPerjalanan - malamTerisi} malam belum punya keterangan. Periksa jumlah malam di pengaturan lanjutan.
              </p>
            ) : null}
            {semuaFullboard && !isManualMalam ? (
              <p className="text-xs text-muted-foreground">Otomatis 0 malam (seluruh hari paket rapat fullboard diatur pada tab Uang Harian).</p>
            ) : null}
            {malamTerisi > 0 ? (
              <div className="grid gap-1 text-xs text-muted-foreground tabular-nums">
                {jmlMalamHotel > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {namaHotelUtama} ({jmlMalamHotel} mlm × {rupiah(etape.hotelTarif ?? 0)})
                    </span>
                    <span className="shrink-0 font-mono text-foreground">{rupiah(subtotalHotelUtama)}</span>
                  </div>
                ) : null}
                {tempatLain.map((r, idx) => {
                  const mlm = r.tanggal.filter((t) => malamBisaDipilih.includes(t)).length
                  if (mlm === 0 && !r.nama && !r.tarif) return null
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {r.nama.trim() || `Penginapan ke-${idx + 2}`} ({mlm} mlm × {rupiah(r.tarif || 0)})
                      </span>
                      <span className="shrink-0 font-mono text-foreground">{rupiah(mlm * (r.tarif || 0))}</span>
                    </div>
                  )
                })}
                {jmlHotel30 > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      Penginapan 30% SBM ({jmlHotel30} mlm × {rupiah(tarif30Aktif)})
                    </span>
                    <span className="shrink-0 font-mono text-foreground">{rupiah(subtotal30)}</span>
                  </div>
                ) : null}
                {hotelPihakLain.jumlah > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">Ditanggung pihak lain ({hotelPihakLain.jumlah} mlm)</span>
                    <span className="shrink-0 font-mono text-foreground">Rp0</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Subtotal Penginapan</span>
              <span className="font-mono tabular-nums">{rupiah(subtotal)}</span>
            </p>
            <details className="text-xs" open={isManualMalam || undefined}>
              <summary className="cursor-pointer text-muted-foreground">Pengaturan lanjutan</summary>
              <div className="mt-2 grid gap-2">
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onUbah({ malamOverride: 0, hotelTambahan: [], hotelPihakLainDates: [] })}>
                  Tidak menginap
                </Button>
                {isManualMalam ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
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
                      aria-label="Jumlah malam"
                      value={etape.malamOverride ?? 0}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 0) onUbah({ malamOverride: v })
                      }}
                      className="h-7 w-14 rounded-md border border-input bg-background px-2 text-center text-sm font-semibold font-mono tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => onUbah({ malamOverride: (etape.malamOverride ?? 0) + 1 })} aria-label="Tambah 1 malam">
                      <PlusIcon className="size-3.5" aria-hidden />
                    </Button>
                    <span>malam</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onUbah({ malamOverride: null })}>
                      <RotateCcwIcon className="size-3" aria-hidden /> Kembali otomatis
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-fit px-2 text-xs" onClick={() => onUbah({ malamOverride: defaultMalam })}>
                    Atur jumlah malam manual
                  </Button>
                )}
              </div>
            </details>
          </div>
        </div>
      )}

      {!tanpaMenginap && listMalamDasar.length > 0 ? (
        <div className="grid gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-sm font-semibold text-muted-foreground">Tempat menginap berikutnya (pindah hotel, homestay)</h5>
            <span className="text-xs text-muted-foreground tabular-nums">
              Hotel pertama: {listMalam.length} malam • Tempat berikutnya: {tglTempatLain.length} malam
              {hotelPihakLain.jumlah > 0 ? ` • Pihak lain: ${hotelPihakLain.jumlah} malam` : ''}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {tempatLain.length === 0
              ? 'Jika pindah hotel atau homestay di tengah perjalanan, tambahkan tempat menginap dan pilih tanggal malamnya.'
              : `Klik tanggal malam saat menginap di tempat berikut. Tanggal yang tidak dipilih otomatis tetap dihitung di ${namaHotelUtama} (${listMalam.length} malam).`}
          </p>
          {tempatLain.map((r, i) => {
            const nomorTempat = i + 1
            const urutanHotel = i + 2
            const dipakaiLain = tempatLain.filter((_, j) => j !== i).flatMap((x) => x.tanggal)
            const malamTempatIni = r.tanggal.filter((t) => malamBisaDipilih.includes(t) && !dipakaiLain.includes(t))
            const subtotalTempatIni = malamTempatIni.length * (r.tarif || 0)
            return (
              <div key={i} className="grid gap-3 rounded-lg border bg-card/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Penginapan ke-{urutanHotel}</span>
                    {malamTempatIni.length > 0 ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">
                        {malamTempatIni.length} malam ({formatDaftarTanggal(malamTempatIni)})
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
                        Belum ada tanggal malam dipilih
                      </span>
                    )}
                  </div>
                  {malamTempatIni.length > 0 && (r.tarif || 0) > 0 ? (
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {malamTempatIni.length} malam × {rupiah(r.tarif)} = {rupiah(subtotalTempatIni)}
                    </span>
                  ) : null}
                </div>
                <div className="grid items-end gap-2 sm:grid-cols-[1fr_13rem_auto]">
                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Nama hotel / homestay ke-{urutanHotel}</span>
                    <Input
                      aria-label={`Nama tempat menginap ${nomorTempat}`}
                      placeholder="Contoh: Homestay / Hotel kedua"
                      value={r.nama}
                      onChange={(e) => ubahTempat(i, { nama: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Tarif per malam</span>
                    <RupiahInput
                      awalan
                      className="font-mono"
                      placeholder="0"
                      aria-label={`Tarif per malam ${nomorTempat}`}
                      value={r.tarif || null}
                      onChange={(v) => ubahTempat(i, { tarif: v ?? 0 })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={`Hapus penginapan ke-${urutanHotel}`}
                    aria-label={`Hapus tempat menginap ${nomorTempat}`}
                    onClick={() => onUbah({ hotelTambahan: tempatLain.filter((_, j) => j !== i) })}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pilih tanggal malam menginap di {r.nama.trim() || `penginapan ke-${urutanHotel}`}:
                  </span>
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
                          title={
                            terpakai
                              ? 'Sudah dipilih di tempat menginap lain'
                              : dipilih
                                ? `Klik untuk mengembalikan malam ini ke ${namaHotelUtama}`
                                : `Saat ini dihitung di ${namaHotelUtama}. Klik jika malam ini menginap di ${r.nama.trim() || `penginapan ke-${urutanHotel}`}`
                          }
                          onClick={() => ubahTempat(i, { tanggal: dipilih ? r.tanggal.filter((x) => x !== t) : [...r.tanggal, t].sort() })}
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                            dipilih ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-accent',
                          )}
                        >
                          {dipilih ? <CheckIcon className="size-3.5 stroke-[3]" aria-hidden /> : null}
                          {labelTanggal(t)}
                          {terpakai ? <span className="ml-0.5 text-[10px] font-normal opacity-75">(tempat lain)</span> : null}
                        </button>
                      )
                    })}
                  </div>
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
        </div>
      ) : null}

      {listMalamDasar.length > 0 ? (
        <div className="grid gap-3 border-t pt-4">
          <h5 className="text-sm font-semibold text-muted-foreground">Malam tanpa biaya hotel penuh</h5>
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
