import { useState } from 'react'
import { PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import {
  STATUS_KODE,
  STATUS_LABEL,
  biayaKosong,
  etapeKosong,
  indeksBarisTransport,
  INSTANSI_BAWAAN,
  pelaksanaDariPegawai,
  type BiayaPayload,
  type PegawaiDto,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
  type StatusKode,
} from '@spjan/shared'

import { FormPegawai } from '@/components/pegawai-form'
import { BiayaBaris, KartuUangHarian } from '@/components/st/biaya-form'
import { BlokForm } from '@/components/st/blok-form'
import { KelompokIsian } from '@/components/st/kelompok-isian'
import { PenginapanEtapeKartu } from '@/components/st/penginapan-kartu'
import { EtapeForm } from '@/components/st/etape-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { MenuAksi } from '@/components/ui/menu-aksi'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { Select } from '@/components/ui/select'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { rupiah, tanggalPanjang } from '@/lib/format'
import { batasHotelEtape, biayaPerTujuan, biayaTaksiKedudukan, biayaTaksiTerminal, hapusEtape, tambahTransportJakartaSekitar, ubahBiaya, ubahEtape } from '@/lib/pelaksana-ubah'
import type { BagianPelaksana } from '@/lib/periksa'
import { cakupanGalat, type PetaGalat } from '@/lib/validasi'

export function PelaksanaCard({
  nomor,
  bagian,
  onBagian,
  terkunci = false,
  p,
  hasil,
  sbm,
  pegawai,
  provinsi,
  provinsiKedudukan,
  galat,
  onUbah,
  onHapus,
}: {
  nomor: number
  /** Sub-tab yang sedang dibuka; dipegang pemanggil supaya "perlu dilengkapi" bisa membukanya. */
  bagian: BagianPelaksana
  onBagian: (bagian: BagianPelaksana) => void
  /** Surat tugas terkunci: isian tidak bisa diubah, tetapi semua sub-tab tetap bisa dibuka. */
  terkunci?: boolean
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  sbm: Sbm
  pegawai: PegawaiDto[]
  provinsi: string[]
  provinsiKedudukan?: string | null
  /** Galat validasi per kolom untuk pelaksana ini (kunci relatif: nama, nip, etape.0.kota, ...). */
  galat?: PetaGalat
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  onHapus: () => void
}) {
  const [dialogPegawai, setDialogPegawai] = useState(false)
  const [dialogHapus, setDialogHapus] = useState(false)
  const adaGalat = !!galat && Object.keys(galat).length > 0
  const id = (k: string) => `pel-${nomor}-${k}`
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined
  const indeks = indeksBarisTransport(p.biaya)

  const tambahBiaya = (b: BiayaPayload) => onUbah((x) => ({ ...x, biaya: [...x.biaya, b] }))

  function tambahDariMenu(jenis: string) {
    if (jenis === 'TIKET_PERGI') tambahBiaya(biayaPerTujuan(p, 'TIKET_PERGI'))
    else if (jenis === 'TIKET_KEMBALI') tambahBiaya(biayaKosong('TIKET_KEMBALI'))
    else if (jenis === 'TAKSI_KEDUDUKAN') tambahBiaya(biayaTaksiKedudukan(provinsiKedudukan, sbm))
    else if (jenis === 'TAKSI_TERMINAL') tambahBiaya(biayaTaksiTerminal(p, sbm))
    else if (jenis === 'TRANSPORT_JAKARTA_SEKITAR') onUbah((x) => tambahTransportJakartaSekitar(x, sbm))
    else if (jenis === 'BBM_KENDARAAN' || jenis === 'TOL_ETOLL') tambahBiaya(biayaPerTujuan(p, jenis))
    else if (jenis === 'LAINNYA') tambahBiaya(biayaKosong('LAINNYA'))
  }

  const jumlahPeringatan = hasil?.peringatan.length ?? 0
  const itemBagian: TabItem<BagianPelaksana>[] = [
    { kunci: 'perjalanan', label: 'Perjalanan', galat: adaGalat },
    { kunci: 'penginapan', label: 'Penginapan' },
    { kunci: 'biaya', label: 'Biaya' },
  ]
  // Kartu yang belum diisi apa pun dihapus langsung; yang sudah berisi minta konfirmasi karena hapusnya tidak bisa dibatalkan.
  const masihKosong = !p.nama && !p.nip && p.biaya.length === 0 && p.etape.every((e) => !e.kota && !e.kegiatan && !e.berangkat)
  const peringatanKode = (kode: string) => hasil?.peringatan.find((w) => w.kode === kode && w.etape === undefined)?.pesan

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="min-w-0 [overflow-wrap:anywhere]">
          Pelaksana {nomor}
          {p.nama ? <span className="ml-2 font-normal text-muted-foreground">{p.nama}</span> : null}
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {hasil ? (
            <>
              {jumlahPeringatan > 0 ? <Badge variant="warning">{jumlahPeringatan} perlu diperiksa</Badge> : <Badge variant="success">Lengkap</Badge>}
              <span className="text-sm font-medium tabular-nums" title={hasil.terbilang}>
                {rupiah(hasil.total)}
              </span>
            </>
          ) : null}
          {terkunci ? null : (
            <MenuAksi
              label={`Atur pelaksana ${nomor}`}
              item={[{ label: 'Hapus pelaksana', ikon: <Trash2Icon className="size-4" />, bahaya: true, onPilih: () => (masihKosong ? onHapus() : setDialogHapus(true)) }]}
            />
          )}
        </div>
      </CardHeader>
      <CardContent id={id('isi')} className="grid gap-5">
        <Tabs gaya="segmen" item={itemBagian} aktif={bagian} onPilih={onBagian} idAwal={`pel-${nomor}-bagian`} label={`Bagian pelaksana ${nomor}`} />
        <TabPanel idAwal={`pel-${nomor}-bagian`} kunci="perjalanan" aktif={bagian === 'perjalanan'}>
          <KelompokIsian terkunci={terkunci}>
            <div className="grid gap-5">
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

              <BlokForm judul="Tujuan Perjalanan">
                {p.etape.map((e, i) => (
                  <EtapeForm
                    key={i}
                    idAwal={`${nomor}-${i + 1}`}
                    nomor={i + 1}
                    etape={e}
                    provinsi={provinsi}
                    sbm={sbm}
                    peringatan={hasil?.peringatan.filter((w) => w.etape === i) ?? []}
                    galat={cakupanGalat(galat, `etape.${i}`)}
                    bisaHapus={p.etape.length > 1}
                    onUbah={(patch) => onUbah((x) => ubahEtape(x, i, patch, sbm))}
                    onHapus={() => onUbah((x) => hapusEtape(x, i))}
                  />
                ))}
                <div>
                  <Button variant="outline" size="sm" onClick={() => onUbah((x) => ({ ...x, etape: [...x.etape, etapeKosong()] }))}>
                    <PlusIcon /> Tambah tujuan (kota lain)
                  </Button>
                </div>
              </BlokForm>

            </div>
          </KelompokIsian>
        </TabPanel>

        <TabPanel idAwal={`pel-${nomor}-bagian`} kunci="biaya" aktif={bagian === 'biaya'}>
          <KelompokIsian terkunci={terkunci}>
            <div className="grid gap-5">
              <BlokForm judul="Transportasi">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="min-w-[240px]" />
                      <col className="w-16" />
                      <col className="w-36" />
                      <col className="w-36" />
                      <col className="min-w-[200px]" />
                      <col className="w-12" />
                      <col className="w-12" />
                    </colgroup>
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr className="text-left [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                        <th scope="col">Komponen Biaya &amp; Provinsi</th>
                        <th scope="col" className="text-center">
                          Qty
                        </th>
                        <th scope="col">Tarif Satuan (Rp)</th>
                        <th scope="col" className="text-right">
                          Subtotal
                        </th>
                        <th scope="col">Keterangan / No. Tiket</th>
                        <th scope="col" className="text-center" title="Tanpa kuitansi resmi (DPR)">
                          DPR
                        </th>
                        <th scope="col">
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.biaya.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-sm text-muted-foreground">
                            Belum ada biaya.
                          </td>
                        </tr>
                      ) : null}
                      {p.biaya.map((b, i) => (
                        <BiayaBaris
                          key={i}
                          biaya={b}
                          etapeJumlah={p.etape.length}
                          etapeLabel={(k) => `Tujuan ${k + 1}${p.etape[k]?.kota ? ` - ${p.etape[k]?.kota}` : ''}`}
                          provinsi={provinsi}
                          provinsiKedudukan={provinsiKedudukan}
                          baris={indeks[i] != null ? hasil?.transport[indeks[i] as number] : null}
                          sbm={sbm}
                          onUbah={(patch) => onUbah((x) => ubahBiaya(x, i, patch))}
                          onHapus={() => onUbah((x) => ({ ...x, biaya: x.biaya.filter((_, j) => j !== i) }))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <MenuAksi
                    label="Tambah biaya"
                    teks="Tambah Biaya"
                    item={[
                      { label: 'Tiket Pergi', onPilih: () => tambahDariMenu('TIKET_PERGI') },
                      { label: 'Tiket Kembali', onPilih: () => tambahDariMenu('TIKET_KEMBALI') },
                      { label: 'Taksi Asal (tempat kedudukan - bandara)', onPilih: () => tambahDariMenu('TAKSI_KEDUDUKAN') },
                      { label: 'Taksi Tujuan (bandara - kota tujuan)', onPilih: () => tambahDariMenu('TAKSI_TERMINAL') },
                      { label: 'Transport Jakarta - sekitarnya (PP)', onPilih: () => tambahDariMenu('TRANSPORT_JAKARTA_SEKITAR') },
                      { label: 'BBM Kendaraan (PP)', onPilih: () => tambahDariMenu('BBM_KENDARAAN') },
                      { label: 'E-Toll (PP)', onPilih: () => tambahDariMenu('TOL_ETOLL') },
                      { label: 'Biaya Riil Lainnya', onPilih: () => tambahDariMenu('LAINNYA') },
                    ]}
                  />
                  <p className="text-sm font-semibold text-foreground">
                    Subtotal Transportasi: <span className="font-mono tabular-nums">{rupiah(hasil?.totalTransport ?? 0)}</span>
                  </p>
                </div>
              </BlokForm>

              {hasil && (hasil.uangHarian.length > 0 || hasil.representasi.length > 0) ? (
                <BlokForm judul="Uang Harian">
                  <KartuUangHarian uangHarian={hasil.uangHarian} representasi={hasil.representasi} total={hasil.totalUangHarian + hasil.totalRepresentasi} />
                </BlokForm>
              ) : null}

            </div>
          </KelompokIsian>
        </TabPanel>

        <TabPanel idAwal={`pel-${nomor}-bagian`} kunci="penginapan" aktif={bagian === 'penginapan'}>
          <KelompokIsian terkunci={terkunci}>
            <div className="grid gap-5">
              <BlokForm judul="Penginapan">
                {p.etape.map((e, i) => (
                  <PenginapanEtapeKartu
                    key={i}
                    idAwal={`${nomor}-${i + 1}`}
                    nomor={i + 1}
                    etape={e}
                    bolehRepresentasi={(cfg?.barisRepresentasi ?? 0) > 0}
                    batasHotel={batasHotelEtape(e, p.status, sbm)}
                    sbm={sbm}
                    peringatan={hasil?.peringatan.filter((w) => w.etape === i) ?? []}
                    onUbah={(patch) => onUbah((x) => ubahEtape(x, i, patch, sbm))}
                  />
                ))}
              </BlokForm>
            </div>
          </KelompokIsian>
        </TabPanel>

        {hasil && hasil.catatan.length > 0 ? (
          <section aria-label="Catatan hitungan pelaksana" className="rounded-lg bg-muted/40 px-4 py-3">
            <ul className="grid gap-0.5 text-xs leading-snug text-muted-foreground">
              {hasil.catatan.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>

      <Dialog open={dialogHapus} onOpenChange={setDialogHapus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus pelaksana {nomor}?</DialogTitle>
            <DialogDescription>
              {p.nama || `Pelaksana ${nomor}`} beserta tujuan perjalanan dan biayanya dihapus dari surat tugas ini. Perubahan baru tersimpan saat Anda menekan Simpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogHapus(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDialogHapus(false)
                onHapus()
              }}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </Card>
  )
}
