import type { PengaturanPayload, SumberDana, SuratTugasPayload } from '@spjan/shared'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { Textarea } from '@/components/ui/textarea'
import { tanggalPanjang } from '@/lib/format'
import type { PetaGalat } from '@/lib/validasi'

const PILIHAN_SUMBER_DANA: ReadonlyArray<{ nilai: SumberDana; label: string }> = [
  { nilai: 'RM', label: 'Rupiah Murni (RM)' },
  { nilai: 'PNBP', label: 'PNBP' },
]

/** Kartu isian utama surat tugas: nomor, tanggal, tahun anggaran, sumber dana, kode akun, catatan. */
export function KartuDataSt({
  st,
  peta,
  pengaturan,
  onUbah,
  onUbahSumberDana,
}: {
  st: SuratTugasPayload
  peta: PetaGalat
  pengaturan: PengaturanPayload
  onUbah: (patch: Partial<SuratTugasPayload>) => void
  onUbahSumberDana: (sumberDana: SumberDana) => void
}) {
  const sumberDanaAktif = st.sumberDana ?? 'RM'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Surat tugas</CardTitle>
      </CardHeader>
      <CardContent className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Nomor surat tugas" htmlFor="st-nomor" className="sm:col-span-2" error={peta.nomor} mode="wajib">
          <Input id="st-nomor" value={st.nomor} onChange={(e) => onUbah({ nomor: e.target.value })} placeholder="ST.226/PPS/PEMPS/PSL.04.02/B/09/2026" />
        </Field>
        <Field label="Tanggal surat tugas" htmlFor="st-tanggal" error={peta.tanggal} hint={tanggalPanjang(st.tanggal) || undefined} mode="wajib">
          <InputTanggal id="st-tanggal" label="Tanggal surat tugas" nilai={st.tanggal} onUbah={(iso) => onUbah({ tanggal: iso ?? '' })} />
        </Field>
        <Field
          label="Tanggal SPJ (tanggal dokumen)"
          htmlFor="st-spj"
          mode="otomatis"
          otomatisAktif={!st.tanggalSpj}
          onKembaliOtomatis={() => onUbah({ tanggalSpj: null })}
          hint={tanggalPanjang(st.tanggalSpj) || 'Otomatis: tanggal saat dokumen dibuat. Isi hanya bila ada tanggal SPJ khusus.'}
        >
          <InputTanggal id="st-spj" label="Tanggal SPJ" nilai={st.tanggalSpj} onUbah={(iso) => onUbah({ tanggalSpj: iso })} />
        </Field>
        <Field
          label="Tahun anggaran"
          htmlFor="st-tahun"
          mode="otomatis"
          otomatisAktif={st.tahunAnggaran == null}
          onKembaliOtomatis={() => onUbah({ tahunAnggaran: null })}
          hint={`Otomatis: ${pengaturan.tahunAnggaran} (dari Pengaturan).`}
        >
          <Input
            id="st-tahun"
            type="number"
            inputMode="numeric"
            value={st.tahunAnggaran ?? ''}
            placeholder={String(pengaturan.tahunAnggaran)}
            onChange={(e) => {
              const isian = e.target.value.trim()
              onUbah({ tahunAnggaran: isian === '' ? null : Number(isian) })
            }}
          />
        </Field>
        <Field label="Sumber dana (mata anggaran)" htmlFor="st-sumber-dana" mode="wajib" hint="Memilih RM atau PNBP menyesuaikan kode akun otomatis.">
          <div className="flex items-center gap-4 pt-1.5">
            {PILIHAN_SUMBER_DANA.map(({ nilai, label }) => (
              <label key={nilai} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="sumberDana"
                  value={nilai}
                  checked={sumberDanaAktif === nilai}
                  onChange={() => onUbahSumberDana(nilai)}
                  className="size-4 text-primary focus:ring-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Kode akun (mata anggaran)" htmlFor="st-akun" className="sm:col-span-2" error={peta.kodeAkun} mode="wajib">
          <Input id="st-akun" value={st.kodeAkun} onChange={(e) => onUbah({ kodeAkun: e.target.value })} />
        </Field>
        <Field label="Catatan" htmlFor="st-catatan" className="sm:col-span-2" mode="opsional">
          <Textarea id="st-catatan" rows={2} value={st.catatan} onChange={(e) => onUbah({ catatan: e.target.value })} />
        </Field>
      </CardContent>
    </Card>
  )
}
