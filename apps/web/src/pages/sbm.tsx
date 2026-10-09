import { useState } from 'react'
import { toast } from 'sonner'
import {
  STATUS_KODE,
  STATUS_LABEL,
  StatusKonfigurasiMapSchema,
  type KelasTiket,
  type Sbm,
  type StatusKode,
  type StatusKonfigurasi,
} from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { pesanGalat, rupiah } from '@/lib/format'
import { useMe, useSbm, useSimpanStatusSbm, useVersiSbm } from '@/lib/queries'
import { cn } from '@/lib/utils'

const KOLOM_HOTEL_LABEL = ['Pejabat Negara/Wamen/Eselon I', 'Pejabat Negara Lainnya/Eselon II', 'Eselon III/Gol. IV', 'Eselon IV/Gol. III/II/I']

const TAB = [
  ['status', 'Status pegawai'],
  ['uangHarian', 'Uang harian'],
  ['penginapan', 'Penginapan'],
  ['representasi', 'Representasi'],
  ['terminal', 'Taksi bandara'],
  ['tiket', 'Tiket pesawat PP'],
  ['ibukota', 'Transport ibukota-kab'],
  ['jakarta', 'Jakarta-sekitar'],
  ['sewa', 'Sewa kendaraan'],
] as const
type KodeTab = (typeof TAB)[number][0]

function Rp({ n }: { n: number }) {
  return <span>{rupiah(n)}</span>
}

function KonfigurasiStatus({ versiId, awal }: { versiId: number; awal: Record<StatusKode, StatusKonfigurasi> }) {
  const simpan = useSimpanStatusSbm(versiId)
  const admin = useMe().data?.peran === 'admin'
  const [form, setForm] = useState(awal)
  const ubah = (k: StatusKode, patch: Partial<StatusKonfigurasi>) => setForm((f) => ({ ...f, [k]: { ...f[k], ...patch } }))

  async function kirim() {
    const hasil = StatusKonfigurasiMapSchema.safeParse(form)
    if (!hasil.success) return toast.error('Konfigurasi tidak valid.')
    try {
      await simpan.mutateAsync(hasil.data)
      toast.success('Konfigurasi status disimpan.')
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi status pegawai</CardTitle>
        <CardDescription>Kelas tiket bawaan belum diverifikasi terhadap PMK Perjalanan Dinas; sesuaikan bila perlu.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Batas hotel</th>
                <th className="px-3 py-2">Uang representasi</th>
                <th className="px-3 py-2">Kelas tiket</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_KODE.map((k) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{STATUS_LABEL[k]}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={form[k].kolomHotel}
                      onChange={(e) => ubah(k, { kolomHotel: Number(e.target.value) as StatusKonfigurasi['kolomHotel'] })}
                    >
                      {KOLOM_HOTEL_LABEL.map((l, i) => (
                        <option key={l} value={i + 1}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={form[k].barisRepresentasi}
                      onChange={(e) => ubah(k, { barisRepresentasi: Number(e.target.value) as StatusKonfigurasi['barisRepresentasi'] })}
                    >
                      <option value={0}>Tidak berhak</option>
                      <option value={1}>Pejabat Negara/Wamen</option>
                      <option value={2}>Pejabat Eselon I</option>
                      <option value={3}>Pejabat Eselon II</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select value={form[k].kelasTiket} onChange={(e) => ubah(k, { kelasTiket: e.target.value as KelasTiket })}>
                      <option value="Bisnis">Bisnis</option>
                      <option value="Ekonomi">Ekonomi</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button onClick={kirim} disabled={simpan.isPending || !admin} title={admin ? undefined : 'Hanya admin'}>
            {simpan.isPending ? 'Menyimpan...' : 'Simpan konfigurasi'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Tabel({ kode, sbm }: { kode: KodeTab; sbm: Sbm }) {
  switch (kode) {
    case 'uangHarian': {
      const baris = Object.entries(sbm.uangHarian)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        { judul: 'Luar kota', rataKanan: true, sel: ([, v]) => <Rp n={v.luarKota} /> },
        { judul: 'Dalam kota > 8 jam', rataKanan: true, sel: ([, v]) => <Rp n={v.dalamKota8Jam} /> },
        { judul: 'Diklat', rataKanan: true, sel: ([, v]) => <Rp n={v.diklat} /> },
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    case 'penginapan': {
      const baris = Object.entries(sbm.penginapan)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        ...KOLOM_HOTEL_LABEL.map((judul, i) => ({ judul, rataKanan: true, sel: ([, v]: (typeof baris)[number]) => <Rp n={v[i] ?? 0} /> })),
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    case 'representasi': {
      const kolom: Kolom<Sbm['representasi'][number]>[] = [
        { judul: 'Uraian', sel: (r) => r.uraian },
        { judul: 'Luar kota', rataKanan: true, sel: (r) => <Rp n={r.luarKota} /> },
        { judul: 'Dalam kota > 8 jam', rataKanan: true, sel: (r) => <Rp n={r.dalamKota} /> },
      ]
      return <DataTable kolom={kolom} baris={sbm.representasi} cari={false} />
    }
    case 'terminal': {
      const baris = Object.entries(sbm.terminal)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        { judul: 'Besaran per kali', rataKanan: true, sel: ([, n]) => <Rp n={n} /> },
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    case 'tiket': {
      const kolom: Kolom<Sbm['tiketPp'][number]>[] = [
        { judul: 'Asal', teks: (r) => r.asal, sel: (r) => r.asal },
        { judul: 'Tujuan', teks: (r) => r.tujuan, sel: (r) => r.tujuan },
        { judul: 'Bisnis (PP)', rataKanan: true, sel: (r) => <Rp n={r.bisnis} /> },
        { judul: 'Ekonomi (PP)', rataKanan: true, sel: (r) => <Rp n={r.ekonomi} /> },
      ]
      return <DataTable kolom={kolom} baris={sbm.tiketPp} />
    }
    case 'ibukota': {
      const kolom: Kolom<Sbm['transportIbukota'][number]>[] = [
        { judul: 'Provinsi', teks: (r) => r.provinsi, sel: (r) => r.provinsi },
        { judul: 'Ibukota', teks: (r) => r.ibukota, sel: (r) => r.ibukota },
        { judul: 'Kabupaten/kota tujuan', teks: (r) => r.kabKota, sel: (r) => r.kabKota },
        { judul: 'Besaran (sekali jalan)', rataKanan: true, sel: (r) => <Rp n={r.besaran} /> },
      ]
      return <DataTable kolom={kolom} baris={sbm.transportIbukota} />
    }
    case 'jakarta': {
      const kolom: Kolom<Sbm['transportJakarta'][number]>[] = [
        { judul: 'Kabupaten/kota tujuan', teks: (r) => r.kabKota, sel: (r) => r.kabKota },
        { judul: 'Besaran (sekali jalan)', rataKanan: true, sel: (r) => <Rp n={r.besaran} /> },
      ]
      return (
        <div className="grid gap-4">
          <DataTable kolom={kolom} baris={sbm.transportJakarta} cari={false} />
          <p className="text-sm text-muted-foreground">
            Transport kegiatan dalam kabupaten/kota (PP): <strong className="text-foreground">{rupiah(sbm.transportKegiatanPp)}</strong> per orang per kali.
          </p>
        </div>
      )
    }
    case 'sewa': {
      const baris = Object.entries(sbm.sewaKendaraan)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        { judul: 'Roda 4 / hari', rataKanan: true, sel: ([, v]) => <Rp n={v.roda4} /> },
        { judul: 'Roda 6 / bus sedang', rataKanan: true, sel: ([, v]) => <Rp n={v.roda6BusSedang} /> },
        { judul: 'Bus besar', rataKanan: true, sel: ([, v]) => <Rp n={v.busBesar} /> },
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    default:
      return null
  }
}

export default function SbmPage() {
  const versi = useVersiSbm()
  const [dipilih, setDipilih] = useState<number | undefined>()
  const id = dipilih ?? versi.data?.[0]?.id
  const sbm = useSbm(id)
  const [tab, setTab] = useState<KodeTab>('status')

  return (
    <div>
      <PageHeader
        title="Tabel SBM"
        actions={
          versi.data && versi.data.length > 1 ? (
            <Select value={id} onChange={(e) => setDipilih(Number(e.target.value))} className="w-56">
              {versi.data.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.tahunAnggaran} - {v.dasarHukum}
                </option>
              ))}
            </Select>
          ) : null
        }
      />
      {versi.isError || sbm.isError ? <Alert variant="destructive">{pesanGalat(versi.error ?? sbm.error)}</Alert> : null}
      {versi.data?.[0] && id !== undefined && versi.data.find((v) => v.id === id) ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {versi.data.find((v) => v.id === id)?.dasarHukum} - tahun anggaran {versi.data.find((v) => v.id === id)?.tahunAnggaran}
        </p>
      ) : null}
      <div className="mb-5 flex flex-wrap gap-1 border-b">
        {TAB.map(([kode, label]) => (
          <button
            key={kode}
            type="button"
            onClick={() => setTab(kode)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === kode ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {sbm.isPending && id !== undefined ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
      {sbm.data ? (
        tab === 'status' ? (
          <KonfigurasiStatus key={sbm.data.versi.id} versiId={sbm.data.versi.id} awal={sbm.data.data.statusKonfigurasi} />
        ) : (
          <Tabel kode={tab} sbm={sbm.data.data} />
        )
      ) : null}
    </div>
  )
}
