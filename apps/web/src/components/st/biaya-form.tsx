import { Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import {
  JENIS_BIAYA,
  JENIS_LABEL,
  jenisButuhEtape,
  jenisButuhProvinsi,
  jenisButuhUraian,
  tarifTerminal,
  type BarisBiaya,
  type BiayaPayload,
  type JenisBiaya,
  type Sbm,
} from '@spjan/shared'

import { Istilah } from '@/components/ui/istilah'
import { RupiahInput } from '@/components/st/rupiah-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TextareaOtomatis } from '@/components/ui/textarea-otomatis'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'
import { cn } from '@/lib/utils'

function Sel({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('grid gap-1 text-xs text-muted-foreground', className)}>
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
  provinsiKedudukan,
  baris,
  sbm,
  onUbah,
  onHapus,
}: {
  biaya: BiayaPayload
  etapeJumlah: number
  etapeLabel: (indeks: number) => string
  provinsi: string[]
  provinsiKedudukan?: string | null
  /** Baris hasil hitung untuk biaya ini (null/undefined bila tarif 0). */
  baris: BarisBiaya | null | undefined
  sbm?: Sbm
  onUbah: (patch: Partial<BiayaPayload>) => void
  onHapus: () => void
}) {
  const perluProvinsi = jenisButuhProvinsi(biaya.jenis)
  const perluEtape = jenisButuhEtape(biaya.jenis) && etapeJumlah > 1
  const perluUraian = jenisButuhUraian(biaya.jenis) || !!biaya.uraian || biaya.jenis === 'TAKSI_TERMINAL'
  const namaProvinsiPagu =
    biaya.jenis === 'TAKSI_KEDUDUKAN' ? provinsiKedudukan : biaya.jenis === 'TAKSI_TERMINAL' ? biaya.provinsi : null
  const tarifTidakAda =
    !!sbm && !!namaProvinsiPagu && !biaya.tarif && tarifTerminal(sbm, namaProvinsiPagu) === undefined
  const uraianLabel =
    biaya.jenis === 'TRANSPORT_DARAT' || biaya.jenis === 'TRANSPORT_JAKARTA_SEKITAR'
      ? 'Kab/kota tujuan (persis PMK)'
      : biaya.jenis === 'TIKET_PERGI' || biaya.jenis === 'TIKET_KEMBALI'
        ? 'Uraian tiket'
        : biaya.jenis === 'TAKSI_TERMINAL'
          ? 'Uraian (opsional)'
          : 'Uraian'
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <Sel label="Jenis biaya" className="min-w-72 flex-[2]">
          <Select
            className="w-full"
            value={biaya.jenis}
            onChange={(e) => {
              const j = e.target.value as JenisBiaya
              const isJkt = j === 'TRANSPORT_JAKARTA_SEKITAR'
              const isTerminal = j === 'TAKSI_TERMINAL'
              let tarifPatch: number | undefined = undefined
              if (j === 'TAKSI_KEDUDUKAN' && !biaya.tarif && provinsiKedudukan && sbm) {
                tarifPatch = tarifTerminal(sbm, provinsiKedudukan)
              } else if (j === 'TAKSI_TERMINAL' && !biaya.tarif && biaya.provinsi && sbm) {
                tarifPatch = tarifTerminal(sbm, biaya.provinsi)
              }
              onUbah({
                jenis: j,
                ...(isJkt && !biaya.qty ? { qty: 2 } : {}),
                ...(isTerminal && !biaya.qty ? { qty: 2 } : {}),
                ...(tarifPatch ? { tarif: tarifPatch } : {}),
              })
            }}
          >
            {JENIS_BIAYA.map((j) => (
              <option key={j} value={j}>
                {JENIS_LABEL[j]}
              </option>
            ))}
          </Select>
        </Sel>
        {perluEtape ? (
          <Sel label="Untuk tujuan" className="min-w-64 flex-1">
            <Select
              className="w-full"
              value={biaya.etapeIndex ?? ''}
              onChange={(e) => onUbah({ etapeIndex: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{biaya.jenis === 'TIKET_PERGI' ? 'Tujuan 1 (otomatis)' : 'Tujuan terakhir (otomatis)'}</option>
              {Array.from({ length: etapeJumlah }, (_, i) => (
                <option key={i} value={i}>
                  {etapeLabel(i)}
                </option>
              ))}
            </Select>
          </Sel>
        ) : null}
        {perluProvinsi ? (
          <Sel label="Provinsi (untuk pagu)" className="min-w-72 flex-1">
            <Select
              className="w-full"
              value={biaya.provinsi ?? ''}
              onChange={(e) => {
                const pVal = e.target.value || null
                const tarifAuto =
                  biaya.jenis === 'TAKSI_TERMINAL' && pVal && sbm && !biaya.tarif
                    ? tarifTerminal(sbm, pVal)
                    : undefined
                onUbah({
                  provinsi: pVal,
                  ...(tarifAuto ? { tarif: tarifAuto } : {}),
                })
              }}
            >
              <option value="">- pilih -</option>
              {provinsi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Sel>
        ) : null}
        {biaya.jenis === 'TRANSPORT_JAKARTA_SEKITAR' ? (
          <Sel label="Kab/kota sekitar Jakarta" className="min-w-72 flex-1">
            <Select
              className="w-full"
              value={biaya.uraian ?? ''}
              onChange={(e) => {
                const kota = e.target.value
                const barisSbm = sbm?.transportJakarta.find((t) => t.kabKota === kota)
                onUbah({
                  uraian: kota || null,
                  ...(barisSbm ? { tarif: barisSbm.besaran } : {}),
                  ...(!biaya.qty ? { qty: 2 } : {}),
                })
              }}
            >
              <option value="">- pilih kota sekitar -</option>
              {(sbm?.transportJakarta ?? []).map((t) => (
                <option key={t.kabKota} value={t.kabKota}>
                  {t.kabKota} ({rupiah(t.besaran)})
                </option>
              ))}
            </Select>
          </Sel>
        ) : perluUraian ? (
          <Sel label={uraianLabel} className={cn('min-w-72 flex-1 basis-72', (biaya.jenis === 'TIKET_PERGI' || biaya.jenis === 'TIKET_KEMBALI') && 'flex-[2]')}>
            <TextareaOtomatis
              placeholder={biaya.jenis === 'TAKSI_TERMINAL' ? 'Otomatis: Taksi/transport dari-ke bandara/terminal sesuai provinsi' : undefined}
              value={biaya.uraian ?? ''}
              onChange={(e) => onUbah({ uraian: e.target.value || null })}
            />
          </Sel>
        ) : null}
        <Sel label="Jumlah">
          <Input
            className="w-24 text-right"
            type="number"
            min={1}
            placeholder="1"
            value={biaya.qty ?? ''}
            onChange={(e) => onUbah({ qty: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Sel>
        <Sel label="Tarif / harga (Rp)">
          <RupiahInput className="w-44" nolKosong value={biaya.tarif} onChange={(v) => onUbah({ tarif: v ?? 0 })} />
        </Sel>
        <Sel label="Keterangan" className="min-w-64 flex-1 basis-64">
          <TextareaOtomatis
            placeholder={biaya.jenis === 'TAKSI_KEDUDUKAN' || biaya.jenis === 'TAKSI_TERMINAL' ? '' : 'Bukti terlampir'}
            value={biaya.keterangan ?? ''}
            onChange={(e) => onUbah({ keterangan: e.target.value || null })}
          />
        </Sel>
        <Button variant="ghost" size="icon" className="ml-auto mt-5" onClick={onHapus} aria-label="Hapus biaya">
          <Trash2Icon className="text-destructive" />
        </Button>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-dashed">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          <input
            type="checkbox"
            checked={!!biaya.pengeluaranRiil}
            onChange={(e) => onUbah({ pengeluaranRiil: e.target.checked })}
            className="size-3.5 rounded border-muted text-primary focus:ring-primary"
          />
          <span>
            Tanpa kuitansi resmi (dicatat di <Istilah kata="DPR" />)
          </span>
        </label>
      </div>
      {tarifTidakAda ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Tarif taksi bandara untuk {namaProvinsiPagu} belum ada di tabel SBM (PMK 32 Tahun 2025), jadi tidak bisa terisi otomatis.
          Isi tarif secara manual sesuai bukti pengeluaran.
        </p>
      ) : null}
      {!biaya.tarif ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Tarif kosong, baris ini tidak dicetak.
        </p>
      ) : null}
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
