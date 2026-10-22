import { FileTextIcon, Loader2Icon, PlaneIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { BiayaPayload, UsulanTransportItem } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { pesanGalat, rupiah } from '@/lib/format'
import { useUpdateUsulanBerkas, useUsulanTransportSt } from '@/lib/queries'

const LABEL_JENIS: Record<string, string> = {
  TIKET_PERGI: 'Tiket Pergi',
  TIKET_KEMBALI: 'Tiket Kembali',
  TAKSI_KEDUDUKAN: 'Taksi Kedudukan',
  TAKSI_TERMINAL: 'Taksi Tujuan',
  BBM_KENDARAAN: 'BBM Kendaraan',
  TOL_ETOLL: 'Tol / E-Toll',
  TRANSPORT_JAKARTA_SEKITAR: 'Transport Jakarta & Sekitar',
  SEWA_KENDARAAN: 'Sewa Kendaraan',
  LAINNYA: 'Biaya Lainnya',
}

export function WidgetBuktiTransport({
  stId,
  pelaksanaIdx,
  pelaksanaNama,
  pelaksanaId,
  terkunci = false,
  onTambahBiaya,
}: {
  stId: number | null
  pelaksanaIdx: number
  pelaksanaNama: string
  pelaksanaId: number | null
  terkunci?: boolean
  onTambahBiaya: (biaya: BiayaPayload) => Promise<void> | void
}) {
  const { data: usulanList, isLoading } = useUsulanTransportSt(stId)
  const updateUsulan = useUpdateUsulanBerkas()

  if (stId === null || isLoading || !usulanList || usulanList.length === 0) {
    return null
  }

  // Tampilkan HANYA usulan tiket/transport yang cocok untuk pelaksana ini,
  // atau usulan umum tanpa nama penumpang yang belum diterapkan.
  const usulanRelevan = usulanList.filter((u) => {
    // 1. Usulan cocok dengan pelaksana ini:
    if (u.pelaksanaIndex === pelaksanaIdx) {
      return true
    }
    // 2. Usulan cocok dengan pelaksana lain -> jangan pernah tampilkan di kartu pelaksana ini
    if (u.pelaksanaIndex >= 0 && u.pelaksanaIndex !== pelaksanaIdx) {
      return false
    }
    // 3. Usulan umum (tanpa nama penumpang yang cocok) yang belum diterapkan:
    return u.pelaksanaIndex === -1 && u.usulanStatus !== 'diterapkan'
  })

  if (usulanRelevan.length === 0) {
    return null
  }

  async function handleGunakan(item: UsulanTransportItem) {
    try {
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
      await onTambahBiaya(biayaBaru)

      if (item.jumlahPenerima <= 1) {
        await updateUsulan.mutateAsync({
          id: item.berkasId,
          payload: {
            usulanStatus: 'diterapkan',
            pelaksanaId,
          },
        })
      }
      toast.success(
        `Biaya "${item.uraianBiaya}" (${rupiah(item.tarifRiil)}) ditambahkan ke ${pelaksanaNama || 'pelaksana'}.`,
      )
    } catch (err) {
      toast.error(`Gagal menambahkan bukti tiket: ${pesanGalat(err)}`)
    }
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <SparklesIcon className="size-3.5" aria-hidden />
          Bukti Tiket &amp; Transportasi dari Berkas (Ekstraksi OCR)
        </span>
        <Badge variant="muted" className="text-[10px]">
          {usulanRelevan.length} bukti terdeteksi
        </Badge>
      </div>

      <div className="grid gap-2">
        {usulanRelevan.map((item) => {
          const isDiterapkan = item.usulanStatus === 'diterapkan'
          const labelJenis = LABEL_JENIS[item.jenisBiaya] ?? item.jenisBiaya
          return (
            <div
              key={`${item.berkasId}-${item.jenisBiaya}-${item.uraianBiaya}`}
              className="flex flex-col gap-2 rounded-md border bg-card p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PlaneIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-semibold text-foreground">{item.uraianBiaya || 'Tiket Perjalanan'}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {labelJenis}
                  </Badge>
                  {isDiterapkan ? (
                    <Badge variant="success" className="text-[10px]">
                      Diterapkan
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Siap Ditambahkan
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Tarif riil: <strong className="font-medium text-foreground">{rupiah(item.tarifRiil)}</strong>
                  </span>
                  {item.pelaksanaNama ? (
                    <>
                      <span>•</span>
                      <span>
                        Penumpang di tiket: <span className="font-medium text-foreground">{item.pelaksanaNama}</span>
                      </span>
                    </>
                  ) : null}
                  <span>•</span>
                  <span className="flex items-center gap-1 truncate max-w-[200px]" title={item.namaBerkas}>
                    <FileTextIcon className="size-3" aria-hidden />
                    {item.namaBerkas}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={isDiterapkan ? 'outline' : 'default'}
                  disabled={terkunci || updateUsulan.isPending}
                  onClick={() => void handleGunakan(item)}
                  className="w-full sm:w-auto text-xs gap-1.5"
                >
                  {updateUsulan.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
                  {isDiterapkan ? 'Tambahkan Ulang' : `Gunakan Bukti Tiket Ini untuk ${pelaksanaNama || 'Pelaksana'}`}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
