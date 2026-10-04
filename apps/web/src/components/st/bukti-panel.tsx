import { useRef, useState } from 'react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
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
import { pesanGalat, tanggalPendek } from '@/lib/format'
import {
  useDaftarBerkas,
  useHapusBerkas,
  useUlangiEkstraksiBerkas,
} from '@/lib/queries'

function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

  const { data: daftarBerkas, isLoading, refetch } = useDaftarBerkas(stId)
  const hapus = useHapusBerkas()
  const ulangi = useUlangiEkstraksiBerkas()

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

      if (file.size > BATAS_BERKAS.maksUkuranMb * 1024 * 1024) {
        toast.error(`Berkas "${file.name}" melebihi batas ${BATAS_BERKAS.maksUkuranMb} MB.`)
        gagal += 1
        continue
      }

      try {
        await api.berkas.unggah(file, stId)
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

  const adaProsesAi = daftarBerkas?.some(
    (b) => b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan'
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>Bukti Dokumen & Berkas</span>
            {daftarBerkas && daftarBerkas.length > 0 && (
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
            Unggah kuitansi/invoice hotel, tiket pesawat, boarding pass, atau bukti riil lainnya.
          </CardDescription>
        </div>
        <div>
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
          <Button
            variant="outline"
            size="sm"
            disabled={sedangUnggah}
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <UploadCloudIcon className="mb-2 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            Tarik & lepaskan berkas bukti ke sini, atau klik tombol Unggah di atas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mendukung PDF, JPG, PNG, WebP hingga {BATAS_BERKAS.maksUkuranMb} MB per berkas.
          </p>
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
                  <TableHead>Nama Berkas</TableHead>
                  <TableHead className="w-28">Ukuran</TableHead>
                  <TableHead className="w-32">Jenis</TableHead>
                  <TableHead className="w-40">Status AI</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftarBerkas.map((b) => {
                  const status = b.ekstraksi?.status
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ikonBerkas(b.mime)}
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium text-sm text-foreground">
                              {b.namaAsli}
                            </span>
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
                        <Badge variant="muted" className="text-xs">
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
                          <a
                            href={`/api/berkas/${b.id}/isi`}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                            title="Buka dokumen asli"
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
      </CardContent>

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
    </Card>
  )
}
