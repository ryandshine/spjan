import { useState } from 'react'
import { InfoIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import {
  etapeKosong,
  type PegawaiDto,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
} from '@spjan/shared'

import { BlokForm } from '@/components/st/blok-form'
import { BlokIdentitasPelaksana } from '@/components/st/blok-identitas-pelaksana'
import { BlokTransportasi } from '@/components/st/blok-transportasi'
import { KartuUangHarian } from '@/components/st/biaya-form'
import { EtapeForm } from '@/components/st/etape-form'
import { KelompokIsian } from '@/components/st/kelompok-isian'
import { PenginapanEtapeKartu } from '@/components/st/penginapan-kartu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MenuAksi } from '@/components/ui/menu-aksi'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { rupiah } from '@/lib/format'
import { batasHotelEtape, hapusEtape, ubahEtape } from '@/lib/pelaksana-ubah'
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
  const [dialogHapus, setDialogHapus] = useState(false)
  const adaGalat = !!galat && Object.keys(galat).length > 0
  const id = (k: string) => `pel-${nomor}-${k}`
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined

  const jumlahPeringatan = hasil?.peringatan.length ?? 0
  const isCatatanTransportTiket = (c: string) => {
    const t = c.toLowerCase()
    return t.includes('tiket') || t.includes('rute') || t.includes('transport') || t.includes('taksi')
  }
  const catatanTransport = (hasil?.catatan ?? []).filter(isCatatanTransportTiket)

  const itemBagian: TabItem<BagianPelaksana>[] = [
    { kunci: 'perjalanan', label: 'Perjalanan', galat: adaGalat },
    { kunci: 'penginapan', label: 'Penginapan' },
    { kunci: 'biaya', label: 'Biaya' },
  ]
  // Kartu yang belum diisi apa pun dihapus langsung; yang sudah berisi minta konfirmasi karena hapusnya tidak bisa dibatalkan.
  const masihKosong = !p.nama && !p.nip && p.biaya.length === 0 && p.etape.every((e) => !e.kota && !e.kegiatan && !e.berangkat)

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
              {jumlahPeringatan > 0 ? (
                <Badge variant="warning">{jumlahPeringatan} perlu diperiksa</Badge>
              ) : (
                <Badge variant="success">Data Pelaksana Lengkap</Badge>
              )}
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
              <BlokIdentitasPelaksana nomor={nomor} p={p} hasil={hasil} pegawai={pegawai} galat={galat} onUbah={onUbah} />

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

              {/* Peringatan & Catatan Pagu Tiket / Transportasi untuk Perjalanan */}
              {catatanTransport.length > 0 ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <InfoIcon className="size-3.5 text-primary" aria-hidden />
                    Catatan Pagu &amp; Ketentuan Tiket Transportasi
                  </p>
                  <ul className="grid gap-0.5 text-xs leading-snug text-muted-foreground">
                    {catatanTransport.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </KelompokIsian>
        </TabPanel>

        <TabPanel idAwal={`pel-${nomor}-bagian`} kunci="biaya" aktif={bagian === 'biaya'}>
          <KelompokIsian terkunci={terkunci}>
            <div className="grid gap-5">
              <BlokTransportasi p={p} hasil={hasil} sbm={sbm} provinsi={provinsi} provinsiKedudukan={provinsiKedudukan} onUbah={onUbah} />

              {hasil && (hasil.uangHarian.length > 0 || hasil.representasi.length > 0 || p.etape.some((e) => (e.tanpaUangHarianDates ?? []).length > 0)) ? (
                <BlokForm judul="Uang Harian">
                  <KartuUangHarian
                    uangHarian={hasil.uangHarian}
                    representasi={hasil.representasi}
                    total={hasil.totalUangHarian + hasil.totalRepresentasi}
                    tanpaUangHarianJumlah={p.etape.reduce((sum, e) => sum + (e.tanpaUangHarianDates ?? []).length, 0)}
                    onBukaPenginapan={() => onBagian('penginapan')}
                  />
                </BlokForm>
              ) : null}

              {/* Ringkasan akhir seluruh catatan & pagu biaya pelaksana */}
              {hasil && hasil.catatan.length > 0 ? (
                <section aria-label="Catatan hitungan pelaksana" className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <InfoIcon className="size-3.5 text-primary" aria-hidden />
                    Ringkasan Catatan &amp; Pagu Biaya Pelaksana
                  </p>
                  <ul className="grid gap-0.5 text-xs leading-snug text-muted-foreground">
                    {hasil.catatan.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </section>
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
    </Card>
  )
}
