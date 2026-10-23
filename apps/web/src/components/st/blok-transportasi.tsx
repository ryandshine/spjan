import { PlusIcon } from 'lucide-react'
import {
  biayaKosong,
  indeksBarisTransport,
  isJenisTransport,
  type BiayaPayload,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
} from '@spjan/shared'

import { BiayaBaris } from '@/components/st/biaya-form'
import { BlokForm } from '@/components/st/blok-form'
import { Button } from '@/components/ui/button'
import { rupiah } from '@/lib/format'
import {
  biayaPerTujuan,
  biayaTaksiKedudukan,
  biayaTaksiTerminal,
  tambahTransportJakartaSekitar,
  ubahBiaya,
} from '@/lib/pelaksana-ubah'

const PILIHAN_BIAYA = [
  { jenis: 'TIKET_PERGI', label: 'Tiket Pergi' },
  { jenis: 'TIKET_KEMBALI', label: 'Tiket Kembali' },
  { jenis: 'TAKSI_KEDUDUKAN', label: 'Taksi Asal (tempat kedudukan - bandara)' },
  { jenis: 'TAKSI_TERMINAL', label: 'Taksi Tujuan (bandara - kota tujuan)' },
  { jenis: 'TRANSPORT_JAKARTA_SEKITAR', label: 'Transport Jakarta - sekitarnya (PP)' },
  { jenis: 'BBM_KENDARAAN', label: 'BBM Kendaraan (PP)' },
  { jenis: 'TOL_ETOLL', label: 'E-Toll (PP)' },
  { jenis: 'LAINNYA', label: 'Biaya Riil Lainnya' },
] as const

/** Tabel biaya transportasi satu pelaksana beserta menu penambahnya. */
export function BlokTransportasi({
  p,
  hasil,
  sbm,
  provinsi,
  provinsiKedudukan,
  onUbah,
  terkunci = false,
}: {
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  sbm: Sbm
  provinsi: string[]
  provinsiKedudukan?: string | null
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  terkunci?: boolean
}) {
  const indeks = indeksBarisTransport(p.biaya)
  const itemsTransport = p.biaya
    .map((biaya, originalIndex) => ({ biaya, originalIndex }))
    .filter(({ biaya }) => isJenisTransport(biaya.jenis))

  const tambahBiaya = (b: BiayaPayload) => onUbah((x) => ({ ...x, biaya: [...x.biaya, b] }))

  function tambahDariMenu(jenis: string) {
    if (jenis === 'TIKET_PERGI') tambahBiaya(biayaPerTujuan(p, 'TIKET_PERGI'))
    else if (jenis === 'TIKET_KEMBALI') tambahBiaya(biayaKosong('TIKET_KEMBALI'))
    else if (jenis === 'TAKSI_KEDUDUKAN') tambahBiaya(biayaTaksiKedudukan(provinsiKedudukan, sbm))
    else if (jenis === 'TAKSI_TERMINAL') tambahBiaya(biayaTaksiTerminal(p, sbm))
    else if (jenis === 'TRANSPORT_JAKARTA_SEKITAR') onUbah((x) => tambahTransportJakartaSekitar(x, sbm))
    else if (jenis === 'BBM_KENDARAAN' || jenis === 'TOL_ETOLL') tambahBiaya(biayaPerTujuan(p, jenis))
    else if (jenis === 'LAINNYA') tambahBiaya(biayaKosong('LAINNYA'))
  }

  return (
    <BlokForm judul="Transportasi">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="min-w-[240px]" />
            <col className="w-16" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="min-w-[200px]" />
            <col className="w-12" />
            <col className="w-12" />
          </colgroup>
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="text-left [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
              <th scope="col">Komponen Biaya &amp; Provinsi</th>
              <th scope="col" className="text-center">
                Qty / Satuan
              </th>
              <th scope="col">Tarif Satuan (Rp)</th>
              <th scope="col" className="text-right">
                Subtotal
              </th>
              <th scope="col">Keterangan / No. Tiket</th>
              <th scope="col" className="text-center" title="Tanpa kuitansi resmi (DPR)">
                DPR
              </th>
              <th scope="col">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {itemsTransport.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Belum ada biaya transportasi. Tambahkan lewat tombol di bawah.
                </td>
              </tr>
            ) : null}
            {itemsTransport.map(({ biaya: b, originalIndex: i }) => (
              <BiayaBaris
                key={i}
                biaya={b}
                etapeJumlah={p.etape.length}
                etapeLabel={(k) => `Tujuan ${k + 1}${p.etape[k]?.kota ? ` - ${p.etape[k]?.kota}` : ''}`}
                provinsi={provinsi}
                provinsiKedudukan={provinsiKedudukan}
                baris={indeks[i] != null ? hasil?.transport[indeks[i] as number] : null}
                sbm={sbm}
                onUbah={(patch) => onUbah((x) => ubahBiaya(x, i, patch))}
                onHapus={() => onUbah((x) => ({ ...x, biaya: x.biaya.filter((_, j) => j !== i) }))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {!terkunci ? (
          <div className="flex flex-wrap items-center gap-2">
            {PILIHAN_BIAYA.map((o) => (
              <Button
                key={o.jenis}
                type="button"
                variant="outline"
                size="sm"
                title={o.label}
                onClick={() => tambahDariMenu(o.jenis)}
                className="gap-1.5 text-xs"
              >
                <PlusIcon className="size-3.5" aria-hidden />
                {o.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => tambahBiaya({ ...biayaKosong('LAINNYA'), satuan: 'kali', qty: 1, tarif: 0, pengeluaranRiil: false })}
              className="gap-1.5 text-xs"
            >
              <PlusIcon className="size-3.5" aria-hidden />
              Tambah Rincian Bebas (Manual)
            </Button>
          </div>
        ) : <div />}
        <p className="text-sm font-semibold text-foreground">
          Subtotal Transportasi: <span className="font-mono tabular-nums">{rupiah(hasil?.totalTransport ?? 0)}</span>
        </p>
      </div>
    </BlokForm>
  )
}
