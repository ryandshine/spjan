import { useRef, useState } from 'react'
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircle2Icon,
  ClockIcon,
  Edit2Icon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  Maximize2Icon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BATAS_BERKAS,
  JENIS_BERKAS_LABEL,
  type BerkasDto,
} from '@spjan/shared'

import { AmbilFotoDialog } from '@/components/ambil-foto-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatUkuran, pesanGalat, tanggalPendek } from '@/lib/format'
import { kompresGambar, type HasilKompresi } from '@/lib/gambar'
import {
  useDaftarBerkas,
  useHapusBerkas,
  useUlangiEkstraksiBerkas,
  useUpdateBerkas,
} from '@/lib/queries'
import { cn } from '@/lib/utils'

function ikonBerkas(mime: string) {
  if (mime.startsWith('image/')) {
    return <ImageIcon className="size-4 text-sky-600" />
  }
  return <FileIcon className="size-4 text-amber-600" />
}

export function BuktiPanel({ stId }: { stId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sedangUnggah, setSedangUnggah] = useState(false)
  const [berkasAkanDihapus, setBerkasAkanDihapus] = useState<BerkasDto | null>(null)
  const [previewFoto, setPreviewFoto] = useState<BerkasDto | null>(null)

  const [tabAktif, setTabAktif] = useState<'semua' | 'dokumentasi'>('semua')
  const [editCaptionId, setEditCaptionId] = useState<number | null>(null)
  const [captionTeks, setCaptionTeks] = useState('')

  const [modalFotoBuka, setModalFotoBuka] = useState(false)
  const [hasilKompresiFoto, setHasilKompresiFoto] = useState<HasilKompresi | null>(null)
  const [sedangKompres, setSedangKompres] = useState(false)
  const [sedangUnggahFoto, setSedangUnggahFoto] = useState(false)

  const { data: daftarBerkas, isLoading, refetch } = useDaftarBerkas(stId)
  const hapus = useHapusBerkas()
  const ulangi = useUlangiEkstraksiBerkas()
  const updateBerkas = useUpdateBerkas()

  const berkasDokumentasi = (daftarBerkas ?? []).filter(
    (b) => b.jenis === 'dokumentasi' || (b.mime.startsWith('image/') && b.jenis !== 'st'),
  )

  function bukaKamera() {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
      cameraInputRef.current.click()
    }
  }

  async function tanganiFotoDiambil(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setModalFotoBuka(true)
    setSedangKompres(true)
    try {
      const hasil = await kompresGambar(file)
      setHasilKompresiFoto(hasil)
    } catch (err) {
      toast.error(`Gagal memproses foto: ${pesanGalat(err)}`)
      setModalFotoBuka(false)
    } finally {
      setSedangKompres(false)
    }
  }

  async function tanganiUnggahFoto(file: File) {
    setSedangUnggahFoto(true)
    try {
      await api.berkas.unggah(file, stId, {
        jenis: 'dokumentasi',
        keterangan: file.name.replace(/\.[^/.]+$/, ''),
      })
      toast.success('Foto dokumentasi berhasil diunggah.')
      setModalFotoBuka(false)
      setHasilKompresiFoto(null)
      void refetch()
    } catch (err) {
      toast.error(`Gagal mengunggah foto: ${pesanGalat(err)}`)
    } finally {
      setSedangUnggahFoto(false)
    }
  }

  async function prosesUnggahDokumentasi(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return

    setSedangUnggah(true)
    let sukses = 0
    let gagal = 0

    for (const file of list) {
      const isGambar = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)
      if (!isGambar) {
        toast.error(`Berkas "${file.name}" bukan gambar (JPG/PNG/WebP).`)
        gagal += 1
        continue
      }

      let berkasFinal = file
      try {
        const kompres = await kompresGambar(file)
        berkasFinal = kompres.file
      } catch {
        berkasFinal = file
      }

      if (berkasFinal.size > BATAS_BERKAS.maksUkuranMb * 1024 * 1024) {
        toast.error(`Foto "${file.name}" melebihi batas ${BATAS_BERKAS.maksUkuranMb} MB.`)
        gagal += 1
        continue
      }

      try {
        await api.berkas.unggah(berkasFinal, stId, {
          jenis: 'dokumentasi',
          keterangan: file.name.replace(/\.[^/.]+$/, ''),
        })
        sukses += 1
      } catch (err) {
        toast.error(`Gagal mengunggah ${file.name}: ${pesanGalat(err)}`)
        gagal += 1
      }
    }

    setSedangUnggah(false)
    if (sukses > 0) {
      toast.success(`${sukses} foto dokumentasi berhasil diunggah & ditambahkan ke dokumen.`)
      setTabAktif('dokumentasi')
      void refetch()
    }
    if (gagal > 0) {
      toast.error(`${gagal} foto gagal diunggah.`)
    }
    if (fotoInputRef.current) {
      fotoInputRef.current.value = ''
    }
  }

  async function prosesUnggah(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return

    setSedangUnggah(true)
    let sukses = 0
    let gagal = 0

    for (const file of list) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isGambar =
        file.type.startsWith('image/') ||
        /\.(jpe?g|png|webp)$/i.test(file.name)

      if (!isPdf && !isGambar) {
        toast.error(`Format berkas "${file.name}" tidak didukung (gunakan PDF/JPG/PNG/WebP).`)
        gagal += 1
        continue
      }

      let berkasFinal = file
      if (isGambar) {
        try {
          const kompres = await kompresGambar(file)
          berkasFinal = kompres.file
        } catch {
          berkasFinal = file
        }
      }

      if (berkasFinal.size > BATAS_BERKAS.maksUkuranMb * 1024 * 1024) {
        toast.error(`Berkas "${file.name}" melebihi batas ${BATAS_BERKAS.maksUkuranMb} MB.`)
        gagal += 1
        continue
      }

      try {
        await api.berkas.unggah(berkasFinal, stId)
        sukses += 1
      } catch (err) {
        toast.error(`Gagal mengunggah ${file.name}: ${pesanGalat(err)}`)
        gagal += 1
      }
    }

    setSedangUnggah(false)
    if (sukses > 0) {
      toast.success(`${sukses} berkas berhasil diunggah. AI akan memproses otomatis.`)
      void refetch()
    }
    if (gagal > 0) {
      toast.error(`${gagal} berkas gagal diunggah. Periksa format dan ukuran berkas.`)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function tanganiHapus() {
    if (!berkasAkanDihapus) return
    try {
      await hapus.mutateAsync(berkasAkanDihapus.id)
      toast.success(`Berkas "${berkasAkanDihapus.namaAsli}" berhasil dihapus.`)
      if (previewFoto?.id === berkasAkanDihapus.id) setPreviewFoto(null)
      setBerkasAkanDihapus(null)
    } catch (err) {
      toast.error(`Gagal menghapus berkas: ${pesanGalat(err)}`)
    }
  }

  async function tanganiUlangi(id: number) {
    try {
      await ulangi.mutateAsync(id)
      toast.success('Ekstraksi AI dijadwalkan ulang.')
    } catch (err) {
      toast.error(`Gagal menjadwalkan ulang: ${pesanGalat(err)}`)
    }
  }

  async function simpanCaption(id: number) {
    try {
      await updateBerkas.mutateAsync({
        id,
        payload: { keterangan: captionTeks.trim() || null },
      })
      toast.success('Keterangan foto disimpan.')
      setEditCaptionId(null)
    } catch (err) {
      toast.error(`Gagal menyimpan keterangan: ${pesanGalat(err)}`)
    }
  }

  const adaProsesAi = daftarBerkas?.some(
    (b) => b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan'
  )

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>Bukti Dokumen & Berkas</span>
            {daftarBerkas && daftarBerkas.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {daftarBerkas.length} berkas
              </Badge>
            )}
            {berkasDokumentasi.length > 0 && (
              <Badge variant="default" className="text-xs font-normal">
                {berkasDokumentasi.length} foto dokumentasi
              </Badge>
            )}
            {adaProsesAi && (
              <Badge variant="default" className="text-xs animate-pulse">
                <Loader2Icon className="mr-1 size-3 animate-spin" />
                AI sedang mengekstrak...
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Unggah kuitansi/invoice hotel, tiket pesawat, boarding pass, serta <strong>foto-foto dokumentasi kegiatan</strong> untuk lampiran SPJ.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Input file dokumen umum */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void prosesUnggah(e.target.files)
            }}
          />
          {/* Input foto dokumentasi khusus */}
          <input
            ref={fotoInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void prosesUnggahDokumentasi(e.target.files)
            }}
          />
          {/* Input kamera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void tanganiFotoDiambil(e)}
          />

          <Button
            variant="outline"
            size="sm"
            disabled={sedangUnggah || sedangUnggahFoto}
            onClick={() => fileInputRef.current?.click()}
          >
            {sedangUnggah ? (
              <>
                <Loader2Icon className="mr-1 size-4 animate-spin" /> Mengunggah...
              </>
            ) : (
              <>
                <UploadCloudIcon className="mr-1 size-4" /> Unggah Berkas
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={sedangUnggah || sedangUnggahFoto}
            onClick={() => fotoInputRef.current?.click()}
            title="Upload foto dokumentasi kegiatan untuk lampiran lembar foto di dokumen SPJ"
          >
            <PlusIcon className="mr-1 size-4" /> Foto Dokumentasi
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={sedangUnggah || sedangUnggahFoto}
            onClick={bukaKamera}
          >
            <CameraIcon className="mr-1 size-4" /> Ambil Foto
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tab Filter Tampilan */}
        <div className="flex items-center gap-2 border-b pb-2">
          <button
            type="button"
            onClick={() => setTabAktif('semua')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              tabAktif === 'semua'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            Semua Berkas ({daftarBerkas?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setTabAktif('dokumentasi')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              tabAktif === 'dokumentasi'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ImageIcon className="size-3.5" />
            Foto Dokumentasi ({berkasDokumentasi.length})
          </button>
        </div>

        {tabAktif === 'dokumentasi' ? (
          /* TAMPILAN GALERI DOKUMENTASI */
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-sky-50 dark:bg-sky-950/40 p-3 text-xs text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 shrink-0" />
                <span>
                  Foto-foto di bawah ini akan otomatis dimuat pada lembaran baru <strong>Bukti Dokumentasi Kegiatan</strong> di dokumen SPJ.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-white dark:bg-card shrink-0"
                onClick={() => fotoInputRef.current?.click()}
              >
                <PlusIcon className="mr-1 size-3" /> Tambah Foto
              </Button>
            </div>

            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Memuat foto...</p>
            ) : berkasDokumentasi.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <ImageIcon className="size-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">Belum ada foto dokumentasi</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm">
                  Unggah foto dokumentasi kegiatan di lapangan, rapat koordinasi, atau kunjungan kerja untuk dimasukkan ke dokumen SPJ.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => fotoInputRef.current?.click()}>
                    <UploadCloudIcon className="mr-1 size-4" /> Upload Foto Sekarang
                  </Button>
                  <Button size="sm" variant="secondary" onClick={bukaKamera}>
                    <CameraIcon className="mr-1 size-4" /> Ambil Foto
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {berkasDokumentasi.map((b, idx) => {
                  const isEditing = editCaptionId === b.id
                  return (
                    <div
                      key={b.id}
                      className="group relative flex flex-col rounded-lg border bg-card overflow-hidden shadow-sm transition-all hover:shadow-md"
                    >
                      {/* Image Thumbnail with Overlay Actions */}
                      <div className="relative aspect-[4/3] w-full bg-muted overflow-hidden">
                        <img
                          src={`/api/berkas/${b.id}/isi`}
                          alt={b.keterangan || b.namaAsli}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute top-2 left-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white backdrop-blur-sm">
                            Foto #{idx + 1}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="size-7 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm"
                            title="Perbesar Foto"
                            onClick={() => setPreviewFoto(b)}
                          >
                            <Maximize2Icon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="size-7 rounded-full bg-destructive/80 hover:bg-destructive"
                            title="Hapus Foto"
                            onClick={() => setBerkasAkanDihapus(b)}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Caption & Metadata */}
                      <div className="flex flex-1 flex-col p-3 gap-2">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <Input
                              autoFocus
                              value={captionTeks}
                              onChange={(e) => setCaptionTeks(e.target.value)}
                              placeholder="Keterangan / caption foto..."
                              className="text-xs h-7"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void simpanCaption(b.id)
                                if (e.key === 'Escape') setEditCaptionId(null)
                              }}
                            />
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] px-2"
                                onClick={() => setEditCaptionId(null)}
                              >
                                Batal
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-2"
                                disabled={updateBerkas.isPending}
                                onClick={() => void simpanCaption(b.id)}
                              >
                                Simpan
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer group/caption"
                            onClick={() => {
                              setEditCaptionId(b.id)
                              setCaptionTeks(b.keterangan || '')
                            }}
                            title="Klik untuk mengubah keterangan foto"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-foreground line-clamp-2">
                                {b.keterangan || <span className="text-muted-foreground italic">Belum ada keterangan</span>}
                              </p>
                              <Edit2Icon className="size-3 text-muted-foreground opacity-0 group-hover/caption:opacity-100 transition-opacity ml-1 shrink-0" />
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{b.namaAsli}</p>
                          </div>
                        )}
                        <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
                          <span>{formatUkuran(b.ukuran)}</span>
                          <span>{tanggalPendek(b.createdAt.slice(0, 10))}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAMPILAN SEMUA BERKAS (TABEL & DROPZONE) */
          <>
            {/* Dropzone Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files) void prosesUnggah(e.dataTransfer.files)
              }}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <div className="mb-2 flex items-center justify-center gap-2 text-muted-foreground">
                <UploadCloudIcon className="size-7" />
                <span className="text-lg font-light text-muted-foreground/40">/</span>
                <CameraIcon className="size-7 text-primary" />
              </div>
              <p className="text-sm font-medium">
                Tarik & lepaskan berkas bukti ke sini, atau gunakan tombol di bawah
              </p>
              <p className="mt-1 mb-4 text-xs text-muted-foreground">
                Mendukung PDF, JPG, PNG, WebP hingga {BATAS_BERKAS.maksUkuranMb} MB per berkas.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sedangUnggah || sedangUnggahFoto}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloudIcon className="mr-1 size-4" /> Pilih Dokumen / Berkas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sedangUnggah || sedangUnggahFoto}
                  onClick={() => fotoInputRef.current?.click()}
                >
                  <ImageIcon className="mr-1 size-4 text-sky-600" /> Foto Dokumentasi
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={sedangUnggah || sedangUnggahFoto}
                  onClick={bukaKamera}
                >
                  <CameraIcon className="mr-1 size-4" /> Ambil Foto Langsung
                </Button>
              </div>
            </div>

            {/* Tabel Berkas */}
            {isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Memuat daftar berkas...</p>
            ) : !daftarBerkas || daftarBerkas.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Belum ada berkas bukti yang diunggah untuk surat tugas ini.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Berkas / Keterangan</TableHead>
                      <TableHead className="w-28">Ukuran</TableHead>
                      <TableHead className="w-36">Jenis</TableHead>
                      <TableHead className="w-40">Status AI</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daftarBerkas.map((b) => {
                      const status = b.ekstraksi?.status
                      const isGambar = b.mime.startsWith('image/')
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              {isGambar ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewFoto(b)}
                                  className="relative size-9 shrink-0 overflow-hidden rounded border bg-muted group/thumb"
                                  title="Klik untuk memperbesar"
                                >
                                  <img
                                    src={`/api/berkas/${b.id}/isi`}
                                    alt={b.namaAsli}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                ikonBerkas(b.mime)
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium text-sm text-foreground">
                                  {b.namaAsli}
                                </span>
                                {b.keterangan ? (
                                  <span className="text-xs text-foreground/80 line-clamp-1 italic">
                                    &ldquo;{b.keterangan}&rdquo;
                                  </span>
                                ) : null}
                                <span className="text-[11px] text-muted-foreground">
                                  {tanggalPendek(b.createdAt.slice(0, 10))}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatUkuran(b.ukuran)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={b.jenis === 'dokumentasi' ? 'default' : 'muted'}
                              className="text-xs font-normal"
                            >
                              {JENIS_BERKAS_LABEL[b.jenis]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {status === 'antre' && (
                              <Badge variant="warning" className="text-xs">
                                <ClockIcon className="mr-1 size-3 animate-pulse" /> Antre
                              </Badge>
                            )}
                            {status === 'berjalan' && (
                              <Badge variant="default" className="text-xs">
                                <Loader2Icon className="mr-1 size-3 animate-spin" /> Membaca...
                              </Badge>
                            )}
                            {status === 'selesai' && (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle2Icon className="mr-1 size-3" /> Selesai
                              </Badge>
                            )}
                            {status === 'gagal' && (
                              <Badge
                                variant="destructive"
                                className="text-xs cursor-help"
                                title={b.ekstraksi?.galat ?? 'Ekstraksi gagal'}
                              >
                                <AlertCircleIcon className="mr-1 size-3" /> Gagal
                              </Badge>
                            )}
                            {!status && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isGambar && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Pratinjau gambar"
                                  onClick={() => setPreviewFoto(b)}
                                >
                                  <Maximize2Icon className="size-4 text-sky-600" />
                                </Button>
                              )}
                              <a
                                href={`/api/berkas/${b.id}/isi`}
                                target="_blank"
                                rel="noreferrer"
                                className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                                title="Buka dokumen asli di tab baru"
                              >
                                <ExternalLinkIcon className="size-4" />
                              </a>
                              {status === 'gagal' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Ulangi ekstraksi AI"
                                  disabled={ulangi.isPending}
                                  onClick={() => void tanganiUlangi(b.id)}
                                >
                                  <RotateCcwIcon className="size-4 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Hapus berkas"
                                onClick={() => setBerkasAkanDihapus(b)}
                              >
                                <Trash2Icon className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Dialog Konfirmasi Hapus */}
      <Dialog open={berkasAkanDihapus !== null} onOpenChange={(open) => !open && setBerkasAkanDihapus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus berkas bukti?</DialogTitle>
            <DialogDescription>
              Berkas &quot;{berkasAkanDihapus?.namaAsli}&quot; dan hasil ekstraksi datanya akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBerkasAkanDihapus(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => void tanganiHapus()} disabled={hapus.isPending}>
              {hapus.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Lightbox Foto */}
      <Dialog open={previewFoto !== null} onOpenChange={(open) => !open && setPreviewFoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFoto?.keterangan || previewFoto?.namaAsli}</DialogTitle>
            <DialogDescription className="text-xs">
              {previewFoto?.namaAsli} &bull; {previewFoto ? formatUkuran(previewFoto.ukuran) : ''} &bull;{' '}
              {previewFoto?.createdAt ? tanggalPendek(previewFoto.createdAt.slice(0, 10)) : ''}
            </DialogDescription>
          </DialogHeader>
          {previewFoto && (
            <div className="space-y-4">
              <div className="relative max-h-[60vh] w-full overflow-hidden rounded-md bg-muted flex items-center justify-center">
                <img
                  src={`/api/berkas/${previewFoto.id}/isi`}
                  alt={previewFoto.namaAsli}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  defaultValue={previewFoto.keterangan || ''}
                  placeholder="Beri keterangan/caption foto..."
                  className="text-xs"
                  id="preview-caption-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value
                      void updateBerkas
                        .mutateAsync({ id: previewFoto.id, payload: { keterangan: val.trim() || null } })
                        .then(() => toast.success('Keterangan foto disimpan.'))
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('preview-caption-input') as HTMLInputElement | null
                    if (el) {
                      void updateBerkas
                        .mutateAsync({ id: previewFoto.id, payload: { keterangan: el.value.trim() || null } })
                        .then(() => toast.success('Keterangan foto disimpan.'))
                    }
                  }}
                >
                  Simpan
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="flex sm:justify-between items-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (previewFoto) {
                  setBerkasAkanDihapus(previewFoto)
                }
              }}
            >
              <Trash2Icon className="mr-1 size-3.5" /> Hapus
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewFoto(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AmbilFotoDialog
        buka={modalFotoBuka}
        onBukaChange={(buka) => {
          setModalFotoBuka(buka)
          if (!buka) setHasilKompresiFoto(null)
        }}
        hasilFoto={hasilKompresiFoto}
        sedangMemproses={sedangKompres}
        sedangUnggah={sedangUnggahFoto}
        onFotoUlang={bukaKamera}
        onKonfirmasiUnggah={tanganiUnggahFoto}
      />
    </Card>
  )
}
