import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileDownIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  buatNaskahStAwal,
  formatHariDenganTerbilang,
  formatRentangWaktuSt,
  hitungLamaHariSt,
  pakaiLampiranPelaksana,
  tanggalIndonesia,
  type NaskahStDto,
  type NaskahStPayload,
  type NaskahStPelaksanaPayload,
} from '@spjan/shared'

import { IsiDariUndangan } from '@/components/st/isi-dari-undangan'
import { NaskahPratinjau } from '@/components/st/naskah-pratinjau'
import { PageHeader } from '@/components/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { pesanGalat } from '@/lib/format'
import { geser } from '@/lib/geser'
import {
  useBuatSpjDariNaskah,
  useNaskahSt,
  usePegawai,
  usePengaturan,
  useSimpanNaskahSt,
} from '@/lib/queries'
import { unduhBlob } from '@/lib/unduh'
import { cn } from '@/lib/utils'

/** Kartu pilihan format nomor surat (SRIKANDI / manual). */
function PilihanFormat({
  aktif,
  judul,
  onPilih,
  children,
}: {
  aktif: boolean
  judul: string
  onPilih: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onPilih}
      aria-pressed={aktif}
      className={cn(
        'cursor-pointer rounded-lg border p-3.5 text-left text-sm transition-all',
        aktif ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-accent/40',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-foreground">{judul}</span>
        {aktif && <CheckIcon className="size-4 text-primary" />}
      </div>
      <p className="text-xs text-muted-foreground">{children}</p>
    </button>
  )
}

/** Bentuk isian formulir dari naskah tersimpan. */
function payloadDariNaskah(n: NaskahStDto): NaskahStPayload {
  return {
    nomor: n.nomor,
    modeNomor: n.modeNomor,
    tanggal: n.tanggal,
    tempatNaskah: n.tempatNaskah,
    maksudTugas: n.maksudTugas,
    lokasiTugas: n.lokasiTugas,
    tanggalMulai: n.tanggalMulai,
    tanggalSelesai: n.tanggalSelesai,
    lamaHari: n.lamaHari,
    dasarHukum: n.dasarHukum,
    dasarSpesifik: n.dasarSpesifik,
    pelaporanHari: n.pelaporanHari,
    pembebananAnggaran: n.pembebananAnggaran,
    penandatanganJabatan: n.penandatanganJabatan,
    penandatanganNama: n.penandatanganNama,
    penandatanganNip: n.penandatanganNip,
    tembusan: n.tembusan,
    pelaksana: n.pelaksana.map(({ pegawaiId, nama, nip, jabatan }) => ({ pegawaiId, nama, nip, jabatan })),
  }
}

function NaskahStEditorForm({ awal, stId }: { awal: NaskahStPayload; stId?: number }) {
  const navigate = useNavigate()
  const isEdit = Boolean(stId)

  const pegawaiQuery = usePegawai(true)
  const simpanMutation = useSimpanNaskahSt(stId)
  const buatSpjMutation = useBuatSpjDariNaskah()

  const pegawaiList = useMemo(() => pegawaiQuery.data ?? [], [pegawaiQuery.data])

  const [form, setForm] = useState<NaskahStPayload>(awal)
  const [sedangUnduh, setSedangUnduh] = useState(false)

  /** Ubah sebagian isian formulir. */
  function ubah(patch: Partial<NaskahStPayload>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  // Lama hari dihitung ulang tiap tanggal mulai / selesai berubah
  function ubahTanggalMulai(tgl: string | null) {
    if (tgl) setForm((p) => ({ ...p, tanggalMulai: tgl, lamaHari: hitungLamaHariSt(tgl, p.tanggalSelesai) }))
  }

  function ubahTanggalSelesai(tgl: string | null) {
    if (tgl) setForm((p) => ({ ...p, tanggalSelesai: tgl, lamaHari: hitungLamaHariSt(p.tanggalMulai, tgl) }))
  }

  function tambahPelaksana(pelaksana: NaskahStPelaksanaPayload) {
    setForm((p) => ({ ...p, pelaksana: [...p.pelaksana, pelaksana] }))
  }

  function tambahPelaksanaDariPegawai(pegId: number) {
    const peg = pegawaiList.find((p) => p.id === pegId)
    if (!peg) return
    if (form.pelaksana.some((p) => p.pegawaiId === pegId)) {
      toast.info('Pegawai ini sudah ada dalam daftar pelaksana.')
      return
    }
    tambahPelaksana({ pegawaiId: peg.id, nama: peg.nama, nip: peg.nip, jabatan: peg.jabatan })
  }

  function ubahPelaksana(index: number, patch: Partial<NaskahStPelaksanaPayload>) {
    setForm((p) => ({ ...p, pelaksana: p.pelaksana.map((x, i) => (i === index ? { ...x, ...patch } : x)) }))
  }

  function hapusPelaksana(index: number) {
    setForm((p) => ({ ...p, pelaksana: p.pelaksana.filter((_, i) => i !== index) }))
  }

  function geserPelaksana(index: number, delta: -1 | 1) {
    setForm((p) => ({ ...p, pelaksana: geser(p.pelaksana, index, delta) }))
  }

  function tambahTembusan() {
    setForm((p) => ({ ...p, tembusan: [...p.tembusan, ''] }))
  }

  function ubahTembusan(index: number, val: string) {
    setForm((p) => ({ ...p, tembusan: p.tembusan.map((t, i) => (i === index ? val : t)) }))
  }

  function hapusTembusan(index: number) {
    setForm((p) => ({ ...p, tembusan: p.tembusan.filter((_, i) => i !== index) }))
  }

  async function handleSimpan() {
    if (!form.maksudTugas.trim()) {
      toast.error('Maksud penugasan wajib diisi.')
      return
    }
    if (!form.lokasiTugas.trim()) {
      toast.error('Lokasi / tempat penugasan wajib diisi.')
      return
    }
    if (form.pelaksana.length === 0) {
      toast.error('Minimal harus ada satu personil pelaksana tugas.')
      return
    }
    for (const [i, p] of form.pelaksana.entries()) {
      if (!p.nama.trim()) {
        toast.error(`Nama pelaksana #${i + 1} belum diisi.`)
        return
      }
    }

    try {
      const res = await simpanMutation.mutateAsync(form)
      toast.success(isEdit ? 'Naskah surat tugas berhasil diperbarui!' : 'Naskah surat tugas berhasil dibuat!')
      if (!isEdit && res?.id) {
        navigate(`/st-naskah/${res.id}`, { replace: true })
      }
    } catch (err) {
      toast.error(pesanGalat(err))
    }
  }

  async function handleUnduhDocx() {
    try {
      setSedangUnduh(true)
      const blob = await api.naskahSt.docx(form, stId)
      unduhBlob(blob, `Surat-Tugas-${(form.nomor || 'Draft').replace(/[^A-Za-z0-9._-]+/g, '_')}.docx`)
      toast.success('Berkas DOCX berhasil diunduh.')
    } catch (err) {
      toast.error(pesanGalat(err))
    } finally {
      setSedangUnduh(false)
    }
  }

  async function handleBuatSpj() {
    if (!stId) {
      toast.info('Simpan naskah surat tugas terlebih dahulu sebelum membuat SPJ.')
      return
    }
    try {
      const res = await buatSpjMutation.mutateAsync(stId)
      toast.success('Draf SPJ berhasil dibuat dari naskah ST!')
      navigate(`/st/${res.spjId}`)
    } catch (err) {
      toast.error(pesanGalat(err))
    }
  }

  const rentangTanggalTeks = formatRentangWaktuSt(form.tanggalMulai, form.tanggalSelesai)
  const lamaHari = form.lamaHari || hitungLamaHariSt(form.tanggalMulai, form.tanggalSelesai)
  const lampiran = pakaiLampiranPelaksana(form.pelaksana.length)
  const nomorPratinjau = form.modeNomor === 'srikandi' ? '${nomor_naskah}' : form.nomor || '${nomor_naskah}'
  const tanggalPratinjau =
    form.modeNomor === 'manual' && form.tanggal ? tanggalIndonesia(form.tanggal) : '${tanggal_naskah}'

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? `Edit Surat Tugas: ${form.nomor}` : 'Buat Surat Tugas Baru'}
        description="Penyusunan naskah dinas penugasan resmi format SRIKANDI TTE & Microsoft Word."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/st-naskah" className={buttonVariants({ variant: 'outline' })}>
              <ArrowLeftIcon className="size-4" /> Kembali
            </Link>
            <Button
              variant="outline"
              disabled={sedangUnduh}
              onClick={handleUnduhDocx}
              title="Unduh format DOCX (siap diunggah ke Srikandi)"
            >
              {sedangUnduh ? <Loader2Icon className="size-4 animate-spin" /> : <FileDownIcon className="size-4" />}
              Unduh DOCX
            </Button>
            {stId ? (
              <Button
                variant="outline"
                className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
                disabled={buatSpjMutation.isPending}
                onClick={handleBuatSpj}
                title="Buat draf SPJ keuangan langsung dari ST ini"
              >
                <ArrowRightIcon className="size-4" /> Lanjutkan ke SPJ
              </Button>
            ) : null}
            <Button disabled={simpanMutation.isPending} onClick={handleSimpan}>
              <SaveIcon className="size-4" /> Simpan
            </Button>
          </div>
        }
      />

      {/* Grid 2 Kolom: Form Input (Kiri) dan Pratinjau Naskah Resmi (Kanan) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Kolom Kiri: Form Editor */}
        <div className="space-y-6 lg:col-span-7">
          <IsiDariUndangan
            naskah={form}
            onTerapkan={ubah}
          />

          {/* 1. Format Naskah & Nomor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Format Naskah & Nomor Surat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PilihanFormat
                  aktif={form.modeNomor === 'srikandi'}
                  judul="Format SRIKANDI (TTE)"
                  onPilih={() => ubah({ modeNomor: 'srikandi', nomor: '${nomor_naskah}' })}
                >
                  Memakai variabel {'${nomor_naskah}'}, {'${tanggal_naskah}'}, dan {'${ttd_pengirim}'}. Siap langsung
                  di-upload ke SRIKANDI.
                </PilihanFormat>
                <PilihanFormat
                  aktif={form.modeNomor === 'manual'}
                  judul="Format Definitif / Manual"
                  onPilih={() => ubah({ modeNomor: 'manual', nomor: form.nomor === '${nomor_naskah}' ? '' : form.nomor })}
                >
                  Ketik nomor surat dan tanggal riil secara manual (untuk naskah cetak fisik / TTD basah).
                </PilihanFormat>
              </div>

              {form.modeNomor === 'manual' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <Field label="Nomor Surat Tugas" htmlFor="st-nomor" mode="wajib">
                    <Input
                      id="st-nomor"
                      placeholder="ST.245/PPS/PEMPS/PSL.04.02/B/10/2026"
                      value={form.nomor}
                      onChange={(e) => ubah({ nomor: e.target.value })}
                    />
                  </Field>
                  <Field label="Tanggal Surat" htmlFor="st-tanggal" mode="opsional">
                    <InputTanggal
                      id="st-tanggal"
                      label="Tanggal surat"
                      nilai={form.tanggal}
                      onUbah={(iso) => ubah({ tanggal: iso })}
                    />
                  </Field>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tempat Penandatanganan" htmlFor="st-tempat" mode="wajib">
                  <Input
                    id="st-tempat"
                    placeholder="Jakarta"
                    value={form.tempatNaskah}
                    onChange={(e) => ubah({ tempatNaskah: e.target.value })}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* 2. Maksud & Waktu Penugasan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Maksud, Lokasi & Waktu Penugasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Maksud Penugasan / Kegiatan"
                htmlFor="st-maksud"
                mode="wajib"
                hint="Otomatis mengisi bagian Menimbang dan butir penugasan Untuk"
              >
                <Textarea
                  id="st-maksud"
                  rows={3}
                  placeholder="Menghadiri Rapat Pembahasan Penanganan Tanaman Sawit dalam Proses Transformasi Kulin KK..."
                  value={form.maksudTugas}
                  onChange={(e) => ubah({ maksudTugas: e.target.value })}
                />
              </Field>

              <Field label="Lokasi / Tempat Penugasan" htmlFor="st-lokasi" mode="wajib">
                <Input
                  id="st-lokasi"
                  placeholder="Ruang Rapat CIFOR, Jl. Raya Cifor, Kota Bogor"
                  value={form.lokasiTugas}
                  onChange={(e) => ubah({ lokasiTugas: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <Field label="Tanggal Mulai" htmlFor="st-mulai" mode="wajib">
                  <InputTanggal
                    id="st-mulai"
                    label="Tanggal Mulai"
                    nilai={form.tanggalMulai}
                    onUbah={ubahTanggalMulai}
                  />
                </Field>

                <Field label="Tanggal Selesai" htmlFor="st-selesai" mode="wajib">
                  <InputTanggal
                    id="st-selesai"
                    label="Tanggal Selesai"
                    nilai={form.tanggalSelesai}
                    onUbah={ubahTanggalSelesai}
                  />
                </Field>
              </div>

              <div className="rounded-md bg-muted/50 p-2.5 text-xs flex items-center justify-between text-muted-foreground">
                <span>
                  Lama tugas terhitung: <strong>{formatHariDenganTerbilang(lamaHari)} hari</strong>
                </span>
                <span>
                  Rentang: <strong>{rentangTanggalTeks}</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 3. Dasar Penugasan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Dasar Penugasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Surat Undangan / Nota Dinas / Disposisi Rujukan"
                htmlFor="st-dasar-spesifik"
                mode="opsional"
                hint="Dicantumkan sebagai butir dasar penugasan spesifik (misal nomor surat undangan)"
              >
                <Textarea
                  id="st-dasar-spesifik"
                  rows={2}
                  placeholder="Undangan Direktur Penyiapan Kawasan Perhutanan Sosial Nomor: UN.207/PKPS/PPPS/PSL.01.01/B/10/2026 tanggal 12 Oktober 2026."
                  value={form.dasarSpesifik}
                  onChange={(e) => ubah({ dasarSpesifik: e.target.value })}
                />
              </Field>

              <div className="text-xs text-muted-foreground border rounded-md p-3 bg-card space-y-1.5">
                <p className="font-semibold text-foreground">Dasar Hukum Baku (Standar Kementerian):</p>
                <ol className="list-decimal list-inside space-y-1">
                  {form.dasarHukum.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* 4. Daftar Pelaksana */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">4. Personil yang Ditugaskan ({form.pelaksana.length})</CardTitle>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => tambahPelaksana({ pegawaiId: null, nama: '', nip: '', jabatan: '' })}>
                <PlusIcon className="size-3.5 mr-1" /> Pelaksana Bebas
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tambah Cepat dari Master Pegawai */}
              <div className="flex items-center gap-2">
                <Select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value
                    if (val) tambahPelaksanaDariPegawai(Number(val))
                  }}
                  className="flex-1 text-sm"
                >
                  <option value="">+ Pilih Pegawai dari Master Data SPJAN...</option>
                  {pegawaiList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} ({p.jabatan || 'Pegawai'})
                    </option>
                  ))}
                </Select>
              </div>

              {form.pelaksana.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada pelaksana. Pilih dari master pegawai di atas atau klik Pelaksana Bebas.
                </div>
              ) : (
                <div className="space-y-3">
                  {form.pelaksana.map((pel, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3.5 bg-card/60 space-y-3 relative group transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <span className="font-semibold text-sm text-primary">Personil #{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={idx === 0}
                            onClick={() => geserPelaksana(idx, -1)}
                            title="Geser ke atas"
                          >
                            <ChevronUpIcon className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={idx === form.pelaksana.length - 1}
                            onClick={() => geserPelaksana(idx, 1)}
                            title="Geser ke bawah"
                          >
                            <ChevronDownIcon className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            onClick={() => hapusPelaksana(idx)}
                            title="Hapus personil ini"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Nama Lengkap & Gelar" htmlFor={`st-pel-nama-${idx}`} mode="wajib" className="sm:col-span-2">
                          <Input
                            id={`st-pel-nama-${idx}`}
                            placeholder="Sukardi, S.Hut., M.Si."
                            value={pel.nama}
                            onChange={(e) => ubahPelaksana(idx, { nama: e.target.value })}
                          />
                        </Field>
                        <Field label="Jabatan" htmlFor={`st-pel-jabatan-${idx}`}>
                          <Input
                            id={`st-pel-jabatan-${idx}`}
                            placeholder="PEH Ahli Madya"
                            value={pel.jabatan}
                            onChange={(e) => ubahPelaksana(idx, { jabatan: e.target.value })}
                          />
                        </Field>
                        <Field label="NIP (Opsional)" htmlFor={`st-pel-nip-${idx}`}>
                          <Input
                            id={`st-pel-nip-${idx}`}
                            placeholder="197501012000031001"
                            value={pel.nip}
                            onChange={(e) => ubahPelaksana(idx, { nip: e.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Pembebanan Anggaran & Ketentuan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">5. Pembebanan Anggaran & Pelaporan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Pembebanan Anggaran" htmlFor="st-anggaran" mode="wajib">
                <Textarea
                  id="st-anggaran"
                  rows={2}
                  placeholder="Anggaran DIPA Kantor Pusat Direktorat Jenderal Perhutanan Sosial Tahun Anggaran 2026."
                  value={form.pembebananAnggaran}
                  onChange={(e) => ubah({ pembebananAnggaran: e.target.value })}
                />
              </Field>

              <Field label="Batas Waktu Laporan Tertulis (Hari Kerja)" htmlFor="st-lapor" mode="opsional">
                <Input
                  id="st-lapor"
                  type="number"
                  min={1}
                  max={30}
                  className="w-32"
                  value={form.pelaporanHari}
                  onChange={(e) => ubah({ pelaporanHari: Number(e.target.value) || 5 })}
                />
              </Field>
            </CardContent>
          </Card>

          {/* 6. Penandatangan & Tembusan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">6. Pejabat Penandatangan & Tembusan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Jabatan Penandatangan" htmlFor="st-pj-jabatan" mode="wajib">
                  <Input
                    id="st-pj-jabatan"
                    placeholder="Direktur,"
                    value={form.penandatanganJabatan}
                    onChange={(e) => ubah({ penandatanganJabatan: e.target.value })}
                  />
                </Field>
                <Field label="Nama Pejabat" htmlFor="st-pj-nama" mode="wajib">
                  <Input
                    id="st-pj-nama"
                    placeholder="Dr. Marcus Octavianus Susatyo, S.Hut., M.P."
                    value={form.penandatanganNama}
                    onChange={(e) => ubah({ penandatanganNama: e.target.value })}
                  />
                </Field>
                <Field label="NIP Pejabat" htmlFor="st-pj-nip" mode="opsional">
                  <Input
                    id="st-pj-nip"
                    placeholder="196810191998031001"
                    value={form.penandatanganNip}
                    onChange={(e) => ubah({ penandatanganNip: e.target.value })}
                  />
                </Field>
              </div>

              {/* Tembusan */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Tembusan Naskah</label>
                  <Button type="button" variant="ghost" size="sm" onClick={tambahTembusan} className="h-7 text-xs">
                    <PlusIcon className="size-3 mr-1" /> Tambah Butir
                  </Button>
                </div>
                {form.tembusan.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                    <Input
                      className="text-xs h-8"
                      value={t}
                      placeholder="Pihak penerima tembusan..."
                      onChange={(e) => ubahTembusan(idx, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => hapusTembusan(idx)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Pratinjau Lembar Surat Resmi (A4 Standard Live Preview) */}
        <div className="space-y-3 lg:col-span-5 lg:sticky lg:top-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Pratinjau Naskah Dinas (Live Preview)
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                Standar Tata Naskah Dinas Kementerian (Kop Simetris Tengah & Margin 2cm)
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={sedangUnduh}
              onClick={handleUnduhDocx}
              className="h-7 text-xs gap-1"
            >
              <FileDownIcon className="size-3.5" /> Unduh DOCX
            </Button>
          </div>

          <NaskahPratinjau
            form={form}
            nomor={nomorPratinjau}
            tanggal={tanggalPratinjau}
            lamaHari={lamaHari}
            lampiran={lampiran}
          />
        </div>
      </div>
    </div>
  )
}

export default function NaskahStEditorPage() {
  const { id: idParam } = useParams()
  const isEdit = Boolean(idParam && idParam !== 'baru')
  const stId = isEdit ? Number(idParam) : undefined

  const naskahQuery = useNaskahSt(stId)
  const pengaturanQuery = usePengaturan()

  if (isEdit && naskahQuery.isPending) {
    return <p className="text-sm text-muted-foreground p-6">Memuat naskah surat tugas...</p>
  }
  if (isEdit && naskahQuery.isError) {
    return <p className="text-sm text-destructive p-6">Gagal memuat naskah: {pesanGalat(naskahQuery.error)}</p>
  }

  const pengaturan = pengaturanQuery.data
  const awal: NaskahStPayload =
    isEdit && naskahQuery.data
      ? payloadDariNaskah(naskahQuery.data)
      : // Penandatangan ST = Direktur (bawaan buatNaskahStAwal), bukan "pejabat yang bertanggung jawab" SPTB di Pengaturan.
        buatNaskahStAwal({ tahunAnggaran: pengaturan?.tahunAnggaran })

  return <NaskahStEditorForm awal={awal} stId={stId} key={stId ?? 'baru'} />
}
