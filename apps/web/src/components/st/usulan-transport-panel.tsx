import { useState } from 'react'
import {
  AlertTriangleIcon,
  CarIcon,
  CheckCircle2Icon,
  CheckIcon,
  Loader2Icon,
  PlaneIcon,
  RotateCcwIcon,
  TicketIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  JENIS_BIAYA,
  JENIS_LABEL,
  type BiayaPayload,
  type HasilEkstraksiTiket,
  type HasilEkstraksiTransport,
  type JenisBiaya,
  type PelaksanaPayload,
  type UsulanTransportItem,
} from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { pesanGalat, rupiah } from '@/lib/format'
import { useDaftarBerkas, useUpdateUsulanBerkas, useUsulanTransportSt } from '@/lib/queries'

interface Props {
  stId: number
  pelaksanaList: PelaksanaPayload[]
  onTerapkan: (pelaksanaIndex: number, biaya: BiayaPayload) => Promise<void> | void
}

function UsulanTransportCard({
  item,
  pelaksanaList,
  onTerapkan,
}: {
  item: UsulanTransportItem
  pelaksanaList: PelaksanaPayload[]
  onTerapkan: (pelaksanaIndex: number, biaya: BiayaPayload) => Promise<void> | void
}) {
  const updateUsulan = useUpdateUsulanBerkas()
  const [selectedPelaksana, setSelectedPelaksana] = useState<number>(() => {
    return item.pelaksanaIndex >= 0 && item.pelaksanaIndex < pelaksanaList.length
      ? item.pelaksanaIndex
      : 0
  })

  const etapeList = pelaksanaList[selectedPelaksana]?.etape ?? []
  const [selectedEtape, setSelectedEtape] = useState<number | null>(() => {
    return item.etapeIndex >= 0 && item.etapeIndex < etapeList.length
      ? item.etapeIndex
      : null
  })

  const [selectedJenisBiaya, setSelectedJenisBiaya] = useState<JenisBiaya>(item.jenisBiaya)

  const pelaksanaTerpilih = pelaksanaList[selectedPelaksana]
  const pelaksanaId =
    pelaksanaTerpilih && 'id' in pelaksanaTerpilih
      ? ((pelaksanaTerpilih as { id?: number }).id ?? null)
      : null

  const isTiket = item.kategoriBerkas === 'tiket'
  const tiketData = isTiket ? (item.ekstraksi as HasilEkstraksiTiket) : null
  const transportData = !isTiket ? (item.ekstraksi as HasilEkstraksiTransport) : null

  async function handleTerapkan() {
    try {
      const etape = selectedEtape !== null ? etapeList[selectedEtape] : undefined
      const biayaBaru: BiayaPayload = {
        jenis: selectedJenisBiaya,
        uraian: item.uraianBiaya,
        qty: item.qty,
        satuan: item.satuan,
        tarif: item.tarifRiil,
        keterangan: item.keterangan,
        etapeIndex: selectedEtape,
        provinsi: etape?.provinsi ?? item.provinsi,
      }

      await onTerapkan(selectedPelaksana, biayaBaru)
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'diterapkan',
          pelaksanaId,
        },
      })
      toast.success(
        `Biaya ${JENIS_LABEL[selectedJenisBiaya]} (${rupiah(item.tarifRiil)}) berhasil ditambahkan ke ${pelaksanaTerpilih?.nama || 'pelaksana'}.`
      )
    } catch (err) {
      toast.error(`Gagal menerapkan usulan biaya: ${pesanGalat(err)}`)
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
      toast.info(`Usulan ${isTiket ? 'tiket' : 'transport'} diabaikan.`)
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
      toast.info('Status usulan dikembalikan ke antrean.')
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
            {isTiket ? (
              <PlaneIcon className="size-4 text-sky-600" />
            ) : (
              <CarIcon className="size-4 text-amber-600" />
            )}
            <h4 className="font-semibold text-foreground text-sm">
              {isTiket
                ? `${tiketData?.maskapai} (${tiketData?.asal} → ${tiketData?.tujuan})`
                : `${transportData?.penyedia || 'Transportasi'} - ${transportData?.uraian}`}
            </h4>
            {isTiket && tiketData?.nomorPenerbangan && (
              <span className="text-xs text-muted-foreground font-mono">
                {tiketData.nomorPenerbangan}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dari berkas: <span className="font-medium text-foreground">{item.namaBerkas}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {JENIS_LABEL[item.jenisBiaya]}
          </Badge>
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

      {/* Grid Informasi Rincian */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">
            {isTiket ? 'Nama Penumpang di Tiket' : 'Penyedia / Armada'}
          </span>
          <span className="font-medium text-foreground">
            {isTiket ? tiketData?.penumpang || '-' : transportData?.penyedia || '-'}
          </span>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">Tanggal Perjalanan</span>
          <span className="font-medium text-foreground">
            {item.ekstraksi.tanggal} {isTiket && tiketData?.jam ? `@ ${tiketData.jam}` : ''}
          </span>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">
            {isTiket ? 'Nomor Tiket / PNR' : 'No. Kuitansi / Bukti'}
          </span>
          <span className="font-medium text-foreground font-mono">
            {isTiket
              ? tiketData?.nomorTiket || tiketData?.kodeBooking || '-'
              : transportData?.nomorKuitansi || '-'}
          </span>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <span className="text-muted-foreground block text-[11px]">Tarif Riil</span>
          <span className="font-medium text-foreground">{rupiah(item.tarifRiil)}</span>
        </div>
      </div>

      {/* Peringatan jika tanggal di luar rentang */}
      {item.peringatan.length > 0 && (
        <div className="mt-3">
          <Alert variant="warning" className="py-2 text-xs">
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

      {/* Pemilihan Pelaksana, Tujuan Perjalanan, & Jenis Biaya */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Terapkan ke:</label>
          <Select
            className="w-52 text-xs"
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
              className="w-44 text-xs"
              value={selectedEtape ?? ''}
              onChange={(e) => setSelectedEtape(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Otomatis (Tujuan Terdekat)</option>
              {etapeList.map((e, idx) => (
                <option key={idx} value={idx}>
                  Tujuan {idx + 1}: {e.kota || e.provinsi || '-'}
                </option>
              ))}
            </Select>
          )}

          <Select
            className="w-48 text-xs"
            value={selectedJenisBiaya}
            onChange={(e) => setSelectedJenisBiaya(e.target.value as JenisBiaya)}
          >
            {JENIS_BIAYA.map((j) => (
              <option key={j} value={j}>
                {JENIS_LABEL[j]}
              </option>
            ))}
          </Select>
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

export function UsulanTransportPanel({ stId, pelaksanaList, onTerapkan }: Props) {
  const { data: usulanList, isLoading: memuatUsulan } = useUsulanTransportSt(stId)
  const { data: berkasList } = useDaftarBerkas(stId)

  const adaProsesEkstraksi = berkasList?.some(
    (b) =>
      (b.jenis === 'tiket' || b.jenis === 'transport' || b.jenis === 'belum') &&
      (b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan')
  )

  if (memuatUsulan) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <Loader2Icon className="mx-auto mb-2 size-5 animate-spin text-primary" />
          Memuat usulan tiket dan transportasi...
        </CardContent>
      </Card>
    )
  }

  // Jika tidak ada berkas tiket/transport atau usulan sama sekali dan tidak ada proses ekstraksi
  if ((!usulanList || usulanList.length === 0) && !adaProsesEkstraksi) {
    return null
  }

  return (
    <Card className="border-sky-500/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="size-5 text-sky-600" />
            <CardTitle className="text-base">Usulan Tiket & Bukti Transportasi</CardTitle>
            {usulanList && usulanList.length > 0 && (
              <Badge variant="default" className="text-xs">
                {usulanList.length} usulan
              </Badge>
            )}
          </div>
          {adaProsesEkstraksi && (
            <Badge variant="warning" className="text-xs animate-pulse">
              <Loader2Icon className="mr-1 size-3 animate-spin" />
              AI sedang menganalisis berkas tiket/transport...
            </Badge>
          )}
        </div>
        <CardDescription>
          Hasil ekstraksi e-ticket penerbangan/kereta dan struk transportasi riil oleh AI. Klik &quot;Terapkan ke Biaya&quot; untuk menyematkan baris pengeluaran ke pelaksana.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usulanList && usulanList.length > 0 ? (
          <div className="space-y-3">
            {usulanList.map((item) => (
              <UsulanTransportCard
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
              Menunggu AI selesai mengekstrak rincian tiket atau kuitansi transport...
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
