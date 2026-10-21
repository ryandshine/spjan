import {
  biayaKosong,
  indeksBarisTransport,
  type BiayaPayload,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
} from '@spjan/shared'

import { BiayaBaris } from '@/components/st/biaya-form'
import { BlokForm } from '@/components/st/blok-form'
import { MenuAksi } from '@/components/ui/menu-aksi'
import { rupiah } from '@/lib/format'
import {
  biayaPerTujuan,
  biayaTaksiKedudukan,
  biayaTaksiTerminal,
  tambahTransportJakartaSekitar,
  ubahBiaya,
} from '@/lib/pelaksana-ubah'

/** Tabel biaya transportasi satu pelaksana beserta menu penambahnya. */
export function BlokTransportasi({
  p,
  hasil,
  sbm,
  provinsi,
  provinsiKedudukan,
  onUbah,
}: {
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  sbm: Sbm
  provinsi: string[]
  provinsiKedudukan?: string | null
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
}) {
  const indeks = indeksBarisTransport(p.biaya)
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
                Qty
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
            {p.biaya.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Belum ada biaya.
                </td>
              </tr>
            ) : null}
            {p.biaya.map((b, i) => (
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
      <div className="mt-3 flex items-center justify-between">
        <MenuAksi
          label="Tambah biaya"
          teks="Tambah Biaya"
          item={[
            { label: 'Tiket Pergi', onPilih: () => tambahDariMenu('TIKET_PERGI') },
            { label: 'Tiket Kembali', onPilih: () => tambahDariMenu('TIKET_KEMBALI') },
            { label: 'Taksi Asal (tempat kedudukan - bandara)', onPilih: () => tambahDariMenu('TAKSI_KEDUDUKAN') },
            { label: 'Taksi Tujuan (bandara - kota tujuan)', onPilih: () => tambahDariMenu('TAKSI_TERMINAL') },
            { label: 'Transport Jakarta - sekitarnya (PP)', onPilih: () => tambahDariMenu('TRANSPORT_JAKARTA_SEKITAR') },
            { label: 'BBM Kendaraan (PP)', onPilih: () => tambahDariMenu('BBM_KENDARAAN') },
            { label: 'E-Toll (PP)', onPilih: () => tambahDariMenu('TOL_ETOLL') },
            { label: 'Biaya Riil Lainnya', onPilih: () => tambahDariMenu('LAINNYA') },
          ]}
        />
        <p className="text-sm font-semibold text-foreground">
          Subtotal Transportasi: <span className="font-mono tabular-nums">{rupiah(hasil?.totalTransport ?? 0)}</span>
        </p>
      </div>
    </BlokForm>
  )
}
