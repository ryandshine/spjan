import { PlusIcon, Trash2Icon } from 'lucide-react'
import type { BiayaPayload } from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { rupiah } from '@/lib/format'
import { cn } from '@/lib/utils'

const TEKS_KECIL = 'min-h-8 py-1 text-xs'

export interface ItemBiayaBebas {
  biaya: BiayaPayload
  originalIndex: number
}

export function TabelRincianBebas({
  judul,
  deskripsi,
  tombolLabel,
  placeholderUraian,
  satuanBawaan = 'kali',
  items,
  terkunci = false,
  onTambah,
  onUbah,
  onHapus,
}: {
  judul: string
  deskripsi?: string
  tombolLabel: string
  placeholderUraian: string
  satuanBawaan?: string
  items: ItemBiayaBebas[]
  terkunci?: boolean
  onTambah: () => void
  onUbah: (originalIndex: number, patch: Partial<BiayaPayload>) => void
  onHapus: (originalIndex: number) => void
}) {
  const total = items.reduce((sum, item) => {
    const qty = item.biaya.qty && item.biaya.qty > 0 ? item.biaya.qty : 1
    return sum + Math.round(qty * (item.biaya.tarif || 0))
  }, 0)

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h5 className="text-sm font-semibold text-foreground">{judul}</h5>
          {deskripsi ? <p className="text-xs text-muted-foreground mt-0.5">{deskripsi}</p> : null}
        </div>
        {items.length > 0 ? (
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Subtotal Tambahan</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{rupiah(total)}</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="min-w-[200px]" />
            <col className="w-16" />
            <col className="w-24" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="min-w-[180px]" />
            <col className="w-12" />
            {terkunci ? null : <col className="w-12" />}
          </colgroup>
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="text-left [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
              <th scope="col">Uraian Rincian</th>
              <th scope="col" className="text-center">
                Qty
              </th>
              <th scope="col">Satuan</th>
              <th scope="col">Tarif Satuan (Rp)</th>
              <th scope="col" className="text-right">
                Subtotal
              </th>
              <th scope="col">Keterangan / Bukti</th>
              <th scope="col" className="text-center" title="Tanpa kuitansi resmi (DPR)">
                DPR
              </th>
              {terkunci ? null : (
                <th scope="col">
                  <span className="sr-only">Aksi</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={terkunci ? 7 : 8} className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Belum ada rincian tambahan bebas. Klik tombol di bawah untuk menambah rincian baru.
                </td>
              </tr>
            ) : null}
            {items.map(({ biaya, originalIndex }) => {
              const qty = biaya.qty && biaya.qty > 0 ? biaya.qty : 1
              const subtotal = Math.round(qty * (biaya.tarif || 0))
              const tarifKosong = !biaya.tarif

              return (
                <tr key={originalIndex} className={cn('align-top border-t first:border-t-0', tarifKosong && 'bg-warning/5')}>
                  <td className="p-2">
                    <TextareaOtomatis
                      aria-label="Uraian rincian"
                      className={TEKS_KECIL}
                      placeholder={placeholderUraian}
                      disabled={terkunci}
                      value={biaya.uraian ?? ''}
                      onChange={(e) => onUbah(originalIndex, { uraian: e.target.value || null })}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="Jumlah (qty)"
                      className="h-8 px-1 text-center text-xs"
                      type="number"
                      min={1}
                      placeholder="1"
                      disabled={terkunci}
                      value={biaya.qty ?? ''}
                      onChange={(e) =>
                        onUbah(originalIndex, {
                          qty: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="Satuan"
                      className="h-8 px-2 text-xs"
                      placeholder={satuanBawaan}
                      disabled={terkunci}
                      value={biaya.satuan ?? ''}
                      onChange={(e) => onUbah(originalIndex, { satuan: e.target.value || null })}
                    />
                  </td>
                  <td className="p-2">
                    <RupiahInput
                      awalan
                      aria-label="Tarif satuan (Rp)"
                      className="h-8 font-mono text-xs"
                      nolKosong
                      disabled={terkunci}
                      value={biaya.tarif}
                      onChange={(v) => onUbah(originalIndex, { tarif: v ?? 0 })}
                    />
                    {tarifKosong ? <p className="mt-1 text-[11px] leading-tight text-warning-foreground">Tarif kosong</p> : null}
                  </td>
                  <td className="p-2">
                    <div className="flex h-8 items-center justify-end font-mono text-sm font-semibold tabular-nums">{rupiah(subtotal)}</div>
                  </td>
                  <td className="p-2">
                    <TextareaOtomatis
                      aria-label="Keterangan / bukti"
                      className={TEKS_KECIL}
                      placeholder="No. bukti / kuitansi / catatan"
                      disabled={terkunci}
                      value={biaya.keterangan ?? ''}
                      onChange={(e) => onUbah(originalIndex, { keterangan: e.target.value || null })}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex h-8 items-center justify-center">
                      <input
                        type="checkbox"
                        title="Tanpa kuitansi resmi (DPR)"
                        aria-label="Tanpa kuitansi resmi (DPR)"
                        disabled={terkunci}
                        checked={!!biaya.pengeluaranRiil}
                        onChange={(e) => onUbah(originalIndex, { pengeluaranRiil: e.target.checked })}
                        className="size-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </div>
                  </td>
                  {terkunci ? null : (
                    <td className="p-2">
                      <div className="flex h-8 items-center justify-center">
                        <button
                          type="button"
                          onClick={() => onHapus(originalIndex)}
                          title="Hapus rincian"
                          aria-label="Hapus rincian"
                          className="rounded p-1.5 text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2Icon className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {terkunci ? null : (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onTambah} className="gap-1.5 text-xs">
            <PlusIcon className="size-3.5" aria-hidden />
            {tombolLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
