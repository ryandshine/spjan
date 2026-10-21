import {
  BedDoubleIcon,
  CheckIcon,
  InfoIcon,
  LockIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import {
  daftarHariIso,
  isKotaJabodetabek,
  norm,
  parseTanggal,
  ringkasEtape,
  selisihHari,
  type EtapePayload,
  type Peringatan,
  type Sbm,
} from '@spjan/shared'

import { BagianTanggal } from '@/components/st/bagian-tanggal'
import { DasarAturan } from '@/components/st/dasar-aturan'
import { RupiahInput } from '@/components/st/rupiah-input'
import { Button } from '@/components/ui/button'
import { Istilah } from '@/components/ui/istilah'
import { Label } from '@/components/ui/label'
import { TandaWajib } from '@/components/ui/penanda-isian'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { rupiah } from '@/lib/format'
import { useTanggalTerpilih } from '@/lib/use-tanggal-terpilih'

/**
 * Kartu Penginapan untuk satu tujuan: nama hotel, tarif per malam, malam otomatis/manual, subtotal,
 * lalu sub-kartu opsi tambahan (paket rapat, 30%, dalam kota, representasi) yang mengubah cara hitung.
 */
export function PenginapanEtapeKartu({
  idAwal,
  nomor,
  etape,
  bolehRepresentasi,
  batasHotel,
  sbm,
  peringatan,
  onUbah,
}: {
  idAwal: string
  nomor: number
  etape: EtapePayload
  bolehRepresentasi: boolean
  batasHotel: number | null
  sbm?: Sbm
  peringatan: Peringatan[]
  onUbah: (patch: Partial<EtapePayload>) => void
}) {
  const { hari, malam } = ringkasEtape(etape)
  const peringatanKode = (kode: string) => peringatan.find((w) => w.kode === kode)?.pesan
  const id = (k: string) => `etape-${idAwal}-${k}`
  const tarif30 = batasHotel !== null ? Math.round(batasHotel * 0.3) : null
  const provNorm = norm(etape.provinsi)
  const tarifLuarKota = sbm?.uangHarian[provNorm]?.luarKota
  const tarifDalamKota = sbm?.uangHarian[provNorm]?.dalamKota8Jam
  // Opsi dalam kota (> 8 jam) hanya untuk perjalanan sehari; beberapa hari selalu luar kota, jadi opsinya disembunyikan.
  const tampilDalamKota = hari === 1
  const catatanOtomatis = (etape.dalamKota8Jam ?? false) && hari === 1 && isKotaJabodetabek(etape.kota)

  const tglAwal = parseTanggal(etape.berangkat)
  const tglAkhir = parseTanggal(etape.pulang)
  const listHari = tglAwal && tglAkhir && selisihHari(tglAwal, tglAkhir) >= 0 ? daftarHariIso(tglAwal, tglAkhir) : []
  const fullboard = useTanggalTerpilih(etape, 'fullboardDates', listHari, onUbah)
  const tanpaUangHarian = useTanggalTerpilih(etape, 'tanpaUangHarianDates', listHari, onUbah)
  const jmlFullboard = fullboard.jumlah
  const jmlBiasa = listHari.length - jmlFullboard
  const jmlTanpaUangHarian = tanpaUangHarian.jumlah

  const semuaFullboard = fullboard.buka && jmlFullboard > 0 && jmlFullboard === listHari.length
  const defaultMalam = hari ? (semuaFullboard ? 0 : Math.max(hari - 1, 0)) : 0
  const isManualMalam = etape.malamOverride != null
  const tanpaMenginap = hari === 1 && malam === 0 && !isManualMalam
  const tarifEfektif = etape.hotelTarif ?? (etape.hotel30Persen && tarif30 !== null ? tarif30 : null)
  const subtotal = (malam ?? 0) * (tarifEfektif ?? 0)
  const peringatanTarif = peringatanKode('TARIF_HOTEL_KOSONG') ?? peringatanKode('HOTEL_MELEBIHI_BATAS')
  const tarifKosong = (malam ?? 0) > 0 && !tarifEfektif
  const judulBaris = `Tujuan ${nomor}${etape.kota ? ` - ${etape.kota}` : ''}`

  return (
    <div className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-base font-semibold">{judulBaris}</h4>
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
                    : etape.hotel30Persen
                      ? 'Biaya Penginapan 30% SBM'
                      : 'Nama hotel atau penginapan'
                }
                onChange={(e) => onUbah({ hotelNama: e.target.value || null })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={id('tarif')}>
                Tarif hotel per malam
                {!etape.hotel30Persen && (malam ?? 0) > 0 ? <TandaWajib /> : null}
              </Label>
              <div className="relative">
                <RupiahInput
                  awalan
                  id={id('tarif')}
                  className={`font-mono ${etape.hotel30Persen ? 'pr-8' : ''}`}
                  value={tarifEfektif}
                  onChange={(v) => onUbah({ hotelTarif: v })}
                />
                {etape.hotel30Persen && etape.hotelTarif != null ? (
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
              ) : etape.hotel30Persen ? (
                <p className="text-xs text-muted-foreground tabular-nums">30% SBM: {tarif30 !== null ? rupiah(tarif30) : 'Otomatis'}</p>
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

                  {(etape.malamOverride ?? 0) > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
                      onClick={() => onUbah({ malamOverride: 0 })}
                    >
                      Set 0 malam (pihak lain)
                    </Button>
                  ) : (
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

            {semuaFullboard && !isManualMalam ? <p className="text-xs text-muted-foreground">Otomatis 0 malam (seluruh hari paket rapat).</p> : null}
            <p className="mt-1 flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Subtotal Penginapan</span>
              <span className="font-mono tabular-nums">{rupiah(subtotal)}</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 border-t pt-4">
        <div className="grid gap-3">
          <h5 className="text-sm font-semibold text-muted-foreground">Opsi Tambahan (Paket Rapat &amp; Uang Harian)</h5>

          {tampilDalamKota ? (
            <div className="grid gap-1">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
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
            <BagianTanggal
              judul={
                <>
                  Ada paket rapat di hotel (<Istilah kata="Fullboard" />)
                </>
              }
              chip={`${jmlFullboard} dari ${listHari.length} hari terpilih`}
              petunjuk="Pilih tanggal yang tercakup paket rapat:"
              gaya="primer"
              listHari={listHari}
              tanggal={fullboard}
            >
            {jmlFullboard > 0 ? (
              <div className="grid gap-2">
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    <strong>{jmlFullboard} hari</strong> paket rapat (uang saku) dan <strong>{jmlBiasa} hari</strong> lain (uang harian penuh).
                  </span>
                </p>
                {(malam ?? 0) > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <InfoIcon className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                      <span>Hotel kegiatan fullboard dibayarkan pihak lain / panitia?</span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2.5 text-xs border-blue-300 bg-white hover:bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-950"
                      onClick={() => onUbah({ malamOverride: 0 })}
                    >
                      Atur penginapan 0 malam
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <CheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span>Penginapan diatur 0 malam (kamar hotel ditanggung pihak lain / panitia).</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Belum ada tanggal yang dipilih. Klik tombol tanggal di atas untuk menandai hari kegiatan rapat.
              </p>
            )}
            </BagianTanggal>
          ) : null}

          {listHari.length > 0 ? (
            <BagianTanggal
              judul="Uang harian (lumpsum) ditanggung pihak lain"
              chip={`${jmlTanpaUangHarian} dari ${listHari.length} hari dinonaktifkan`}
              petunjuk="Pilih tanggal yang uang hariannya dibayarkan pihak lain (Rp0):"
              gaya="amber"
              akhiranTerpilih="(Pihak lain)"
              listHari={listHari}
              tanggal={tanpaUangHarian}
            >
            {jmlTanpaUangHarian > 0 ? (
              <div className="grid gap-2">
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>
                    <strong>{jmlTanpaUangHarian} hari</strong> uang harian ditanggung pihak lain (Rp0, tidak dibebankan ke SPJ).{' '}
                    {listHari.length - jmlTanpaUangHarian > 0 ? (
                      <>
                        Sisa <strong>{listHari.length - jmlTanpaUangHarian} hari</strong> tetap dibayarkan kantor.
                      </>
                    ) : (
                      <>Seluruh uang harian ditiadakan.</>
                    )}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Belum ada tanggal yang dipilih. Klik tombol tanggal di atas untuk menandai hari yang ditanggung pihak lain.
              </p>
            )}
            <DasarAturan judul="Uang harian ditanggung pihak lain">
              <p>PMK 113/PMK.05/2012: Dalam hal komponen biaya perjalanan dinas (termasuk uang harian) telah ditanggung oleh pihak lain/penyelenggara, biaya tersebut tidak dibebankan lagi pada DIPA pengirim guna menghindari pembayaran ganda (double-funding).</p>
            </DasarAturan>
            </BagianTanggal>
          ) : null}

          {(malam ?? 0) > 0 ? (
            <div className="grid gap-1">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
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
      </div>
    </div>
  )
}
