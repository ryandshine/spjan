import { useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  HotelIcon,
  Loader2Icon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PelaksanaPayload, UsulanHotelItem } from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { pesanGalat, rupiah } from '@/lib/format'
import { useDaftarBerkas, useUpdateUsulanBerkas, useUsulanHotelSt } from '@/lib/queries'

interface Props {
  stId: number
  pelaksanaList: PelaksanaPayload[]
  onTerapkan: (pelaksanaIndex: number, etapeIndex: number, usulan: UsulanHotelItem) => void
}

function UsulanHotelCard({
  item,
  pelaksanaList,
  onTerapkan,
}: {
  item: UsulanHotelItem
  pelaksanaList: PelaksanaPayload[]
  onTerapkan: (pelaksanaIndex: number, etapeIndex: number, usulan: UsulanHotelItem) => Promise<void> | void
}) {
  const updateUsulan = useUpdateUsulanBerkas()
  const [selectedPelaksana, setSelectedPelaksana] = useState<number>(() => {
    return item.pelaksanaIndex >= 0 && item.pelaksanaIndex < pelaksanaList.length
      ? item.pelaksanaIndex
      : 0
  })

  const etapeList = pelaksanaList[selectedPelaksana]?.etape ?? []
  const [selectedEtape, setSelectedEtape] = useState<number>(() => {
    return item.etapeIndex >= 0 && item.etapeIndex < etapeList.length
      ? item.etapeIndex
      : 0
  })

  const pelaksanaTerpilih = pelaksanaList[selectedPelaksana]
  const pelaksanaId =
    pelaksanaTerpilih && 'id' in pelaksanaTerpilih
      ? ((pelaksanaTerpilih as { id?: number }).id ?? null)
      : null

  async function handleTerapkan() {
    try {
      await onTerapkan(selectedPelaksana, selectedEtape, item)
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'diterapkan',
          pelaksanaId,
        },
      })
      toast.success(
        `Biaya penginapan "${item.ekstraksi.namaHotel}" diterapkan ke ${pelaksanaTerpilih?.nama || 'pelaksana'} (Tujuan ${selectedEtape + 1}).`
      )
    } catch (err) {
      toast.error(`Gagal memperbarui status usulan: ${pesanGalat(err)}`)
    }
  }

  async function handleAbaikan() {
    try {
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'diabaikan',
        },
      })
      toast.info(`Usulan hotel "${item.ekstraksi.namaHotel}" diabaikan.`)
    } catch (err) {
      toast.error(`Gagal mengabaikan usulan: ${pesanGalat(err)}`)
    }
  }

  async function handleResetStatus() {
    try {
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'menunggu',
        },
      })
      toast.info(`Status usulan hotel "${item.ekstraksi.namaHotel}" dikembalikan ke antrean usulan.`)
    } catch (err) {
      toast.error(`Gagal mereset status usulan: ${pesanGalat(err)}`)
    }
  }

  const isDiterapkan = item.usulanStatus === 'diterapkan'
  const isDiabaikan = item.usulanStatus === 'diabaikan'

  return (
    <div
      className={`border-t pt-4 transition-colors first:border-t-0 first:pt-0 ${isDiabaikan ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HotelIcon className="size-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">
              {item.ekstraksi.namaHotel}
            </h4>
            {item.ekstraksi.nomorInvoice && (
              <span className="text-xs text-muted-foreground font-mono">
                #{item.ekstraksi.nomorInvoice}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dari berkas: <span className="font-medium text-foreground">{item.namaBerkas}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {item.statusPlafon === 'sesuai' && (
            <Badge variant="success" className="text-xs">
              Sesuai SBM ({item.plafonSbmPerMalam ? rupiah(item.plafonSbmPerMalam) : '-'})
            </Badge>
          )}
          {item.statusPlafon === 'melebihi' && (
            <Badge variant="destructive" className="text-xs">
              Melebihi SBM (+{rupiah(item.selisihPlafon / Math.max(item.malam, 1))}/malam)
            </Badge>
          )}
          {item.statusPlafon === 'tanpa_plafon' && (
            <Badge variant="muted" className="text-xs">
              Tanpa Plafon SBM
            </Badge>
          )}

          {isDiterapkan && (
            <Badge variant="success" className="text-xs">
              <CheckCircle2Icon className="mr-1 size-3" /> Diterapkan
            </Badge>
          )}
          {isDiabaikan && (
            <Badge variant="muted" className="text-xs">
              Diabaikan
            </Badge>
          )}
          {!isDiterapkan && !isDiabaikan && (
            <Badge variant="warning" className="text-xs">
              Usulan Baru
            </Badge>
          )}
        </div>
      </div>

      {/* Grid Informasi Rincian Tagihan */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">Nama Tamu di Invoice</span>
          <span className="font-medium text-foreground">{item.ekstraksi.tamu || '-'}</span>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">Periode Menginap</span>
          <span className="font-medium text-foreground">
            {item.ekstraksi.checkIn} s.d. {item.ekstraksi.checkOut} ({item.malam} malam)
          </span>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">Tarif Riil / Malam</span>
          <span className="font-medium text-foreground">{rupiah(item.tarifRiilPerMalam)}</span>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">Total Tagihan Invoice</span>
          <span className="font-medium text-foreground">{rupiah(item.totalRiil)}</span>
        </div>
      </div>

      {/* Peringatan jika ada ketidaksesuaian */}
      {item.peringatan.length > 0 && (
        <div className="mt-3">
          <Alert variant={item.statusPlafon === 'melebihi' ? 'destructive' : 'warning'} className="py-2 text-xs">
            <div className="flex items-start gap-1.5">
              <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {item.peringatan.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* Pemilihan Pelaksana & Tujuan Perjalanan */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Terapkan ke:</label>
          <Select
            className="w-56 text-xs"
            value={selectedPelaksana}
            onChange={(e) => {
              const pIdx = Number(e.target.value)
              setSelectedPelaksana(pIdx)
              setSelectedEtape(0)
            }}
          >
            {pelaksanaList.map((p, idx) => (
              <option key={idx} value={idx}>
                {idx + 1}. {p.nama || '(Tanpa nama)'}
              </option>
            ))}
          </Select>

          {etapeList.length > 0 && (
            <Select
              className="w-48 text-xs"
              value={selectedEtape}
              onChange={(e) => setSelectedEtape(Number(e.target.value))}
            >
              {etapeList.map((e, idx) => (
                <option key={idx} value={idx}>
                  Tujuan {idx + 1}: {e.kota || e.provinsi || '-'}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDiterapkan || isDiabaikan ? (
            <Button
              variant="outline"
              size="sm"
              disabled={updateUsulan.isPending}
              onClick={() => void handleResetStatus()}
              className="text-xs"
            >
              <RotateCcwIcon className="mr-1 size-3.5" /> Reset Status
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={updateUsulan.isPending}
                onClick={() => void handleAbaikan()}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <XIcon className="mr-1 size-3.5" /> Abaikan
              </Button>
              <Button
                size="sm"
                disabled={updateUsulan.isPending || pelaksanaList.length === 0}
                onClick={() => void handleTerapkan()}
                className="text-xs"
              >
                <CheckIcon className="mr-1 size-3.5" /> Terapkan ke Biaya
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function UsulanHotelPanel({ stId, pelaksanaList, onTerapkan }: Props) {
  const { data: usulanList, isLoading: memuatUsulan } = useUsulanHotelSt(stId)
  const { data: berkasList } = useDaftarBerkas(stId)

  const adaProsesEkstraksi = berkasList?.some(
    (b) =>
      (b.jenis === 'hotel' || b.jenis === 'belum') &&
      (b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan')
  )

  if (memuatUsulan) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <Loader2Icon className="mx-auto mb-2 size-5 animate-spin text-primary" />
          Memuat usulan invoice hotel...
        </CardContent>
      </Card>
    )
  }

  // Jika tidak ada berkas hotel atau usulan sama sekali dan tidak ada proses ekstraksi
  if ((!usulanList || usulanList.length === 0) && !adaProsesEkstraksi) {
    return null
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HotelIcon className="size-5 text-primary" />
            <CardTitle className="text-base">Usulan Biaya Penginapan (Hotel)</CardTitle>
            {usulanList && usulanList.length > 0 && (
              <Badge variant="default" className="text-xs">
                {usulanList.length} usulan
              </Badge>
            )}
          </div>
          {adaProsesEkstraksi && (
            <Badge variant="warning" className="text-xs animate-pulse">
              <Loader2Icon className="mr-1 size-3 animate-spin" />
              Sedang membaca berkas...
            </Badge>
          )}
        </div>
        <CardDescription>
          Hasil pembacaan invoice hotel otomatis. Klik &quot;Terapkan ke Biaya&quot; untuk mengisi otomatis nama hotel, tarif per malam, dan durasi pada tujuan perjalanan pelaksana.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usulanList && usulanList.length > 0 ? (
          <div className="space-y-3">
            {usulanList.map((item) => (
              <UsulanHotelCard
                key={item.berkasId}
                item={item}
                pelaksanaList={pelaksanaList}
                onTerapkan={onTerapkan}
              />
            ))}
          </div>
        ) : (
          adaProsesEkstraksi && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2Icon className="mx-auto mb-2 size-5 animate-spin text-primary" />
              Menunggu pembacaan selesai untuk rincian invoice hotel...
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
