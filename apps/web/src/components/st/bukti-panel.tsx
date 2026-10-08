import { useRef, useState } from 'react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  Maximize2Icon,
  RotateCcwIcon,
  ImagePlusIcon,
  Trash2Icon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BATAS_BERKAS,
  JENIS_BERKAS_LABEL,
  type BerkasDto,
} from '@spjan/shared'

import { HapusBerkasDialog } from '@/components/st/hapus-berkas-dialog'
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
import { kompresGambar } from '@/lib/gambar'
import {
  useDaftarBerkas,
  useUbahJenisBerkas,
  useUlangiEkstraksiBerkas,
} from '@/lib/queries'

function ikonBerkas(mime: string) {
  if (mime.startsWith('image/')) {
    return <ImageIcon className="size-4 text-sky-600" />
  }
  return <FileIcon className="size-4 text-amber-600" />
}

export function BuktiPanel({ stId }: { stId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sedangUnggah, setSedangUnggah] = useState(false)
  const [berkasAkanDihapus, setBerkasAkanDihapus] = useState<BerkasDto | null>(null)
  const [previewFoto, setPreviewFoto] = useState<BerkasDto | null>(null)

  const { data: semuaBerkas, isLoading, refetch } = useDaftarBerkas(stId)
  const ulangi = useUlangiEkstraksiBerkas()
  const ubahJenis = useUbahJenisBerkas()

  // Foto dokumentasi punya panel sendiri dan tidak ikut hitungan biaya.
  const daftarBerkas = (semuaBerkas ?? []).filter((b) => b.jenis !== 'dokumentasi' && b.jenis !== 'laporan')

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

  async function pindahKeDokumentasi(b: BerkasDto) {
    try {
      await ubahJenis.mutateAsync({ id: b.id, jenis: 'dokumentasi' })
      toast.success(`"${b.namaAsli}" dipindahkan ke Foto Dokumentasi.`)
    } catch (err) {
      toast.error(`Gagal memindahkan berkas: ${pesanGalat(err)}`)
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

  const adaProsesAi = daftarBerkas.some(
    (b) => b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan'
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>Bukti Biaya Perjalanan</span>
            {daftarBerkas.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {daftarBerkas.length} berkas
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
            Unggah kuitansi/invoice hotel, tiket pesawat, dan boarding pass. Berkas ini dibaca AI dan{' '}
            <strong>dipakai untuk menghitung biaya perjalanan dinas</strong>.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" size="sm" disabled={sedangUnggah} onClick={() => fileInputRef.current?.click()}>
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
          <UploadCloudIcon className="mb-2 size-7 text-muted-foreground" />
          <p className="text-sm font-medium">Tarik & lepaskan bukti biaya ke sini, atau gunakan tombol Unggah Berkas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mendukung PDF, JPG, PNG, WebP hingga {BATAS_BERKAS.maksUkuranMb} MB per berkas.
          </p>
        </div>

    {/* Tabel Berkas */}
    {isLoading ? (
      <p className="py-4 text-center text-sm text-muted-foreground">Memuat daftar berkas...</p>
    ) : daftarBerkas.length === 0 ? (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Belum ada bukti biaya yang diunggah untuk surat tugas ini.
      </p>
    ) : (
      <div>
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
                        <span className="font-medium text-sm text-foreground [overflow-wrap:anywhere]">
                          {b.namaAsli}
                        </span>
                        {b.keterangan ? (
                          <span className="text-xs text-foreground/80 italic [overflow-wrap:anywhere]">
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
                      {isGambar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ini foto kegiatan, pindahkan ke Foto Dokumentasi"
                          disabled={ubahJenis.isPending}
                          onClick={() => void pindahKeDokumentasi(b)}
                        >
                          <ImagePlusIcon className="size-4 text-sky-600" />
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
      </CardContent>

      <HapusBerkasDialog
        berkas={berkasAkanDihapus}
        onTutup={() => setBerkasAkanDihapus(null)}
        onTerhapus={(b) => {
          if (previewFoto?.id === b.id) setPreviewFoto(null)
        }}
      />

      <Dialog open={previewFoto !== null} onOpenChange={(open) => !open && setPreviewFoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">{previewFoto?.namaAsli}</DialogTitle>
            <DialogDescription className="text-xs">
              {previewFoto ? formatUkuran(previewFoto.ukuran) : ''} &bull;{' '}
              {previewFoto?.createdAt ? tanggalPendek(previewFoto.createdAt.slice(0, 10)) : ''}
            </DialogDescription>
          </DialogHeader>
          {previewFoto && (
            <div className="relative flex max-h-[60vh] w-full items-center justify-center overflow-hidden rounded-md bg-muted">
              <img
                src={`/api/berkas/${previewFoto.id}/isi`}
                alt={previewFoto.namaAsli}
                className="max-h-[60vh] max-w-full object-contain"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewFoto(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
