import { useMemo, useState } from 'react'
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
  tanggalIndonesia,
  type NaskahStPayload,
  type NaskahStPelaksanaPayload,
} from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { pesanGalat } from '@/lib/format'
import {
  useBuatSpjDariNaskah,
  useNaskahSt,
  usePegawai,
  usePengaturan,
  useSimpanNaskahSt,
} from '@/lib/queries'
import { cn } from '@/lib/utils'

function NaskahStEditorForm({ awal, stId }: { awal: NaskahStPayload; stId?: number }) {
  const navigate = useNavigate()
  const isEdit = Boolean(stId)

  const pegawaiQuery = usePegawai(true)
  const simpanMutation = useSimpanNaskahSt(stId)
  const buatSpjMutation = useBuatSpjDariNaskah()

  const pegawaiList = useMemo(() => pegawaiQuery.data ?? [], [pegawaiQuery.data])

  const [form, setForm] = useState<NaskahStPayload>(awal)
  const [pegawaiPilihanId, setPegawaiPilihanId] = useState<string>('')
  const [sedangUnduh, setSedangUnduh] = useState(false)

  // Otomatis hitung lama hari saat tanggal mulai / selesai berubah
  function handleTanggalMulaiChange(tgl: string | null) {
    if (!tgl) return
    setForm((prev) => {
      const lama = hitungLamaHariSt(tgl, prev.tanggalSelesai)
      return { ...prev, tanggalMulai: tgl, lamaHari: lama }
    })
  }

  function handleTanggalSelesaiChange(tgl: string | null) {
    if (!tgl) return
    setForm((prev) => {
      const lama = hitungLamaHariSt(prev.tanggalMulai, tgl)
      return { ...prev, tanggalSelesai: tgl, lamaHari: lama }
    })
  }

  // Tambah pelaksana dari master pegawai
  function tambahPelaksanaDariPegawai(pegId: number) {
    const peg = pegawaiList.find((p) => p.id === pegId)
    if (!peg) return
    if (form.pelaksana.some((p) => p.pegawaiId === pegId)) {
      toast.info('Pegawai ini sudah ada dalam daftar pelaksana.')
      return
    }

    setForm((prev) => ({
      ...prev,
      pelaksana: [
        ...prev.pelaksana,
        {
          pegawaiId: peg.id,
          nama: peg.nama,
          nip: peg.nip,
          jabatan: peg.jabatan,
        },
      ],
    }))
    setPegawaiPilihanId('')
  }

  // Tambah pelaksana manual
  function tambahPelaksanaManual() {
    setForm((prev) => ({
      ...prev,
      pelaksana: [
        ...prev.pelaksana,
        {
          pegawaiId: null,
          nama: '',
          nip: '',
          jabatan: '',
        },
      ],
    }))
  }

  function ubahPelaksana(index: number, patch: Partial<NaskahStPelaksanaPayload>) {
    setForm((prev) => {
      const list = [...prev.pelaksana]
      if (list[index]) {
        list[index] = { ...list[index]!, ...patch }
      }
      return { ...prev, pelaksana: list }
    })
  }

  function hapusPelaksana(index: number) {
    setForm((prev) => ({
      ...prev,
      pelaksana: prev.pelaksana.filter((_, i) => i !== index),
    }))
  }

  function geserPelaksana(index: number, arah: 'naik' | 'turun') {
    setForm((prev) => {
      const list = [...prev.pelaksana]
      const target = arah === 'naik' ? index - 1 : index + 1
      if (target < 0 || target >= list.length) return prev
      const temp = list[index]!
      list[index] = list[target]!
      list[target] = temp
      return { ...prev, pelaksana: list }
    })
  }

  // Tembusan
  function tambahTembusan() {
    setForm((prev) => ({
      ...prev,
      tembusan: [...prev.tembusan, ''],
    }))
  }

  function ubahTembusan(index: number, val: string) {
    setForm((prev) => {
      const list = [...prev.tembusan]
      list[index] = val
      return { ...prev, tembusan: list }
    })
  }

  function hapusTembusan(index: number) {
    setForm((prev) => ({
      ...prev,
      tembusan: prev.tembusan.filter((_, i) => i !== index),
    }))
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
      let url = '/api/naskah-st/preview-docx'
      let method = 'POST'
      let body: string | undefined = JSON.stringify(form)

      if (stId) {
        url = `/api/naskah-st/${stId}/docx`
        method = 'GET'
        body = undefined
      }

      const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body,
      })

      if (!res.ok) throw new Error('Gagal mengunduh berkas DOCX')
      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const namaFile = `Surat-Tugas-${(form.nomor || 'Draft').replace(/[^A-Za-z0-9._-]+/g, '_')}.docx`
      a.download = namaFile
      a.click()
      URL.revokeObjectURL(downloadUrl)
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
          {/* 1. Format Naskah & Nomor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Format Naskah & Nomor Surat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setForm((p) => ({ ...p, modeNomor: 'srikandi', nomor: '${nomor_naskah}' }))}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3.5 transition-all text-sm',
                    form.modeNomor === 'srikandi'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-accent/40',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">Format SRIKANDI (TTE)</span>
                    {form.modeNomor === 'srikandi' && <CheckIcon className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Memakai variabel {'${nomor_naskah}'}, {'${tanggal_naskah}'}, dan {'${ttd_pengirim}'}. Siap langsung
                    di-upload ke SRIKANDI.
                  </p>
                </div>

                <div
                  onClick={() => setForm((p) => ({ ...p, modeNomor: 'manual', nomor: p.nomor === '${nomor_naskah}' ? '' : p.nomor }))}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3.5 transition-all text-sm',
                    form.modeNomor === 'manual'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-accent/40',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">Format Definitif / Manual</span>
                    {form.modeNomor === 'manual' && <CheckIcon className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ketik nomor surat dan tanggal riil secara manual (untuk naskah cetak fisik / TTD basah).
                  </p>
                </div>
              </div>

              {form.modeNomor === 'manual' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <Field label="Nomor Surat Tugas" htmlFor="st-nomor" mode="wajib">
                    <Input
                      id="st-nomor"
                      placeholder="ST.245/PPS/PEMPS/PSL.04.02/B/10/2026"
                      value={form.nomor}
                      onChange={(e) => setForm((p) => ({ ...p, nomor: e.target.value }))}
                    />
                  </Field>
                  <Field label="Tanggal Surat" htmlFor="st-tanggal" mode="opsional">
                    <InputTanggal
                      id="st-tanggal"
                      label="Tanggal surat"
                      nilai={form.tanggal}
                      onUbah={(iso) => setForm((p) => ({ ...p, tanggal: iso }))}
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
                    onChange={(e) => setForm((p) => ({ ...p, tempatNaskah: e.target.value }))}
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
                  onChange={(e) => setForm((p) => ({ ...p, maksudTugas: e.target.value }))}
                />
              </Field>

              <Field label="Lokasi / Tempat Penugasan" htmlFor="st-lokasi" mode="wajib">
                <Input
                  id="st-lokasi"
                  placeholder="Ruang Rapat CIFOR, Jl. Raya Cifor, Kota Bogor"
                  value={form.lokasiTugas}
                  onChange={(e) => setForm((p) => ({ ...p, lokasiTugas: e.target.value }))}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <Field label="Tanggal Mulai" htmlFor="st-mulai" mode="wajib">
                  <InputTanggal
                    id="st-mulai"
                    label="Tanggal Mulai"
                    nilai={form.tanggalMulai}
                    onUbah={handleTanggalMulaiChange}
                  />
                </Field>

                <Field label="Tanggal Selesai" htmlFor="st-selesai" mode="wajib">
                  <InputTanggal
                    id="st-selesai"
                    label="Tanggal Selesai"
                    nilai={form.tanggalSelesai}
                    onUbah={handleTanggalSelesaiChange}
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
                  onChange={(e) => setForm((p) => ({ ...p, dasarSpesifik: e.target.value }))}
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
              <Button type="button" variant="outline" size="sm" onClick={tambahPelaksanaManual}>
                <PlusIcon className="size-3.5 mr-1" /> Pelaksana Bebas
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tambah Cepat dari Master Pegawai */}
              <div className="flex items-center gap-2">
                <Select
                  value={pegawaiPilihanId}
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
                            onClick={() => geserPelaksana(idx, 'naik')}
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
                            onClick={() => geserPelaksana(idx, 'turun')}
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
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-foreground block mb-1">
                            Nama Lengkap & Gelar <span className="text-destructive">*</span>
                          </label>
                          <Input
                            placeholder="Sukardi, S.Hut., M.Si."
                            value={pel.nama}
                            onChange={(e) => ubahPelaksana(idx, { nama: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">Jabatan</label>
                          <Input
                            placeholder="PEH Ahli Madya"
                            value={pel.jabatan}
                            onChange={(e) => ubahPelaksana(idx, { jabatan: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">NIP (Opsional)</label>
                          <Input
                            placeholder="197501012000031001"
                            value={pel.nip}
                            onChange={(e) => ubahPelaksana(idx, { nip: e.target.value })}
                          />
                        </div>
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
                  onChange={(e) => setForm((p) => ({ ...p, pembebananAnggaran: e.target.value }))}
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
                  onChange={(e) => setForm((p) => ({ ...p, pelaporanHari: Number(e.target.value) || 5 }))}
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
                    onChange={(e) => setForm((p) => ({ ...p, penandatanganJabatan: e.target.value }))}
                  />
                </Field>
                <Field label="Nama Pejabat" htmlFor="st-pj-nama" mode="wajib">
                  <Input
                    id="st-pj-nama"
                    placeholder="Dr. Marcus Octavianus Susatyo, S.Hut., M.P."
                    value={form.penandatanganNama}
                    onChange={(e) => setForm((p) => ({ ...p, penandatanganNama: e.target.value }))}
                  />
                </Field>
                <Field label="NIP Pejabat" htmlFor="st-pj-nip" mode="opsional">
                  <Input
                    id="st-pj-nip"
                    placeholder="196810191998031001"
                    value={form.penandatanganNip}
                    onChange={(e) => setForm((p) => ({ ...p, penandatanganNip: e.target.value }))}
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
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Pratinjau Naskah Dinas (Live Preview)
            </span>
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

          {/* Lembar Naskah Dinas Resmi (Persis CONTOH SPT.docx) */}
          <div
            className="bg-white text-neutral-900 shadow-xl border border-neutral-300 p-6 sm:p-8 text-[12px] leading-relaxed select-text overflow-x-auto"
            style={{ fontFamily: "'Bookman Old Style', 'Bookman', 'URW Bookman L', 'Palatino Linotype', Georgia, serif" }}
          >
            {/* Kop Resmi Kementerian Kehutanan dengan Logo */}
            <div className="flex items-center gap-4 pb-2">
              <img
                src="/logo-kemenhut.png"
                alt="Logo Kementerian Kehutanan"
                className="w-20 h-20 object-contain shrink-0"
              />
              <div className="flex-1 text-center font-serif">
                <p className="font-bold text-[14px] tracking-wide leading-tight uppercase">
                  KEMENTERIAN KEHUTANAN
                </p>
                <p className="font-bold text-[13px] tracking-wide leading-tight uppercase mt-0.5">
                  DIREKTORAT JENDERAL PERHUTANAN SOSIAL
                </p>
                <p className="font-bold text-[15px] tracking-wide leading-tight uppercase mt-0.5">
                  DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL
                </p>
              </div>
            </div>

            {/* Garis Ganda Pemisah Kop (Garis tebal atas, garis tipis bawah) */}
            <div className="space-y-[2px] mb-4">
              <div className="h-[2.5px] bg-black" />
              <div className="h-[0.75px] bg-black" />
            </div>

            {/* Judul & Nomor Naskah */}
            <div className="text-center my-4">
              <p className="font-bold tracking-widest text-[13px]">SURAT TUGAS</p>
              <p className="text-[12px] mt-0.5">
                Nomor:{' '}
                {form.modeNomor === 'srikandi'
                  ? '${nomor_naskah}'
                  : form.nomor || '${nomor_naskah}'}
              </p>
            </div>

            {/* Jabatan Pemberi Tugas */}
            <div className="text-center font-bold text-[12px] tracking-[0.12em] mb-4 uppercase">
              DIREKTUR PENGENDALIAN PERHUTANAN SOSIAL,
            </div>

            {/* Bagian Tabel Isi (Menimbang, Dasar, Memberi Tugas, Kepada, Untuk) */}
            <div className="space-y-2.5 text-[11.5px] leading-relaxed text-justify">
              {/* Menimbang */}
              <div className="flex gap-2">
                <div className="w-24 shrink-0 flex justify-between font-normal">
                  <span>Menimbang</span>
                  <span>:</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2">
                    <span className="shrink-0">a.</span>
                    <span>
                      bahwa dalam rangka {form.maksudTugas || '...'}, diperlukan untuk menugaskan personil;
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0">b.</span>
                    <span>bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas.</span>
                  </div>
                </div>
              </div>

              {/* Dasar */}
              <div className="flex gap-2">
                <div className="w-24 shrink-0 flex justify-between font-normal">
                  <span>Dasar</span>
                  <span>:</span>
                </div>
                <div className="flex-1 space-y-1">
                  {form.dasarHukum.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="shrink-0">{i + 1}.</span>
                      <span>{d}</span>
                    </div>
                  ))}
                  {form.dasarSpesifik ? (
                    <div className="flex gap-2">
                      <span className="shrink-0">{form.dasarHukum.length + 1}.</span>
                      <span>{form.dasarSpesifik}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* MEMBERI TUGAS, */}
              <div className="text-center font-bold tracking-widest text-[12px] py-2">
                MEMBERI TUGAS,
              </div>

              {/* Kepada */}
              <div className="flex gap-2">
                <div className="w-24 shrink-0 flex justify-between font-normal">
                  <span>Kepada</span>
                  <span>:</span>
                </div>
                <div className="flex-1 space-y-1">
                  {form.pelaksana.length === 0 ? (
                    <p className="italic text-neutral-400">(Belum ada pelaksana yang dipilih)</p>
                  ) : (
                    form.pelaksana.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="shrink-0">{i + 1}.</span>
                        <span>
                          {p.nama}
                          {p.jabatan ? ` / ${p.jabatan}` : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Untuk */}
              <div className="flex gap-2">
                <div className="w-24 shrink-0 flex justify-between font-normal">
                  <span>Untuk</span>
                  <span>:</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2">
                    <span className="shrink-0">1.</span>
                    <span>
                      Melaksanakan perjalanan dinas dalam rangka {form.maksudTugas || '...'} di{' '}
                      {form.lokasiTugas || '...'};
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0">2.</span>
                    <span>
                      Yang bersangkutan melaksanakan perintah tugas selama{' '}
                      <strong>{formatHariDenganTerbilang(lamaHari)} hari</strong> pada tanggal{' '}
                      <strong>{rentangTanggalTeks}</strong>;
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0">3.</span>
                    <span>
                      Selambat-lambatnya {formatHariDenganTerbilang(form.pelaporanHari || 5)} hari setelah
                      melaksanakan tugas, membuat laporan tertulis kepada Direktur PPS;
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0">4.</span>
                    <span>Biaya dibebankan kepada {form.pembebananAnggaran.endsWith('.') ? form.pembebananAnggaran : form.pembebananAnggaran + '.'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Blok Tanda Tangan Resmi */}
            <div className="mt-6 flex justify-end text-[11.5px]">
              <div className="w-64 text-left space-y-0.5">
                <p>
                  {form.tempatNaskah || 'Jakarta'},{' '}
                  {form.modeNomor === 'manual' && form.tanggal
                    ? tanggalIndonesia(form.tanggal)
                    : '${tanggal_naskah}'}
                </p>
                <p>{form.penandatanganJabatan || 'Direktur,'}</p>
                <div className="h-16 flex items-center text-neutral-400 font-mono text-[11px]">
                  {'${ttd_pengirim}'}
                </div>
                <p className="font-semibold">{form.penandatanganNama || 'Dr. Marcus Octavianus Susatyo, S.Hut., M.P.'}</p>
                <p>NIP. {form.penandatanganNip || '196810191998031001'}</p>
              </div>
            </div>

            {/* Tembusan */}
            {form.tembusan.length > 0 ? (
              <div className="mt-5 pt-2 text-[11.5px] space-y-0.5">
                <p className="font-normal">Tembusan:</p>
                <div className="space-y-0.5">
                  {form.tembusan.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="shrink-0">{i + 1}.</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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
  const awal: NaskahStPayload = isEdit && naskahQuery.data ? {
    nomor: naskahQuery.data.nomor,
    modeNomor: naskahQuery.data.modeNomor,
    tanggal: naskahQuery.data.tanggal,
    tempatNaskah: naskahQuery.data.tempatNaskah,
    maksudTugas: naskahQuery.data.maksudTugas,
    lokasiTugas: naskahQuery.data.lokasiTugas,
    tanggalMulai: naskahQuery.data.tanggalMulai,
    tanggalSelesai: naskahQuery.data.tanggalSelesai,
    lamaHari: naskahQuery.data.lamaHari,
    dasarHukum: naskahQuery.data.dasarHukum,
    dasarSpesifik: naskahQuery.data.dasarSpesifik,
    pelaporanHari: naskahQuery.data.pelaporanHari,
    pembebananAnggaran: naskahQuery.data.pembebananAnggaran,
    penandatanganJabatan: naskahQuery.data.penandatanganJabatan,
    penandatanganNama: naskahQuery.data.penandatanganNama,
    penandatanganNip: naskahQuery.data.penandatanganNip,
    tembusan: naskahQuery.data.tembusan,
    pelaksana: naskahQuery.data.pelaksana.map((p) => ({
      pegawaiId: p.pegawaiId,
      nama: p.nama,
      nip: p.nip,
      jabatan: p.jabatan,
    })),
  } : buatNaskahStAwal({
    pjNama: pengaturan?.pjNama,
    pjNip: pengaturan?.pjNip,
    pjJabatan: pengaturan?.pjJabatan,
    tahunAnggaran: pengaturan?.tahunAnggaran,
  })

  return <NaskahStEditorForm awal={awal} stId={stId} key={stId ?? 'baru'} />
}
