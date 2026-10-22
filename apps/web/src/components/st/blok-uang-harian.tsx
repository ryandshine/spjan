import { InfoIcon, TriangleAlertIcon } from 'lucide-react'
import {
  daftarHariIso,
  isKotaJabodetabek,
  norm,
  parseTanggal,
  ringkasEtape,
  selisihHari,
  type BiayaPayload,
  type EtapePayload,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
} from '@spjan/shared'

import { BagianTanggal } from '@/components/st/bagian-tanggal'
import { KartuUangHarian } from '@/components/st/biaya-form'
import { BlokForm } from '@/components/st/blok-form'
import { DasarAturan } from '@/components/st/dasar-aturan'
import { TabelRincianBebas } from '@/components/st/tabel-rincian-bebas'
import { Istilah } from '@/components/ui/istilah'
import { rupiah } from '@/lib/format'
import { ubahBiaya, ubahEtape } from '@/lib/pelaksana-ubah'
import { useTanggalTerpilih } from '@/lib/use-tanggal-terpilih'

function EtapeUangHarianCard({
  nomor,
  etape,
  bolehRepresentasi,
  sbm,
  terkunci = false,
  onUbah,
}: {
  nomor: number
  etape: EtapePayload
  bolehRepresentasi: boolean
  sbm?: Sbm
  terkunci?: boolean
  onUbah: (patch: Partial<EtapePayload>) => void
}) {
  const { hari } = ringkasEtape(etape)
  const provNorm = norm(etape.provinsi)
  const tarifLuarKota = sbm?.uangHarian[provNorm]?.luarKota
  const tarifDalamKota = sbm?.uangHarian[provNorm]?.dalamKota8Jam
  const tampilDalamKota = hari === 1
  const catatanOtomatis = (etape.dalamKota8Jam ?? false) && hari === 1 && isKotaJabodetabek(etape.kota)

  const tglAwal = parseTanggal(etape.berangkat)
  const tglAkhir = parseTanggal(etape.pulang)
  const listHari = tglAwal && tglAkhir && selisihHari(tglAwal, tglAkhir) >= 0 ? daftarHariIso(tglAwal, tglAkhir) : []
  const fullboard = useTanggalTerpilih(etape, 'fullboardDates', listHari, onUbah)
  const tanpaUangHarian = useTanggalTerpilih(etape, 'tanpaUangHarianDates', listHari, onUbah)
  const uangHarian60 = useTanggalTerpilih(etape, 'uangHarian60Dates', listHari, onUbah)

  const jmlFullboard = fullboard.jumlah
  const jmlBiasa = listHari.length - jmlFullboard
  const jmlTanpaUangHarian = tanpaUangHarian.jumlah
  const jmlUangHarian60 = uangHarian60.jumlah
  const isDalamKota = !!etape.dalamKota8Jam && listHari.length === 1
  const tarifHarian = isDalamKota ? tarifDalamKota : tarifLuarKota
  const tarif60 = tarifHarian !== undefined ? Math.round(tarifHarian * 0.6) : null

  const judulBaris = `Tujuan ${nomor}${etape.kota ? ` - ${etape.kota}` : ''}`

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <h4 className="text-sm font-semibold text-foreground">{judulBaris}</h4>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{hari !== null ? `${hari} hari perjalanan` : '-'}</span>
          {tarifHarian !== undefined ? (
            <span className="font-mono font-medium text-foreground">
              Tarif: {rupiah(tarifHarian)}/hari {isDalamKota ? '(Dalam Kota)' : '(Luar Kota)'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4">
        {tampilDalamKota ? (
          <div className="grid gap-1">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
              <input
                type="checkbox"
                disabled={terkunci}
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
                <p>
                  PMK 113/PMK.05/2012 Pasal 14 ayat (3): perjalanan dinas dalam kota lebih dari 8 jam dibayarkan uang harian dalam kota sebesar satu hari penuh sesuai tarif SBM.
                </p>
              </DasarAturan>
            </div>
          </div>
        ) : null}

        {listHari.length > 0 ? (
          <BagianTanggal
            judul="Uang harian 60% (Lumpsum 60%)"
            chip={`${jmlUangHarian60} dari ${listHari.length} hari (60%)`}
            petunjuk="Pilih tanggal yang mendapatkan uang harian 60% (mis. transpor lokal riil / tugas multi-lokasi / penugasan khusus SBM):"
            gaya="indigo"
            akhiranTerpilih="(60%)"
            listHari={listHari}
            tanggal={uangHarian60}
          >
            {jmlUangHarian60 > 0 ? (
              <div className="grid gap-2">
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                  <span>
                    <strong>{jmlUangHarian60} hari</strong> uang harian dibayarkan <strong>60%</strong>
                    {tarif60 !== null ? ` (${rupiah(tarif60)}/hari)` : ''}.
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-warning-foreground">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Belum ada tanggal yang dipilih. Klik tombol tanggal di atas untuk menandai hari yang mendapatkan uang harian 60%.
              </p>
            )}
            <DasarAturan judul="Uang Harian 60% SBM">
              <p>
                Lampiran SBM Kemenkeu &amp; Ketentuan Perjalanan Dinas: Uang harian dibayarkan sebesar 60% dari tarif normal antara lain untuk perjalanan dinas dalam kota lebih dari satu lokasi dengan transpor lokal riil, atau penugasan dinas singkat sesuai ketentuan SBM.
              </p>
            </DasarAturan>
          </BagianTanggal>
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
                    <strong>{jmlFullboard} hari</strong> paket rapat (uang saku rapat) dan <strong>{jmlBiasa} hari</strong> lain (uang harian penuh).
                  </span>
                </p>
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
              <p>
                PMK 113/PMK.05/2012: Dalam hal komponen biaya perjalanan dinas (termasuk uang harian) telah ditanggung oleh pihak lain/penyelenggara, biaya tersebut tidak dibebankan lagi pada DIPA pengirim guna menghindari pembayaran ganda (double-funding).
              </p>
            </DasarAturan>
          </BagianTanggal>
        ) : null}

        {bolehRepresentasi ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
            <input
              type="checkbox"
              disabled={terkunci}
              className="size-4 rounded border-input text-primary focus:ring-primary"
              checked={etape.dinasJabatan ?? false}
              onChange={(e) => onUbah({ dinasJabatan: e.target.checked })}
            />
            <span className="font-medium text-foreground">Perjalanan dinas jabatan (berhak uang representasi)</span>
          </label>
        ) : null}
      </div>
    </div>
  )
}

export function BlokUangHarian({
  p,
  hasil,
  sbm,
  onUbah,
  terkunci = false,
}: {
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  sbm: Sbm
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  terkunci?: boolean
}) {
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined
  const bolehRepresentasi = (cfg?.barisRepresentasi ?? 0) > 0

  // Filter rincian uang harian bebas (UANG_HARIAN_LAIN)
  const itemsUangHarianBebas = p.biaya
    .map((biaya, originalIndex) => ({ biaya, originalIndex }))
    .filter(({ biaya }) => biaya.jenis === 'UANG_HARIAN_LAIN')

  const tambahRincianBebas = () => {
    const baru: BiayaPayload = {
      jenis: 'UANG_HARIAN_LAIN',
      uraian: '',
      qty: 1,
      satuan: 'hari',
      tarif: 0,
      keterangan: null,
      pengeluaranRiil: false,
    }
    onUbah((x) => ({ ...x, biaya: [...x.biaya, baru] }))
  }

  const ubahItemBebas = (originalIndex: number, patch: Partial<BiayaPayload>) => {
    onUbah((x) => ubahBiaya(x, originalIndex, patch))
  }

  const hapusItemBebas = (originalIndex: number) => {
    onUbah((x) => ({ ...x, biaya: x.biaya.filter((_, j) => j !== originalIndex) }))
  }

  // Hitung subtotal bebas
  const subtotalBebas = itemsUangHarianBebas.reduce((sum, item) => {
    const qty = item.biaya.qty && item.biaya.qty > 0 ? item.biaya.qty : 1
    return sum + Math.round(qty * (item.biaya.tarif || 0))
  }, 0)

  // Hitung total keseluruhan uang harian
  const totalOtomatis = (hasil?.totalUangHarian ?? 0) + (hasil?.totalRepresentasi ?? 0) - subtotalBebas
  const totalKeseluruhan = (hasil?.totalUangHarian ?? 0) + (hasil?.totalRepresentasi ?? 0)

  return (
    <div className="grid gap-5">
      <BlokForm judul="Pengaturan Uang Harian &amp; Saku Per Tujuan">
        <div className="grid gap-4">
          {p.etape.map((e, i) => (
            <EtapeUangHarianCard
              key={i}
              nomor={i + 1}
              etape={e}
              bolehRepresentasi={bolehRepresentasi}
              sbm={sbm}
              terkunci={terkunci}
              onUbah={(patch) => onUbah((x) => ubahEtape(x, i, patch, sbm))}
            />
          ))}
        </div>
      </BlokForm>

      {hasil && (hasil.uangHarian.length > 0 || hasil.representasi.length > 0) ? (
        <BlokForm judul="Hasil Hitungan Uang Harian Otomatis SBM">
          <KartuUangHarian
            uangHarian={hasil.uangHarian.filter((b) => !itemsUangHarianBebas.some((it) => it.biaya.uraian === b.uraian && it.biaya.tarif === b.tarif))}
            representasi={hasil.representasi}
            total={Math.max(0, totalOtomatis)}
            tanpaUangHarianJumlah={p.etape.reduce((sum, e) => sum + (e.tanpaUangHarianDates ?? []).length, 0)}
          />
        </BlokForm>
      ) : null}

      <TabelRincianBebas
        judul="Rincian Uang Harian / Saku Tambahan (Bebas / Riil)"
        deskripsi="Tambahkan rincian uang harian atau uang saku kegiatan bebas yang perlu dibayarkan di luar tarif baku SBM (misal uang saku pendampingan lapangan, uang saku masyarakat, transport lokal harian)."
        tombolLabel="Tambah Rincian Uang Harian Bebas"
        placeholderUraian="Contoh: Uang saku pendampingan lapangan KPS"
        satuanBawaan="hari"
        items={itemsUangHarianBebas}
        terkunci={terkunci}
        onTambah={tambahRincianBebas}
        onUbah={ubahItemBebas}
        onHapus={hapusItemBebas}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3">
        <div>
          <span className="text-sm font-semibold text-foreground">Total Keseluruhan Uang Harian</span>
          <p className="text-xs text-muted-foreground">Akumulasi uang harian baku SBM, representasi, dan rincian bebas</p>
        </div>
        <span className="font-mono text-lg font-bold tabular-nums text-foreground">{rupiah(totalKeseluruhan)}</span>
      </div>
    </div>
  )
}
