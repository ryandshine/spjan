import { useState } from 'react'
import { RotateCcwIcon } from 'lucide-react'
import type { PegawaiDto, PengaturanPayload, SuratTugasPayload } from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { adaDataPejabat, cariPegawaiPejabat, pejabatDariPegawai } from '@/lib/st-editor'

/** Pejabat penandatangan kuitansi: memakai bawaan Pengaturan kecuali diubah di sini. */
export function KartuPejabatSt({
  st,
  pengaturan,
  pegawai,
  onUbah,
}: {
  st: SuratTugasPayload
  pengaturan: PengaturanPayload
  pegawai: PegawaiDto[]
  onUbah: (patch: Partial<SuratTugasPayload>) => void
}) {
  const [terbuka, setTerbuka] = useState(false)
  const adaIsian = adaDataPejabat(st)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Pejabat yang Bertanggung Jawab</CardTitle>
          {terbuka ? null : (
            <p className="mt-1 text-xs text-muted-foreground">
              Penandatangan: <strong>{st.pjNama || pengaturan.pjNama || 'Belum diatur'}</strong>
              {adaIsian ? '' : ' (bawaan dari Pengaturan)'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {terbuka && adaIsian ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUbah({ pjNama: null, pjNip: null, pjJabatan: null })}
              title="Gunakan pejabat bawaan dari Pengaturan"
            >
              <RotateCcwIcon className="mr-1 size-3.5" /> Reset ke bawaan
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setTerbuka((t) => !t)} aria-expanded={terbuka}>
            {terbuka ? 'Tutup' : 'Ubah'}
          </Button>
        </div>
      </CardHeader>
      {terbuka ? (
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Pilih dari daftar pegawai" htmlFor="pj-pegawai" className="sm:col-span-2">
            <Select
              id="pj-pegawai"
              value={cariPegawaiPejabat(pegawai, st)?.id ?? ''}
              onChange={(e) => {
                const dipilih = pegawai.find((g) => g.id === Number(e.target.value))
                if (dipilih) onUbah(pejabatDariPegawai(dipilih))
              }}
            >
              <option value="">
                {adaIsian
                  ? '- Pilih pegawai untuk mengganti -'
                  : `- Gunakan bawaan Pengaturan (${pengaturan.pjNama || 'Belum diatur'}) -`}
              </option>
              {pegawai.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama} {g.nip ? `(${g.nip})` : ''} {g.jabatan ? `- ${g.jabatan}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nama pejabat" htmlFor="pj-nama">
            <Input
              id="pj-nama"
              value={st.pjNama ?? ''}
              placeholder={pengaturan.pjNama || 'Nama Pejabat'}
              onChange={(e) => onUbah({ pjNama: e.target.value || null })}
            />
          </Field>
          <Field label="NIP pejabat" htmlFor="pj-nip">
            <Input
              id="pj-nip"
              value={st.pjNip ?? ''}
              placeholder={pengaturan.pjNip || 'NIP. ...'}
              onChange={(e) => onUbah({ pjNip: e.target.value || null })}
            />
          </Field>
          <Field label="Jabatan pejabat" htmlFor="pj-jabatan" className="sm:col-span-2">
            <Input
              id="pj-jabatan"
              value={st.pjJabatan ?? ''}
              placeholder={pengaturan.pjJabatan || 'Jabatan'}
              onChange={(e) => onUbah({ pjJabatan: e.target.value || null })}
            />
          </Field>
        </CardContent>
      ) : null}
    </Card>
  )
}
