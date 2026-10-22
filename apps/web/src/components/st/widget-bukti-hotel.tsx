import { FileTextIcon, HotelIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { UsulanHotelItem } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { pesanGalat, rupiah } from '@/lib/format'
import { useUpdateUsulanBerkas, useUsulanHotelSt } from '@/lib/queries'

export function WidgetBuktiHotel({
  stId,
  pelaksanaIdx,
  etapeIdx,
  pelaksanaNama,
  pelaksanaId,
  terkunci = false,
  onTerapkan,
}: {
  stId: number | null
  pelaksanaIdx: number
  etapeIdx: number
  pelaksanaNama: string
  pelaksanaId: number | null
  terkunci?: boolean
  onTerapkan: (usulan: UsulanHotelItem) => Promise<void> | void
}) {
  const { data: usulanList, isLoading } = useUsulanHotelSt(stId)
  const updateUsulan = useUpdateUsulanBerkas()

  if (stId === null || isLoading || !usulanList || usulanList.length === 0) {
    return null
  }

  // Tampilkan usulan yang cocok untuk pelaksana & etape ini, atau semua usulan yang belum diterapkan
  const usulanRelevan = usulanList.filter((u) => {
    const cocokPosisi = u.pelaksanaIndex === pelaksanaIdx && u.etapeIndex === etapeIdx
    const belumTerikat = u.pelaksanaIndex === -1 || u.pelaksanaId === null || u.pelaksanaId === pelaksanaId
    return cocokPosisi || belumTerikat
  })

  if (usulanRelevan.length === 0) {
    return null
  }

  async function handleTerapkan(item: UsulanHotelItem) {
    try {
      await onTerapkan(item)
      await updateUsulan.mutateAsync({
        id: item.berkasId,
        payload: {
          usulanStatus: 'diterapkan',
          pelaksanaId,
        },
      })
      toast.success(
        `Bukti hotel "${item.ekstraksi.namaHotel}" diterapkan ke ${pelaksanaNama || 'pelaksana'} (Tujuan ${etapeIdx + 1}).`,
      )
    } catch (err) {
      toast.error(`Gagal menerapkan bukti hotel: ${pesanGalat(err)}`)
    }
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <SparklesIcon className="size-3.5" aria-hidden />
          Bukti Penginapan dari Berkas (Ekstraksi OCR)
        </span>
        <Badge variant="muted" className="text-[10px]">
          {usulanRelevan.length} bukti terdeteksi
        </Badge>
      </div>

      <div className="grid gap-2">
        {usulanRelevan.map((item) => {
          const isDiterapkan = item.usulanStatus === 'diterapkan'
          return (
            <div
              key={item.berkasId}
              className="flex flex-col gap-2 rounded-md border bg-card p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <HotelIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-semibold text-foreground">{item.ekstraksi.namaHotel || 'Hotel Tanpa Nama'}</span>
                  {isDiterapkan ? (
                    <Badge variant="success" className="text-[10px]">
                      Diterapkan
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Tersedia
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Tarif riil: <strong className="font-medium text-foreground">{rupiah(item.tarifRiilPerMalam)}</strong> / malam
                  </span>
                  <span>•</span>
                  <span>{item.malam} malam</span>
                  {item.ekstraksi.checkIn ? (
                    <>
                      <span>•</span>
                      <span>
                        {item.ekstraksi.checkIn} s.d. {item.ekstraksi.checkOut}
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
                  onClick={() => void handleTerapkan(item)}
                  className="w-full sm:w-auto text-xs gap-1.5"
                >
                  {updateUsulan.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
                  {isDiterapkan ? 'Gunakan Ulang Bukti Ini' : 'Gunakan Bukti Hotel Ini (Auto-Fill)'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
