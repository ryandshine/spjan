import { Trash2Icon } from 'lucide-react'
import {
  JENIS_BIAYA,
  JENIS_LABEL,
  jenisButuhEtape,
  jenisButuhProvinsi,
  jenisButuhUraian,
  type BarisBiaya,
  type BiayaPayload,
  type JenisBiaya,
} from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'

function Sel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

export function BiayaForm({
  biaya,
  etapeJumlah,
  etapeLabel,
  provinsi,
  baris,
  onUbah,
  onHapus,
}: {
  biaya: BiayaPayload
  etapeJumlah: number
  etapeLabel: (indeks: number) => string
  provinsi: string[]
  /** Baris hasil hitung untuk biaya ini (null/undefined bila tarif 0). */
  baris: BarisBiaya | null | undefined
  onUbah: (patch: Partial<BiayaPayload>) => void
  onHapus: () => void
}) {
  const perluProvinsi = jenisButuhProvinsi(biaya.jenis)
  const perluEtape = jenisButuhEtape(biaya.jenis) && etapeJumlah > 1
  const perluUraian = jenisButuhUraian(biaya.jenis)
  const uraianLabel =
    biaya.jenis === 'TRANSPORT_DARAT' || biaya.jenis === 'TRANSPORT_JAKARTA_SEKITAR' ? 'Kab/kota tujuan (persis PMK)' : 'Uraian'
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Sel label="Jenis biaya">
          <Select className="w-64" value={biaya.jenis} onChange={(e) => onUbah({ jenis: e.target.value as JenisBiaya })}>
            {JENIS_BIAYA.map((j) => (
              <option key={j} value={j}>
                {JENIS_LABEL[j]}
              </option>
            ))}
          </Select>
        </Sel>
        {perluEtape ? (
          <Sel label="Untuk etape">
            <Select
              className="w-44"
              value={biaya.etapeIndex ?? ''}
              onChange={(e) => onUbah({ etapeIndex: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{biaya.jenis === 'TIKET_PERGI' ? 'Etape 1 (otomatis)' : 'Etape terakhir (otomatis)'}</option>
              {Array.from({ length: etapeJumlah }, (_, i) => (
                <option key={i} value={i}>
                  {etapeLabel(i)}
                </option>
              ))}
            </Select>
          </Sel>
        ) : null}
        {perluProvinsi ? (
          <Sel label="Provinsi (untuk pagu)">
            <Select className="w-48" value={biaya.provinsi ?? ''} onChange={(e) => onUbah({ provinsi: e.target.value || null })}>
              <option value="">- pilih -</option>
              {provinsi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Sel>
        ) : null}
        {perluUraian ? (
          <Sel label={uraianLabel}>
            <Input className="w-56" value={biaya.uraian ?? ''} onChange={(e) => onUbah({ uraian: e.target.value || null })} />
          </Sel>
        ) : null}
        <Sel label="Jumlah">
          <Input
            className="w-20 text-right"
            type="number"
            min={1}
            placeholder="1"
            value={biaya.qty ?? ''}
            onChange={(e) => onUbah({ qty: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Sel>
        <Sel label="Tarif / harga (Rp)">
          <RupiahInput className="w-36" nolKosong value={biaya.tarif} onChange={(v) => onUbah({ tarif: v ?? 0 })} />
        </Sel>
        <Sel label="Keterangan">
          <Input
            className="w-40"
            placeholder="Bukti terlampir"
            value={biaya.keterangan ?? ''}
            onChange={(e) => onUbah({ keterangan: e.target.value || null })}
          />
        </Sel>
        <Button variant="ghost" size="icon" onClick={onHapus} aria-label="Hapus biaya">
          <Trash2Icon className="text-destructive" />
        </Button>
      </div>
      {baris ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Tercetak: <span className="text-foreground">{baris.uraian}</span>
            {baris.qty ? ` (${baris.qty} ${baris.satuan} @ ${rupiah(baris.tarif ?? 0)})` : ''}
          </span>
          <span className="font-medium tabular-nums">{rupiah(baris.jumlah)}</span>
        </div>
      ) : null}
      {baris?.catatan ? <p className="text-xs text-muted-foreground">{baris.catatan}</p> : null}
    </div>
  )
}
