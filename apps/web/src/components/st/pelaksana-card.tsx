import { useState } from 'react'
import { PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import {
  STATUS_KODE,
  STATUS_LABEL,
  biayaKosong,
  cocokkanKotaJakartaSekitar,
  etapeKosong,
  indeksBarisTransport,
  isKotaJabodetabek,
  norm,
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'
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
  const [tampilkanTiketManual, setTampilkanTiketManual] = useState(false)
  const id = (k: string) => `pel-${nomor}-${k}`
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined
  const indeks = indeksBarisTransport(p.biaya)

  const semuaEtapeSatuHari =
    p.etape.length > 0 &&
    p.etape.every((e) => {
      const { hari } = ringkasEtape(e)
      return hari === 1
    })
  const sudahAdaTiket = p.biaya.some((b) => b.jenis === 'TIKET_PERGI' || b.jenis === 'TIKET_KEMBALI')
  const sembunyikanTombolTiket = semuaEtapeSatuHari && !sudahAdaTiket && !tampilkanTiketManual

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
    const tarif = provinsiKedudukan ? (sbm.terminal[norm(provinsiKedudukan)] ?? 0) : 0
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
    const tarif = namaProv ? (sbm.terminal[norm(namaProv)] ?? 0) : 0

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

  const umum = hasil?.peringatan.filter((w) => w.etape === undefined) ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>
          Pelaksana {nomor}
          {p.nama ? <span className="ml-2 font-normal text-muted-foreground">{p.nama}</span> : null}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onHapus}>
          <Trash2Icon className="text-destructive" /> Hapus pelaksana
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
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
            <Field label="Tanggal SPD" htmlFor={id('tgl-spd')} hint="Bawaan: tanggal ST bila kosong">
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
          <div className="flex flex-wrap items-center gap-2">
            {!sembunyikanTombolTiket ? (
              <>
                <Button variant="outline" size="sm" onClick={tambahTiketPergi}>
                  <PlusIcon /> Tiket pergi
                </Button>
                <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('TIKET_KEMBALI'))}>
                  <PlusIcon /> Tiket kembali
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" onClick={tambahTaksiKedudukan}>
              <PlusIcon /> Taksi dari kedudukan
            </Button>
            <Button variant="outline" size="sm" onClick={tambahTaksiTerminal}>
              <PlusIcon /> Taksi bandara tujuan
            </Button>
            <Button variant="outline" size="sm" onClick={tambahTransportJakartaSekitar}>
              <PlusIcon /> Transport Jakarta - Sekitar (PP)
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('LAINNYA'))}>
              <PlusIcon /> Biaya lain
            </Button>
            {semuaEtapeSatuHari && !sudahAdaTiket ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setTampilkanTiketManual(!tampilkanTiketManual)}
              >
                <PlusIcon /> {tampilkanTiketManual ? 'Sembunyikan tiket pesawat' : 'Tiket pesawat (jika via udara)'}
              </Button>
            ) : null}
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
