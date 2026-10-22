import { useEffect, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  BedDoubleIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  ImagePlusIcon,
  Loader2Icon,
  Maximize2Icon,
  PlaneIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  BATAS_BERKAS,
  type BerkasDto,
  type BiayaPayload,
  type PelaksanaPayload,
  type UsulanHotelItem,
  type UsulanTransportItem,
} from '@spjan/shared'

import { ChipJenisBerkas } from '@/components/st/chip-jenis-berkas'
import { HapusBerkasDialog } from '@/components/st/hapus-berkas-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { formatUkuran, pesanGalat, rupiah, tanggalPendek } from '@/lib/format'
import { kompresGambar } from '@/lib/gambar'
import { useSeretLepas } from '@/lib/use-seret-lepas'
import {
  useDaftarBerkas,
  useUbahJenisBerkas,
  useUlangiEkstraksiBerkas,
  useUpdateUsulanBerkas,
  useUsulanHotelSt,
  useUsulanTransportSt,
} from '@/lib/queries'

function ikonBerkas(mime: string) {
  if (mime.startsWith('image/')) {
    return <ImageIcon className="size-4 text-sky-600" />
  }
  return <FileIcon className="size-4 text-amber-600" />
}

export function BuktiPanel({
  stId,
  pelaksanaList = [],
  onTerapkanHotel,
  onTerapkanTransport,
}: {
  stId: number
  pelaksanaList?: PelaksanaPayload[]
  onTerapkanHotel?: (pelaksanaIdx: number, etapeIdx: number, usulan: UsulanHotelItem) => Promise<void> | void
  onTerapkanTransport?: (pelaksanaIdx: number, biaya: BiayaPayload, usulan: UsulanTransportItem) => Promise<void> | void
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sedangUnggah, setSedangUnggah] = useState(false)
  const [berkasAkanDihapus, setBerkasAkanDihapus] = useState<BerkasDto | null>(null)
  const [previewFoto, setPreviewFoto] = useState<BerkasDto | null>(null)
  const [pilihanPelaksana, setPilihanPelaksana] = useState<Record<string, number>>({})

  const { data: semuaBerkas, isLoading, refetch } = useDaftarBerkas(stId)
  const { data: usulanHotelList } = useUsulanHotelSt(stId)
  const { data: usulanTransportList } = useUsulanTransportSt(stId)
  const ulangi = useUlangiEkstraksiBerkas()
  const ubahJenis = useUbahJenisBerkas()
  const updateUsulan = useUpdateUsulanBerkas()

  // Foto dokumentasi punya panel sendiri dan tidak ikut hitungan biaya.
  const daftarBerkas = (semuaBerkas ?? []).filter((b) => b.jenis !== 'dokumentasi' && b.jenis !== 'laporan')

  const adaProsesAi = daftarBerkas.some(
    (b) => b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan',
  )
  const prevAdaProsesRef = useRef(adaProsesAi)

  // Otomatis sinkronkan usulan hotel dan transport saat pembacaan AI selesai tanpa perlu refresh manual
  useEffect(() => {
    if (prevAdaProsesRef.current && !adaProsesAi) {
      qc.invalidateQueries({ queryKey: ['st', stId] })
      qc.invalidateQueries({ queryKey: ['berkas'] })
    }
    prevAdaProsesRef.current = adaProsesAi
  }, [adaProsesAi, qc, stId])

  const seret = useSeretLepas((files) => void prosesUnggah(files))

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
      toast.success(`${sukses} berkas berhasil diunggah. Berkas akan diproses otomatis.`)
      void refetch()
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st', stId] })
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
      toast.success('Pembacaan ulang dijadwalkan.')
    } catch (err) {
      toast.error(`Gagal menjadwalkan ulang: ${pesanGalat(err)}`)
    }
  }

  async function handleKonfirmasiHotel(item: UsulanHotelItem, targetIdx: number) {
    try {
      if (onTerapkanHotel) {
        const etapeIdx = item.etapeIndex >= 0 ? item.etapeIndex : 0
        await onTerapkanHotel(targetIdx, etapeIdx, item)
      }
      const pelaksanaTerpilih = pelaksanaList[targetIdx]
      const pelaksanaId = pelaksanaTerpilih && 'id' in pelaksanaTerpilih ? (pelaksanaTerpilih as { id?: number }).id ?? null : null
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'diterapkan',
          pelaksanaId,
        },
      })
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st', stId] })
      toast.success(`Biaya hotel "${item.ekstraksi.namaHotel}" dikonfirmasi untuk ${pelaksanaTerpilih?.nama || 'pelaksana'}.`)
    } catch (err) {
      toast.error(`Gagal mengonfirmasi hotel: ${pesanGalat(err)}`)
    }
  }

  async function handleBatalHotel(item: UsulanHotelItem) {
    try {
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'menunggu',
          pelaksanaId: null,
        },
      })
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st', stId] })
      toast.info(`Status bukti hotel "${item.ekstraksi.namaHotel}" dikembalikan ke antrean.`)
    } catch (err) {
      toast.error(`Gagal membatalkan status: ${pesanGalat(err)}`)
    }
  }

  async function handleKonfirmasiTransport(item: UsulanTransportItem, targetIdx: number) {
    try {
      const pelaksanaTerpilih = pelaksanaList[targetIdx]
      const pelaksanaId = pelaksanaTerpilih && 'id' in pelaksanaTerpilih ? (pelaksanaTerpilih as { id?: number }).id ?? null : null
      const biayaBaru: BiayaPayload = {
        jenis: item.jenisBiaya,
        uraian: item.uraianBiaya,
        qty: item.qty || 1,
        satuan: item.satuan || 'tiket',
        tarif: item.tarifRiil,
        keterangan: item.keterangan || item.namaBerkas,
        etapeIndex: item.etapeIndex >= 0 ? item.etapeIndex : null,
        provinsi: item.provinsi,
      }
      if (onTerapkanTransport) {
        await onTerapkanTransport(targetIdx, biayaBaru, item)
      }
      if (item.jumlahPenerima <= 1) {
        await updateUsulan.mutateAsync({
          id: item.berkasId,
          payload: {
            usulanStatus: 'diterapkan',
            pelaksanaId,
          },
        })
      }
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st', stId] })
      toast.success(`Biaya "${item.uraianBiaya}" (${rupiah(item.tarifRiil)}) dikonfirmasi untuk ${pelaksanaTerpilih?.nama || 'pelaksana'}.`)
    } catch (err) {
      toast.error(`Gagal mengonfirmasi tiket: ${pesanGalat(err)}`)
    }
  }

  async function handleBatalTransport(item: UsulanTransportItem) {
    try {
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'menunggu',
          pelaksanaId: null,
        },
      })
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st', stId] })
      toast.info(`Status tiket "${item.uraianBiaya}" dikembalikan ke antrean.`)
    } catch (err) {
      toast.error(`Gagal membatalkan status: ${pesanGalat(err)}`)
    }
  }

  // Hitung jumlah bukti yang nama di dokumennya tidak cocok dengan pelaksana mana pun
  const hotelUnmatched = (usulanHotelList ?? []).filter((u) => u.usulanStatus === 'menunggu' && u.pelaksanaIndex < 0)
  const transportUnmatched = (usulanTransportList ?? []).filter((u) => u.usulanStatus === 'menunggu' && u.pelaksanaIndex < 0)
  const totalUnmatched = hotelUnmatched.length + transportUnmatched.length

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
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
                Sedang membaca berkas...
              </Badge>
            )}
          </CardTitle>
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
        {/* Notifikasi jika ada berkas yang namanya tidak cocok dengan pelaksana */}
        {totalUnmatched > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Ada <strong>{totalUnmatched} berkas</strong> yang nama di dokumennya belum cocok dengan nama pelaksana ST. Silakan tentukan pelaksana pada baris berkas di bawah.
            </span>
          </div>
        )}

        <div
          {...seret.props}
          className={`flex min-h-16 items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors ${
            seret.dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
          }`}
        >
          <UploadCloudIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium">Tarik & lepaskan kuitansi, invoice hotel, atau tiket ke sini</p>
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG, WebP · maksimal {BATAS_BERKAS.maksUkuranMb} MB per berkas
            </p>
          </div>
        </div>

        {/* Tabel Berkas */}
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Memuat daftar berkas...</p>
        ) : daftarBerkas.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Belum ada berkas.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nama Berkas / Keterangan</TableHead>
                  <TableHead className="w-28">Jenis</TableHead>
                  <TableHead className="w-28">Status Baca</TableHead>
                  <TableHead className="min-w-[300px]">Pelaksana &amp; Konfirmasi Nama</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftarBerkas.map((b) => {
                  const status = b.ekstraksi?.status
                  const isGambar = b.mime.startsWith('image/')
                  const hotelItem = usulanHotelList?.find((u) => u.berkasId === b.id)
                  const transportItems = usulanTransportList?.filter((u) => u.berkasId === b.id) ?? []

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
                            <span className="text-xs text-muted-foreground">
                              {tanggalPendek(b.createdAt.slice(0, 10))} · {formatUkuran(b.ukuran)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChipJenisBerkas jenis={b.jenis} />
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

                      {/* Kolom Konfirmasi Pelaksana Per Nama */}
                      <TableCell>
                        {status === 'antre' || status === 'berjalan' ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2Icon className="size-3.5 animate-spin text-primary" />
                            <span>Sedang membaca nama &amp; nominal...</span>
                          </div>
                        ) : status === 'gagal' ? (
                          <span className="text-xs text-destructive">Ekstraksi gagal</span>
                        ) : hotelItem ? (
                          <div className="flex flex-col gap-1.5 py-0.5">
                            <div className="text-xs">
                              <span className="font-semibold text-foreground flex items-center gap-1">
                                <BedDoubleIcon className="size-3 text-muted-foreground" />
                                {hotelItem.ekstraksi.namaHotel || 'Hotel'} ({rupiah(hotelItem.tarifRiilPerMalam)}/mlm)
                              </span>
                              <div className="text-muted-foreground text-[11px] mt-0.5">
                                {hotelItem.ekstraksi.tamu ? (
                                  <span>
                                    Tamu di bill: <strong className="text-foreground">{hotelItem.ekstraksi.tamu}</strong>
                                  </span>
                                ) : (
                                  <span className="italic">Nama tamu tidak tertera di bill</span>
                                )}
                              </div>
                            </div>

                            {hotelItem.usulanStatus === 'diterapkan' ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="success" className="text-[11px] gap-1 font-normal">
                                  <CheckCircle2Icon className="size-3" />
                                  Diterapkan untuk: <strong className="font-semibold">{pelaksanaList[hotelItem.pelaksanaIndex]?.nama || hotelItem.pelaksanaNama || 'Pelaksana'}</strong>
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={() => void handleBatalHotel(hotelItem)}
                                  title="Ubah pelaksana penginapan"
                                >
                                  Ubah
                                </Button>
                              </div>
                            ) : hotelItem.pelaksanaIndex >= 0 ? (
                              <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground">
                                <Loader2Icon className="size-3 animate-spin text-primary" />
                                Menerapkan ke {pelaksanaList[hotelItem.pelaksanaIndex]?.nama || hotelItem.pelaksanaNama}...
                              </Badge>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                  <AlertCircleIcon className="size-3" /> Tamu tidak cocok pelaksana ST
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {pelaksanaList.length > 0 ? (
                                    <select
                                      value={pilihanPelaksana[`hotel-${hotelItem.berkasId}`] ?? 0}
                                      onChange={(e) =>
                                        setPilihanPelaksana((prev) => ({
                                          ...prev,
                                          [`hotel-${hotelItem.berkasId}`]: Number(e.target.value),
                                        }))
                                      }
                                      className="h-7 rounded border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary max-w-[180px]"
                                    >
                                      {pelaksanaList.map((p, idx) => (
                                        <option key={idx} value={idx}>
                                          {idx + 1}. {p.nama || `Pelaksana ${idx + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="default"
                                    disabled={pelaksanaList.length === 0 || updateUsulan.isPending}
                                    className="h-7 text-xs px-2.5 gap-1"
                                    onClick={() => {
                                      const targetIdx = pilihanPelaksana[`hotel-${hotelItem.berkasId}`] ?? 0
                                      void handleKonfirmasiHotel(hotelItem, targetIdx)
                                    }}
                                  >
                                    <CheckIcon className="size-3.5" />
                                    Terapkan
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : transportItems.length > 0 ? (
                          <div className="flex flex-col gap-2 py-0.5">
                            {transportItems.map((tItem, tIdx) => {
                              const itemKey = `transport-${tItem.berkasId}-${tIdx}`
                              const isDiterapkan = tItem.usulanStatus === 'diterapkan'
                              const terpilihIdx =
                                pilihanPelaksana[itemKey] ?? (tItem.pelaksanaIndex >= 0 ? tItem.pelaksanaIndex : 0)
                              return (
                                <div key={itemKey} className="flex flex-col gap-1 border-b last:border-b-0 pb-1.5 last:pb-0">
                                  <div className="text-xs">
                                    <span className="font-semibold text-foreground flex items-center gap-1">
                                      <PlaneIcon className="size-3 text-muted-foreground" />
                                      {tItem.uraianBiaya} ({rupiah(tItem.tarifRiil)})
                                    </span>
                                    <div className="text-muted-foreground text-[11px] mt-0.5">
                                      {tItem.pelaksanaNama ? (
                                        <span>
                                          Penumpang di tiket: <strong className="text-foreground">{tItem.pelaksanaNama}</strong>
                                        </span>
                                      ) : (
                                        <span className="italic">Nama penumpang tidak tertera</span>
                                      )}
                                    </div>
                                  </div>

                                  {isDiterapkan ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Badge variant="success" className="text-[11px] gap-1 font-normal">
                                        <CheckCircle2Icon className="size-3" />
                                        Diterapkan untuk: <strong className="font-semibold">{pelaksanaList[tItem.pelaksanaIndex]?.nama || tItem.pelaksanaNama || 'Pelaksana'}</strong>
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                        onClick={() => void handleBatalTransport(tItem)}
                                        title="Ubah pelaksana tiket"
                                      >
                                        Ubah
                                      </Button>
                                    </div>
                                  ) : tItem.pelaksanaIndex >= 0 ? (
                                    <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground">
                                      <Loader2Icon className="size-3 animate-spin text-primary" />
                                      Menerapkan ke {pelaksanaList[tItem.pelaksanaIndex]?.nama || tItem.pelaksanaNama}...
                                    </Badge>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                        <AlertCircleIcon className="size-3" /> Penumpang tidak cocok pelaksana ST
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {pelaksanaList.length > 0 ? (
                                          <select
                                            value={terpilihIdx}
                                            onChange={(e) =>
                                              setPilihanPelaksana((prev) => ({
                                                ...prev,
                                                [itemKey]: Number(e.target.value),
                                              }))
                                            }
                                            className="h-7 rounded border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary max-w-[180px]"
                                          >
                                            {pelaksanaList.map((p, idx) => (
                                              <option key={idx} value={idx}>
                                                {idx + 1}. {p.nama || `Pelaksana ${idx + 1}`}
                                              </option>
                                            ))}
                                          </select>
                                        ) : null}
                                        <Button
                                          size="sm"
                                          variant="default"
                                          disabled={pelaksanaList.length === 0 || updateUsulan.isPending}
                                          className="h-7 text-xs px-2.5 gap-1"
                                          onClick={() => void handleKonfirmasiTransport(tItem, terpilihIdx)}
                                        >
                                          <CheckIcon className="size-3.5" />
                                          Terapkan
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Umum / Tanpa usulan biaya otomatis</span>
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
                              title="Ulangi pembacaan berkas"
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
