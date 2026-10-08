import { useState } from 'react'
import { ChevronDownIcon, PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import {
  STATUS_KODE,
  STATUS_LABEL,
  biayaKosong,
  cocokkanKotaJakartaSekitar,
  etapeKosong,
  indeksBarisTransport,
  isKotaJabodetabek,
  norm,
  tarifTerminal,
  pelaksanaDariPegawai,
  provinsiDariKotaJabodetabek,
  ringkasEtape,
  type BiayaPayload,
  type EtapePayload,
  type PegawaiDto,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
  type StatusKode,
} from '@spjan/shared'

import { FormPegawai } from '@/components/pegawai-form'
import { BiayaForm } from '@/components/st/biaya-form'
import { EtapeForm } from '@/components/st/etape-form'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'
import { tanggalPanjang } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cakupanGalat, type PetaGalat } from '@/lib/validasi'

export function PelaksanaCard({
  nomor,
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
  // Surat tugas dengan banyak pelaksana: hanya yang pertama (atau yang masih kosong) terbuka agar halaman tidak panjang.
  const [bukaManual, setBuka] = useState(nomor === 1 || !p.nama)
  // Kartu yang berisi isian bermasalah selalu terbuka supaya kolom merahnya terlihat.
  const adaGalat = !!galat && Object.keys(galat).length > 0
  const buka = bukaManual || adaGalat
  const id = (k: string) => `pel-${nomor}-${k}`
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined
  const indeks = indeksBarisTransport(p.biaya)

  const ubahEtape = (i: number, patch: Partial<EtapePayload>) =>
    onUbah((x) => {
      const etapeBaru = x.etape.map((e, j) => (j === i ? { ...e, ...patch } : e))
      let biayaBaru = x.biaya

      if (patch.kota) {
        const cocok = cocokkanKotaJakartaSekitar(patch.kota, sbm.transportJakarta)
        if (cocok) {
          biayaBaru = biayaBaru.map((b) => {
            if (b.jenis === 'TRANSPORT_JAKARTA_SEKITAR' && (b.etapeIndex == null || b.etapeIndex === i)) {
              return {
                ...b,
                uraian: cocok.kabKota,
                tarif: cocok.besaran,
                qty: b.qty ?? 2,
              }
            }
            return b
          })
        }
      }

      return {
        ...x,
        etape: etapeBaru,
        biaya: biayaBaru,
      }
    })

  const ubahBiaya = (i: number, patch: Partial<BiayaPayload>) =>
    onUbah((x) => {
      let etapeBaru = x.etape
      const bLama = x.biaya[i]
      const bBaru = { ...bLama, ...patch }

      if (bBaru.jenis === 'TRANSPORT_JAKARTA_SEKITAR') {
        const etapeIdx = bBaru.etapeIndex ?? 0
        const eTarget = etapeBaru[etapeIdx]
        if (eTarget) {
          const patchE: Partial<EtapePayload> = {}
          if (!eTarget.dalamKota8Jam) {
            patchE.dalamKota8Jam = true
            const { hari } = ringkasEtape(eTarget)
            if (hari === 1) patchE.malamOverride = 0
          }
          if (bBaru.uraian) {
            if (!eTarget.kota || isKotaJabodetabek(eTarget.kota)) {
              patchE.kota = bBaru.uraian
            }
            if (!eTarget.provinsi) {
              const prov = provinsiDariKotaJabodetabek(bBaru.uraian)
              if (prov) patchE.provinsi = prov
            }
          }
          if (Object.keys(patchE).length > 0) {
            etapeBaru = etapeBaru.map((e, j) => (j === etapeIdx ? { ...e, ...patchE } : e))
          }
        }
      }

      return {
        ...x,
        etape: etapeBaru,
        biaya: x.biaya.map((b, j) => (j === i ? { ...b, ...patch } : b)),
      }
    })

  const tambahBiaya = (b: BiayaPayload) => onUbah((x) => ({ ...x, biaya: [...x.biaya, b] }))

  function tambahTransportJakartaSekitar() {
    const kotaEtape = p.etape[0]?.kota
    const cocok = cocokkanKotaJakartaSekitar(kotaEtape, sbm.transportJakarta)

    onUbah((x) => {
      let etapeBaru = x.etape
      if (etapeBaru.length > 0 && !etapeBaru[0]?.dalamKota8Jam) {
        const { hari } = ringkasEtape(etapeBaru[0]!)
        etapeBaru = etapeBaru.map((e, j) =>
          j === 0 ? { ...e, dalamKota8Jam: true, ...(hari === 1 ? { malamOverride: 0 } : {}) } : e,
        )
      }

      const biayaBaru: BiayaPayload = {
        ...biayaKosong('TRANSPORT_JAKARTA_SEKITAR'),
        uraian: cocok ? cocok.kabKota : null,
        tarif: cocok ? cocok.besaran : 0,
        qty: 2,
        keterangan: 'Bukti terlampir',
      }

      return {
        ...x,
        etape: etapeBaru,
        biaya: [...x.biaya, biayaBaru],
      }
    })
  }

  function tambahTiketPergi() {
    const sudah = p.biaya.filter((b) => b.jenis === 'TIKET_PERGI').length
    tambahBiaya({ ...biayaKosong('TIKET_PERGI'), etapeIndex: sudah < p.etape.length ? sudah : null })
  }

  function tambahTaksiKedudukan() {
    const tarif = provinsiKedudukan ? (tarifTerminal(sbm, provinsiKedudukan) ?? 0) : 0
    tambahBiaya({
      ...biayaKosong('TAKSI_KEDUDUKAN'),
      tarif,
      qty: 1,
    })
  }

  function tambahTaksiTerminal() {
    const sudah = p.biaya.filter((b) => b.jenis === 'TAKSI_TERMINAL').length
    const etapeIdx = sudah < p.etape.length ? sudah : 0
    const etapeTarget =
      (sudah < p.etape.length && p.etape[sudah]?.provinsi ? p.etape[sudah] : undefined) ??
      p.etape.find((e) => e.provinsi) ??
      p.etape[0]
    const namaProv = etapeTarget?.provinsi || null
    const tarif = namaProv ? (tarifTerminal(sbm, namaProv) ?? 0) : 0

    tambahBiaya({
      ...biayaKosong('TAKSI_TERMINAL'),
      etapeIndex: etapeIdx,
      provinsi: namaProv,
      tarif,
      qty: 2,
      keterangan: null,
    })
  }

  const batasHotel = (e: EtapePayload): number | null => {
    if (!cfg) return null
    return sbm.penginapan[norm(e.provinsi)]?.[cfg.kolomHotel - 1] ?? null
  }

  function tambahDariMenu(jenis: string) {
    if (jenis === 'TIKET_PERGI') tambahTiketPergi()
    else if (jenis === 'TIKET_KEMBALI') tambahBiaya(biayaKosong('TIKET_KEMBALI'))
    else if (jenis === 'TAKSI_KEDUDUKAN') tambahTaksiKedudukan()
    else if (jenis === 'TAKSI_TERMINAL') tambahTaksiTerminal()
    else if (jenis === 'TRANSPORT_JAKARTA_SEKITAR') tambahTransportJakartaSekitar()
    else if (jenis === 'LAINNYA') tambahBiaya(biayaKosong('LAINNYA'))
  }

  const jumlahPeringatan = hasil?.peringatan.length ?? 0
  // Kartu yang belum diisi apa pun dihapus langsung; yang sudah berisi minta konfirmasi karena hapusnya tidak bisa dibatalkan.
  const masihKosong = !p.nama && !p.nip && p.biaya.length === 0 && p.etape.every((e) => !e.kota && !e.kegiatan && !e.berangkat)
  const umum = hasil?.peringatan.filter((w) => w.etape === undefined) ?? []

  return (
    <Card>
      <CardHeader className={cn('flex-row items-center justify-between gap-2', !buka && 'pb-5')}>
        <button
          type="button"
          onClick={() => setBuka(!bukaManual)}
          aria-expanded={buka}
          aria-controls={id('isi')}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronDownIcon className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !buka && '-rotate-90')} />
          <CardTitle className="min-w-0 truncate">
            Pelaksana {nomor}
            {p.nama ? <span className="ml-2 font-normal text-muted-foreground">{p.nama}</span> : null}
          </CardTitle>
        </button>
        {!buka && hasil ? (
          <div className="flex shrink-0 items-center gap-2">
            {jumlahPeringatan > 0 ? <Badge variant="warning">{jumlahPeringatan} perlu diperiksa</Badge> : <Badge variant="success">Lengkap</Badge>}
            <span className="text-sm font-medium tabular-nums">{rupiah(hasil.total)}</span>
          </div>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => (masihKosong ? onHapus() : setDialogHapus(true))}>
          <Trash2Icon className="text-destructive" /> <span className="hidden sm:inline">Hapus pelaksana</span>
          <span className="sr-only sm:hidden">Hapus pelaksana {nomor}</span>
        </Button>
      </CardHeader>
      {buka ? (
        <CardContent id={id('isi')} className="grid gap-5">
          <section className="grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Pilih dari daftar pegawai" htmlFor={id('pil')} className="min-w-48 flex-1">
                <Select
                  id={id('pil')}
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
              </Field>
              <Button variant="outline" onClick={() => setDialogPegawai(true)}>
                <UserPlusIcon /> Pegawai baru
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 items-start">
              <Field label="Nama (dengan gelar)" htmlFor={id('nama')} className="xl:col-span-2" error={galat?.nama}>
                <Input id={id('nama')} value={p.nama} onChange={(e) => onUbah((x) => ({ ...x, nama: e.target.value }))} />
              </Field>
              <Field label="NIP" htmlFor={id('nip')} error={galat?.nip}>
                <Input id={id('nip')} inputMode="numeric" value={p.nip} onChange={(e) => onUbah((x) => ({ ...x, nip: e.target.value }))} />
              </Field>
              <Field label="Jabatan" htmlFor={id('jab')} error={galat?.jabatan}>
                <Input id={id('jab')} value={p.jabatan} onChange={(e) => onUbah((x) => ({ ...x, jabatan: e.target.value }))} />
              </Field>
              <Field label="Instansi" htmlFor={id('instansi')} error={galat?.instansi}>
                <Input id={id('instansi')} value={p.instansi ?? ''} onChange={(e) => onUbah((x) => ({ ...x, instansi: e.target.value }))} />
              </Field>
              <Field label="Status / golongan" htmlFor={id('status')} className="xl:col-span-2" error={galat?.status}>
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
              <Field label="No. SPD" htmlFor={id('spd')}>
                <Input
                  id={id('spd')}
                  placeholder="contoh: 401/SPD/PPS/2026"
                  value={p.noSpd ?? ''}
                  onChange={(e) => onUbah((x) => ({ ...x, noSpd: e.target.value || null }))}
                />
              </Field>
              <Field label="Tanggal SPD" htmlFor={id('tgl-spd')} hint={tanggalPanjang(p.tanggalSpd) || 'Kosong = tanggal surat tugas'}>
                <Input
                  id={id('tgl-spd')}
                  type="date"
                  value={p.tanggalSpd ?? ''}
                  onChange={(e) => onUbah((x) => ({ ...x, tanggalSpd: e.target.value || null }))}
                />
              </Field>
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">Tujuan Perjalanan (satu tujuan per kota)</h3>
            {p.etape.map((e, i) => (
              <EtapeForm
                key={i}
                idAwal={`${nomor}-${i + 1}`}
                nomor={i + 1}
                etape={e}
                provinsi={provinsi}
                bolehRepresentasi={(cfg?.barisRepresentasi ?? 0) > 0}
                batasHotel={batasHotel(e)}
                sbm={sbm}
                peringatan={hasil?.peringatan.filter((w) => w.etape === i) ?? []}
                galat={cakupanGalat(galat, `etape.${i}`)}
                bisaHapus={p.etape.length > 1}
                onUbah={(patch) => ubahEtape(i, patch)}
                onHapus={() =>
                  onUbah((x) => ({
                    ...x,
                    etape: x.etape.filter((_, j) => j !== i),
                    biaya: x.biaya.map((b) => (b.etapeIndex != null && b.etapeIndex >= i ? { ...b, etapeIndex: b.etapeIndex === i ? null : b.etapeIndex - 1 } : b)),
                  }))
                }
              />
            ))}
            <div>
              <Button variant="outline" size="sm" onClick={() => onUbah((x) => ({ ...x, etape: [...x.etape, etapeKosong()] }))}>
                <PlusIcon /> Tambah tujuan (kota lain)
              </Button>
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">Biaya transport dan biaya tambahan</h3>
            {p.biaya.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada biaya. Tambahkan tiket, taksi, atau biaya lain.</p> : null}
            {p.biaya.map((b, i) => (
              <BiayaForm
                key={i}
                biaya={b}
                etapeJumlah={p.etape.length}
                etapeLabel={(k) => `Tujuan ${k + 1}${p.etape[k]?.kota ? ` - ${p.etape[k]?.kota}` : ''}`}
                provinsi={provinsi}
                provinsiKedudukan={provinsiKedudukan}
                baris={indeks[i] != null ? hasil?.transport[indeks[i] as number] : null}
                sbm={sbm}
                onUbah={(patch) => ubahBiaya(i, patch)}
                onHapus={() => onUbah((x) => ({ ...x, biaya: x.biaya.filter((_, j) => j !== i) }))}
              />
            ))}
            <div>
              <Select
                aria-label="Tambah biaya"
                className="w-auto min-w-60"
                value=""
                onChange={(e) => tambahDariMenu(e.target.value)}
              >
                <option value="">+ Tambah biaya...</option>
                <optgroup label="Tiket pesawat">
                  <option value="TIKET_PERGI">Tiket pergi</option>
                  <option value="TIKET_KEMBALI">Tiket kembali</option>
                </optgroup>
                <optgroup label="Taksi dan transport lokal">
                  <option value="TAKSI_KEDUDUKAN">Taksi dari tempat kedudukan ke bandara</option>
                  <option value="TAKSI_TERMINAL">Taksi dari/ke bandara di kota tujuan</option>
                  <option value="TRANSPORT_JAKARTA_SEKITAR">Transport Jakarta - sekitarnya (PP)</option>
                </optgroup>
                <option value="LAINNYA">Biaya lain</option>
              </Select>
            </div>
          </section>

          {hasil ? (
            <section className="grid gap-3 border-t pt-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                {(
                  [
                    ['Transport', hasil.totalTransport],
                    ['Uang harian', hasil.totalUangHarian],
                    ['Representasi', hasil.totalRepresentasi],
                    ['Penginapan', hasil.totalPenginapan],
                  ] as const
                ).map(([label, nilai]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{rupiah(nilai)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">{hasil.terbilang}</span>
                <span className="text-lg font-semibold tabular-nums">{rupiah(hasil.total)}</span>
              </div>
              {umum.length > 0 ? (
                <Alert variant="warning">
                  <ul className="grid gap-0.5">
                    {umum.map((w, i) => (
                      <li key={i}>{w.pesan}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {hasil.catatan.length > 0 ? (
                <ul className="grid gap-0.5 text-xs text-muted-foreground">
                  {hasil.catatan.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </CardContent>
      ) : null}

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
