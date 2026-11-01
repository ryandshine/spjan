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
  keBentukKartu,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Istilah } from '@/components/ui/istilah'
import { Label } from '@/components/ui/label'
import { TandaWajib } from '@/components/ui/penanda-isian'
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
  const { hari } = ringkasEtape(etape)
  const peringatanKode = (kode: string) => peringatan.find((w) => w.kode === kode)?.pesan
  const id = (k: string) => `etape-${idAwal}-${k}`
  const tarif30 = batasHotel !== null ? Math.round(batasHotel * 0.3) : null

  const tglAwal = parseTanggal(etape.berangkat)
  const tglAkhir = parseTanggal(etape.pulang)
  const listHari = tglAwal && tglAkhir && selisihHari(tglAwal, tglAkhir) >= 0 ? daftarHariIso(tglAwal, tglAkhir) : []

  const semuaFullboard = (etape.fullboardDates ?? []).length >= (hari ?? 0) && (hari ?? 0) > 0
  const defaultMalam = hari ? (semuaFullboard ? 0 : Math.max(hari - 1, 0)) : 0
  const isManualMalam = etape.malamOverride != null
  const tanpaMenginap = hari === 1 && !isManualMalam

  // ST lama ditampilkan sebagai kartu; baru tersimpan dalam bentuk kartu saat pengguna mengubahnya.
  const bentuk = keBentukKartu(etape)
  const kartu = bentuk.hotelTambahan ?? []
  const listMalamDasar = listHari.slice(0, Math.max(0, etape.malamOverride ?? defaultMalam))
  const tglKartu = (r: HotelTambahan) => r.tanggal.filter((t) => listMalamDasar.includes(t))

  /** Simpan perubahan; satu kartu manual otomatis mencakup semua malam yang kosong. */
  const simpan = (patch: Partial<EtapePayload>) => {
    const baru = { ...bentuk, ...patch }
    const daftar = baru.hotelTambahan ?? []
    const pertama = daftar[0]
    if (daftar.length === 1 && pertama && (pertama.sumber ?? 'manual') === 'manual') {
      const bukanHotel = [...(baru.hotelPihakLainDates ?? []), ...(baru.hotel30Dates ?? [])]
      baru.hotelTambahan = [{ ...pertama, tanggal: listMalamDasar.filter((t) => !bukanHotel.includes(t)) }]
    }
    onUbah(baru)
  }
  const ubahKartu = (i: number, patch: Partial<HotelTambahan>) =>
    onUbah({
      ...bentuk,
      hotelTambahan: kartu.map((r, j) => (j === i ? { ...r, ...patch, diubah: r.sumber === 'kuitansi' ? true : r.diubah } : r)),
    })

  const hotelPihakLain = useTanggalTerpilih(bentuk, 'hotelPihakLainDates', listMalamDasar, (patch) => {
    const dates = patch.hotelPihakLainDates ?? []
    simpan({ ...patch, hotelTambahan: kartu.map((r) => ({ ...r, tanggal: r.tanggal.filter((t) => !dates.includes(t)) })) })
  })
  const malamBukanPihakLain = listMalamDasar.filter((t) => !hotelPihakLain.aktif.includes(t))
  const hotel30 = useTanggalTerpilih(bentuk, 'hotel30Dates', malamBukanPihakLain, (patch) => {
    const dates = patch.hotel30Dates ?? []
    simpan({ ...patch, hotel30Persen: dates.length > 0, hotelTambahan: kartu.map((r) => ({ ...r, tanggal: r.tanggal.filter((t) => !dates.includes(t)) })) })
  })
  const malamUntukKartu = malamBukanPihakLain.filter((t) => !hotel30.aktif.includes(t))
  const tglTerisiKartu = new Set(kartu.flatMap(tglKartu).filter((t) => malamUntukKartu.includes(t)))
  const jmlHotel30 = hotel30.jumlah
  const malamKosong = malamUntukKartu.filter((t) => !tglTerisiKartu.has(t))
  const tglUangHarianPihakLain = (etape.tanpaUangHarianDates ?? []).filter((t) => listMalamDasar.includes(t))

  const tarif30Aktif = bentuk.hotelTarif ?? tarif30 ?? 0
  const subtotalKartu = kartu.reduce((s, r) => s + r.tarif * tglKartu(r).filter((t) => malamUntukKartu.includes(t)).length, 0)
  const subtotal = subtotalKartu + jmlHotel30 * tarif30Aktif
  const malamTerisi = listMalamDasar.length - malamKosong.length
  const pesanPeringatan = ['MALAM_BERLEBIH', 'MALAM_BELUM_TERISI'].map(peringatanKode).filter(Boolean)
  const judulBaris = `Tujuan ${nomor}${etape.kota ? ` - ${etape.kota}` : ''}`

  return (
    <div className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-base font-semibold">{judulBaris}</h4>
      {pesanPeringatan.map((pesan) => (
        <p key={pesan} className="flex items-start gap-1 text-sm font-medium text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> {pesan}
        </p>
      ))}
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
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              {malamTerisi} dari {listMalamDasar.length} malam terisi
              {malamKosong.length === 0 && listMalamDasar.length > 0 ? <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Lengkap" /> : null}
            </span>
            <span className="font-mono tabular-nums">Subtotal {rupiah(subtotal)}</span>
          </div>

          {kartu.map((r, i) => {
            const urutan = i + 1
            const dipakaiLain = kartu.filter((_, j) => j !== i).flatMap((x) => x.tanggal)
            const malamIni = tglKartu(r).filter((t) => malamUntukKartu.includes(t))
            const dariKuitansi = r.sumber === 'kuitansi'
            const selisihKuitansi = dariKuitansi && r.malamKuitansi != null && r.malamKuitansi !== malamIni.length
            return (
              <div key={r.berkasId ?? `m-${i}`} className="grid gap-3 rounded-lg border bg-card/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Penginapan {urutan}</span>
                    <Badge variant={dariKuitansi ? 'default' : 'muted'}>{dariKuitansi ? (r.diubah ? 'Dari kuitansi, diubah' : 'Dari kuitansi') : 'Manual'}</Badge>
                  </div>
                  <Button type="button" variant="ghost" size="icon" title={`Hapus penginapan ${urutan}`} aria-label={`Hapus penginapan ${urutan}`} onClick={() => onUbah({ ...bentuk, hotelTambahan: kartu.filter((_, j) => j !== i) })}>
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
                <div className="grid items-end gap-2 sm:grid-cols-[1fr_13rem]">
                  <div className="grid gap-1">
                    <Label htmlFor={id(`nama-${urutan}`)}>Nama hotel / penginapan</Label>
                    <Input id={id(`nama-${urutan}`)} placeholder="Nama hotel, homestay, atau penginapan" value={r.nama} onChange={(e) => ubahKartu(i, { nama: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={i === 0 ? id('tarif') : id(`tarif-${urutan}`)}>
                      Tarif per malam
                      <TandaWajib />
                    </Label>
                    <RupiahInput awalan className="font-mono" id={i === 0 ? id('tarif') : id(`tarif-${urutan}`)} value={r.tarif || null} onChange={(v) => ubahKartu(i, { tarif: v ?? 0 })} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Malam menginap di penginapan ${urutan}`}>
                  {malamUntukKartu.map((t) => {
                    const dipilih = r.tanggal.includes(t)
                    const terpakai = dipakaiLain.includes(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={dipilih}
                        disabled={terpakai}
                        title={terpakai ? 'Sudah dipilih di penginapan lain' : undefined}
                        onClick={() => ubahKartu(i, { tanggal: dipilih ? r.tanggal.filter((x) => x !== t) : [...r.tanggal, t].sort() })}
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {batasHotel !== null ? `Batas SBM ${rupiah(batasHotel)}` : 'Batas SBM belum tersedia'}
                    {malamIni.length > 0 ? ` | ${formatDaftarTanggal(malamIni)}` : ''}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {malamIni.length} malam × {rupiah(r.tarif)} = {rupiah(malamIni.length * r.tarif)}
                  </span>
                </div>
                {batasHotel !== null && r.tarif > batasHotel ? (
                  <p className="text-xs font-medium text-warning-foreground">Tarif melebihi batas SBM {rupiah(batasHotel)}.</p>
                ) : null}
                {malamIni.length === 0 ? <p className="text-xs font-medium text-warning-foreground">Belum ada malam dipilih.</p> : null}
                {selisihKuitansi ? (
                  <p className="text-xs font-medium text-warning-foreground">
                    Kuitansi {r.malamKuitansi} malam, terpilih {malamIni.length} malam. Periksa tanggalnya.
                  </p>
                ) : null}
              </div>
            )
          })}

          <Button
            type="button"
            id={kartu.length === 0 ? id('tarif') : undefined}
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              onUbah({
                ...bentuk,
                hotelTambahan: [...kartu, { nama: '', tarif: 0, sumber: 'manual', tanggal: kartu.length === 0 ? malamKosong : [] }],
              })
            }
          >
            <PlusIcon /> Tambah penginapan
          </Button>

          {semuaFullboard && !isManualMalam ? (
            <p className="text-xs text-muted-foreground">Otomatis 0 malam (seluruh hari paket rapat fullboard diatur pada tab Uang Harian).</p>
          ) : null}
          <details className="text-xs" open={isManualMalam || undefined}>
            <summary className="cursor-pointer text-muted-foreground">Pengaturan lanjutan</summary>
            <div className="mt-2 grid gap-2">
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onUbah({ ...bentuk, malamOverride: 0, hotelTambahan: [], hotelPihakLainDates: [], hotel30Dates: [], hotel30Persen: false })}>
                Tidak menginap
              </Button>
              {isManualMalam ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button type="button" variant="outline" size="icon" className="size-7" disabled={(etape.malamOverride ?? 0) <= 0} onClick={() => onUbah({ ...bentuk, malamOverride: Math.max(0, (etape.malamOverride ?? 0) - 1) })} aria-label="Kurangi 1 malam">
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
                      if (!isNaN(v) && v >= 0) onUbah({ ...bentuk, malamOverride: v })
                    }}
                    className="h-7 w-14 rounded-md border border-input bg-background px-2 text-center text-sm font-semibold font-mono tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => onUbah({ ...bentuk, malamOverride: (etape.malamOverride ?? 0) + 1 })} aria-label="Tambah 1 malam">
                    <PlusIcon className="size-3.5" aria-hidden />
                  </Button>
                  <span>malam</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onUbah({ ...bentuk, malamOverride: null })}>
                    <RotateCcwIcon className="size-3" aria-hidden /> Kembali otomatis
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="h-7 w-fit px-2 text-xs" onClick={() => onUbah({ ...bentuk, malamOverride: defaultMalam })}>
                  Atur jumlah malam manual
                </Button>
              )}
            </div>
          </details>
        </div>
      )}

      {listMalamDasar.length > 0 ? (
        <div className="grid gap-3 border-t pt-4">
          <h5 className="text-sm font-semibold text-muted-foreground">Malam tanpa biaya hotel penuh</h5>
          <BagianTanggal
            judul="Penginapan ditanggung pihak lain"
            chip={`Pihak lain ${hotelPihakLain.jumlah} malam | Dibayar SPJ ${malamBukanPihakLain.length} malam`}
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
                onClick={() => simpan({ hotelPihakLainDates: tglUangHarianPihakLain, hotelTambahan: kartu.map((r) => ({ ...r, tanggal: r.tanggal.filter((t) => !tglUangHarianPihakLain.includes(t)) })) })}
              >
                Samakan dengan tanggal uang harian pihak lain
              </button>
            ) : null}
          </BagianTanggal>
          {malamBukanPihakLain.length > 0 ? (
          <BagianTanggal
            judul="Menginap tanpa fasilitas hotel (biaya penginapan 30%)"
            chip={`${jmlHotel30} dari ${malamBukanPihakLain.length} malam (30%)`}
            petunjuk="Pilih tanggal/malam menginap tanpa fasilitas hotel (30% dari tarif SBM):"
            gaya="primer"
            akhiranTerpilih="(30%)"
            listHari={malamBukanPihakLain}
            tanggal={hotel30}
          >
            {jmlHotel30 > 0 ? (
              <div className="grid gap-2">
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <strong>{jmlHotel30} malam</strong> tanpa fasilitas hotel berhak atas <strong>30% SBM</strong>
                    {tarif30 !== null ? ` (${rupiah(tarif30)}/malam)` : ''} dan otomatis tercatat di <Istilah kata="DPR" />.{' '}
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
