import { useRef, useState } from 'react'
import { CameraIcon, Edit2Icon, ImageIcon, Maximize2Icon, ReceiptIcon, Trash2Icon, UploadCloudIcon } from 'lucide-react'
import { toast } from 'sonner'
import { BATAS_BERKAS, type BerkasDto } from '@spjan/shared'

import { AmbilFotoDialog } from '@/components/ambil-foto-dialog'
import { HapusBerkasDialog } from '@/components/st/hapus-berkas-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatUkuran, pesanGalat, tanggalPendek } from '@/lib/format'
import { keteranganFoto, kompresGambar, type HasilKompresi } from '@/lib/gambar'
import { useDaftarBerkas, useUbahJenisBerkas, useUpdateBerkas } from '@/lib/queries'

/** Foto kegiatan untuk lembar "Bukti Dokumentasi Kegiatan". Tidak dibaca AI dan tidak memengaruhi hitungan biaya. */
export function FotoDokumentasiPanel({ stId }: { stId: number }) {
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sedangUnggah, setSedangUnggah] = useState(false)
  const [akanDihapus, setAkanDihapus] = useState<BerkasDto | null>(null)
  const [previewFoto, setPreviewFoto] = useState<BerkasDto | null>(null)
  const [editCaptionId, setEditCaptionId] = useState<number | null>(null)
  const [captionTeks, setCaptionTeks] = useState('')

  const [modalFotoBuka, setModalFotoBuka] = useState(false)
  const [hasilKompresiFoto, setHasilKompresiFoto] = useState<HasilKompresi | null>(null)
  const [sedangKompres, setSedangKompres] = useState(false)
  const [sedangUnggahFoto, setSedangUnggahFoto] = useState(false)

  const { data: daftarBerkas, isLoading, refetch } = useDaftarBerkas(stId)
  const updateBerkas = useUpdateBerkas()
  const ubahJenis = useUbahJenisBerkas()

  const foto = (daftarBerkas ?? []).filter((b) => b.jenis === 'dokumentasi')
  const sibuk = sedangUnggah || sedangUnggahFoto

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
      setHasilKompresiFoto(await kompresGambar(file))
    } catch (err) {
      toast.error(`Gagal memproses foto: ${pesanGalat(err)}`)
      setModalFotoBuka(false)
    } finally {
      setSedangKompres(false)
    }
  }

  async function tanganiUnggahKamera(file: File) {
    setSedangUnggahFoto(true)
    try {
      await api.berkas.unggah(file, stId, { jenis: 'dokumentasi' })
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

  async function prosesUnggah(files: FileList | File[]) {
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
        berkasFinal = (await kompresGambar(file)).file
      } catch {
        berkasFinal = file
      }

      if (berkasFinal.size > BATAS_BERKAS.maksUkuranMb * 1024 * 1024) {
        toast.error(`Foto "${file.name}" melebihi batas ${BATAS_BERKAS.maksUkuranMb} MB.`)
        gagal += 1
        continue
      }

      try {
        await api.berkas.unggah(berkasFinal, stId, { jenis: 'dokumentasi' })
        sukses += 1
      } catch (err) {
        toast.error(`Gagal mengunggah ${file.name}: ${pesanGalat(err)}`)
        gagal += 1
      }
    }

    setSedangUnggah(false)
    if (sukses > 0) {
      toast.success(`${sukses} foto dokumentasi berhasil diunggah.`)
      void refetch()
    }
    if (gagal > 0) toast.error(`${gagal} foto gagal diunggah.`)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  async function simpanCaption(id: number, teks: string) {
    try {
      await updateBerkas.mutateAsync({ id, payload: { keterangan: teks.trim() || null } })
      toast.success('Keterangan foto disimpan.')
      setEditCaptionId(null)
    } catch (err) {
      toast.error(`Gagal menyimpan keterangan: ${pesanGalat(err)}`)
    }
  }

  async function pindahKeBuktiBiaya(b: BerkasDto) {
    try {
      await ubahJenis.mutateAsync({ id: b.id, jenis: 'belum', ulangiAi: true })
      toast.success('Foto dipindahkan ke Bukti Biaya dan akan dibaca otomatis.')
      if (previewFoto?.id === b.id) setPreviewFoto(null)
    } catch (err) {
      toast.error(`Gagal memindahkan foto: ${pesanGalat(err)}`)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>Foto Dokumentasi Kegiatan</span>
            {foto.length > 0 ? (
              <Badge variant="outline" className="text-xs">
                {foto.length} foto
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>Lampiran laporan; tidak memengaruhi hitungan biaya.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fotoInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void prosesUnggah(e.target.files)
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void tanganiFotoDiambil(e)}
          />
          <Button size="sm" disabled={sibuk} onClick={() => fotoInputRef.current?.click()}>
            <UploadCloudIcon className="mr-1 size-4" /> Pilih Foto
          </Button>
          <Button variant="secondary" size="sm" disabled={sibuk} onClick={bukaKamera}>
            <CameraIcon className="mr-1 size-4" /> Ambil Foto
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat foto...</p>
        ) : foto.length === 0 ? (
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
            className={`flex min-h-16 items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
            }`}
          >
            <ImageIcon className="size-6 shrink-0 text-muted-foreground/50" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium">Belum ada foto dokumentasi</p>
              <p className="text-xs text-muted-foreground">
                Tarik foto kegiatan ke sini · JPG, PNG, WebP · maksimal {BATAS_BERKAS.maksUkuranMb} MB per foto
              </p>
            </div>
          </div>
        ) : (
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
            className={`grid grid-cols-2 gap-3 rounded-lg sm:grid-cols-3 xl:grid-cols-4 ${dragOver ? 'ring-2 ring-primary/50' : ''}`}
          >
            {foto.map((b, idx) => {
              const sedangEdit = editCaptionId === b.id
              return (
                <div
                  key={b.id}
                  className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    <img
                      src={`/api/berkas/${b.id}/isi`}
                      alt={b.keterangan || b.namaAsli}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="size-7 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                        title="Perbesar foto"
                        onClick={() => setPreviewFoto(b)}
                      >
                        <Maximize2Icon className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="size-7 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                        title="Ini bukti biaya (kuitansi/tiket), pindahkan ke Bukti Biaya"
                        disabled={ubahJenis.isPending}
                        onClick={() => void pindahKeBuktiBiaya(b)}
                      >
                        <ReceiptIcon className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="size-7 rounded-full bg-destructive/80 hover:bg-destructive"
                        title="Hapus foto"
                        onClick={() => setAkanDihapus(b)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="default">Foto #{idx + 1}</Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {tanggalPendek(b.createdAt.slice(0, 10))} · {formatUkuran(b.ukuran)}
                      </span>
                    </div>
                    {sedangEdit ? (
                      <div className="space-y-1.5">
                        <Input
                          autoFocus
                          value={captionTeks}
                          onChange={(e) => setCaptionTeks(e.target.value)}
                          placeholder="Keterangan / caption foto..."
                          className="h-7 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void simpanCaption(b.id, captionTeks)
                            if (e.key === 'Escape') setEditCaptionId(null)
                          }}
                        />
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditCaptionId(null)}>
                            Batal
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            disabled={updateBerkas.isPending}
                            onClick={() => void simpanCaption(b.id, captionTeks)}
                          >
                            Simpan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="group/caption cursor-pointer"
                        onClick={() => {
                          setEditCaptionId(b.id)
                          setCaptionTeks(keteranganFoto(b))
                        }}
                        title="Klik untuk mengubah keterangan foto"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground [overflow-wrap:anywhere]">
                            {keteranganFoto(b) || <span className="italic text-muted-foreground">Belum ada keterangan</span>}
                          </p>
                          <Edit2Icon className="ml-1 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/caption:opacity-100" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={b.namaAsli}>
                          {b.namaAsli}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <HapusBerkasDialog
        berkas={akanDihapus}
        onTutup={() => setAkanDihapus(null)}
        onTerhapus={(b) => {
          if (previewFoto?.id === b.id) setPreviewFoto(null)
        }}
      />

      <Dialog open={previewFoto !== null} onOpenChange={(open) => !open && setPreviewFoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">{previewFoto?.keterangan || previewFoto?.namaAsli}</DialogTitle>
            <DialogDescription className="text-xs">
              {previewFoto?.namaAsli} &bull; {previewFoto ? formatUkuran(previewFoto.ukuran) : ''} &bull;{' '}
              {previewFoto?.createdAt ? tanggalPendek(previewFoto.createdAt.slice(0, 10)) : ''}
            </DialogDescription>
          </DialogHeader>
          {previewFoto ? (
            <div className="space-y-4">
              <div className="relative flex max-h-[60vh] w-full items-center justify-center overflow-hidden rounded-md bg-muted">
                <img
                  src={`/api/berkas/${previewFoto.id}/isi`}
                  alt={previewFoto.namaAsli}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const el = e.currentTarget.elements.namedItem('caption') as HTMLInputElement
                  void simpanCaption(previewFoto.id, el.value)
                }}
              >
                <Input
                  key={previewFoto.id}
                  name="caption"
                  defaultValue={previewFoto.keterangan || ''}
                  placeholder="Beri keterangan/caption foto..."
                  className="text-xs"
                />
                <Button size="sm" type="submit">
                  Simpan
                </Button>
              </form>
            </div>
          ) : null}
          <DialogFooter className="flex items-center sm:justify-between">
            <Button variant="destructive" size="sm" onClick={() => previewFoto && setAkanDihapus(previewFoto)}>
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
        onKonfirmasiUnggah={tanganiUnggahKamera}
      />
    </Card>
  )
}
