import { useState } from 'react'
import { PlusIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import { dokPunyaIsi, norm, type Bagian, type BagianModel, type BarisTataWaktuLaporan, type ModelLaporan } from '@spjan/shared'

import { EditorTeks } from '@/components/laporan/editor-teks'
import { labelBagian } from '@/lib/laporan-label'
import { MenuBagian } from '@/components/laporan/menu-bagian'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PenandaIsian } from '@/components/ui/penanda-isian'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { Textarea } from '@/components/ui/textarea'

const PLACEHOLDER: Record<string, string> = {
  hasil:
    'Uraikan apa yang dilakukan dan ditemukan selama perjalanan dinas: kegiatan di lokasi, kondisi yang diamati, dan permasalahan. Pakai subjudul untuk mengelompokkan.',
  simpulan: 'Tulis simpulan singkat, lalu saran dan tindak lanjut. Gunakan daftar bernomor untuk saran.',
}

function placeholderNarasi(b: Extract<Bagian, { jenis: 'teks' }>): string {
  if (PLACEHOLDER[b.id]) return PLACEHOLDER[b.id] as string
  return 'Tulis isi bagian ini.'
}

function keterangan(b: Bagian): string {
  switch (b.jenis) {
    case 'sampul':
      return 'Halaman depan laporan. Judul dan tanggal terisi otomatis.'
    case 'petugas':
      return 'Nama diambil dari surat tugas. Instansi terisi dari data pegawai; ubah bila perlu.'
    case 'dokumentasi':
      return 'Lampiran foto kegiatan.'
    case 'tatawaktu':
      return 'Kegiatan dan tanggal diambil dari etape surat tugas.'
    case 'teks':
      return ''
    default:
      return 'Ikut berubah bila data surat tugas diubah.'
  }
}

function ModeOtomatis({
  otomatis,
  onTulisSendiri,
  onKembali,
}: {
  otomatis: boolean
  onTulisSendiri: () => void
  onKembali: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {otomatis ? (
        <Badge variant="default">Otomatis dari surat tugas</Badge>
      ) : (
        <p className="flex items-start gap-1.5 text-sm font-medium text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> Anda menulis sendiri bagian ini. Perubahan di surat tugas tidak lagi tampil di sini.
        </p>
      )}
      {otomatis ? (
        <Button type="button" variant="outline" className="h-10" onClick={onTulisSendiri}>Tulis sendiri</Button>
      ) : (
        <Button type="button" variant="outline" className="h-10" onClick={onKembali}>Kembali ke otomatis</Button>
      )}
    </div>
  )
}

function EditorTataWaktu({ baris, onUbah }: { baris: BarisTataWaktuLaporan[]; onUbah: (b: BarisTataWaktuLaporan[]) => void }) {
  const ganti = (i: number, b: BarisTataWaktuLaporan) => onUbah(baris.map((x, n) => (n === i ? b : x)))
  return (
    <div className="grid gap-2">
      {baris.map((b, i) => (
        <div key={i} className="grid items-start gap-2 border-t pt-2 sm:grid-cols-[1fr_180px_auto]">
          <Textarea rows={2} placeholder="Kegiatan (satu per baris)" value={b.kegiatan.join('\n')} onChange={(e) => ganti(i, { ...b, kegiatan: e.target.value.split('\n') })} />
          <Input placeholder="Tanggal, mis. 17 September 2026" value={b.tanggal} onChange={(e) => ganti(i, { ...b, tanggal: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => onUbah(baris.filter((_, n) => n !== i))}>
            <Trash2Icon className="size-4 text-destructive" />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onUbah([...baris, { kegiatan: [''], tanggal: '' }])}>
          <PlusIcon className="size-3.5" /> Baris
        </Button>
      </div>
    </div>
  )
}

export function PanelBagian({
  bagian,
  model,
  stId,
  sampul,
  jumlahFoto,
  bisaNaik,
  bisaTurun,
  onUbah,
  onNaik,
  onTurun,
  onHapus,
}: {
  bagian: Bagian
  model: BagianModel | undefined
  stId: number
  sampul: ModelLaporan['sampul']
  jumlahFoto: number
  bisaNaik: boolean
  bisaTurun: boolean
  onUbah: (b: Bagian) => void
  onNaik: () => void
  onTurun: () => void
  onHapus: () => void
}) {
  const [gantiJudul, setGantiJudul] = useState(false)
  const tetap = bagian.jenis === 'sampul'
  const ket = keterangan(bagian)
  return (
    <Card id="panel-laporan" className="scroll-mt-4">
      <CardContent className="grid gap-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {gantiJudul && bagian.jenis !== 'sampul' ? (
              <Input
                autoFocus
                className="h-10 text-base font-semibold"
                aria-label="Judul bagian"
                placeholder="Judul bagian (kosongkan untuk tanpa judul)"
                value={bagian.judul}
                onChange={(e) => onUbah({ ...bagian, judul: e.target.value })}
                onBlur={() => setGantiJudul(false)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setGantiJudul(false)}
              />
            ) : (
              <h2 className="text-lg font-semibold leading-tight">
                {model?.nomor ? `${model.nomor}. ` : ''}
                {labelBagian(bagian)}
              </h2>
            )}
            {ket ? <p className="mt-1 text-sm text-muted-foreground">{ket}</p> : null}
            {bagian.jenis === 'teks' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <PenandaIsian mode={bagian.judul.trim() ? 'wajib' : 'opsional'} />
                {bagian.judul.trim() ? 'Bagian ini Anda yang menulis.' : 'Boleh dikosongkan.'}
              </div>
            ) : null}
          </div>
          {!tetap ? <MenuBagian bisaNaik={bisaNaik} bisaTurun={bisaTurun} onGantiJudul={() => setGantiJudul(true)} onNaik={onNaik} onTurun={onTurun} onHapus={onHapus} /> : null}
        </div>

        {bagian.jenis === 'sampul' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              <span className="flex flex-wrap items-center justify-between gap-2">
                Judul laporan
                <PenandaIsian mode="otomatis" otomatisAktif={!bagian.judul} onKembali={() => onUbah({ ...bagian, judul: null })} />
              </span>
              <Input className="h-10" placeholder={sampul.judul} value={bagian.judul ?? ''} onChange={(e) => onUbah({ ...bagian, judul: e.target.value || null })} />
            </label>
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span className="flex flex-wrap items-center justify-between gap-2">
                Tanggal laporan
                <PenandaIsian mode="otomatis" otomatisAktif={!bagian.tanggal} onKembali={() => onUbah({ ...bagian, tanggal: null })} />
              </span>
              <InputTanggal label="Tanggal laporan" nilai={bagian.tanggal} onUbah={(iso) => onUbah({ ...bagian, tanggal: iso })} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Tercetak: {sampul.tempatTanggal}</p>
          </div>
        ) : null}

        {bagian.jenis === 'petugas' && model?.isi.jenis === 'petugas' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs">
                <tr>
                  <th className="w-10 px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Nama (dari surat tugas)</th>
                  <th className="min-w-72 px-2 py-1.5">Instansi</th>
                </tr>
              </thead>
              <tbody>
                {model.isi.baris.map((r) => (
                  <tr key={r.nama + r.no} className="border-t">
                    <td className="px-2 py-1">{r.no}</td>
                    <td className="px-2 py-1">{r.nama}</td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-10"
                        aria-label={`Instansi ${r.nama}`}
                        value={r.instansi}
                        onChange={(e) => {
                          const kunci = norm(r.nama)
                          const lain = bagian.instansi.filter((x) => norm(x.kunci) !== kunci)
                          onUbah({ ...bagian, instansi: e.target.value ? [...lain, { kunci, instansi: e.target.value }] : lain })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {(bagian.jenis === 'dasar' || bagian.jenis === 'maksud' || bagian.jenis === 'tempat' || bagian.jenis === 'lama') && model?.isi.jenis === 'dokumen' ? (
          <>
            <ModeOtomatis
              otomatis={bagian.ganti === null}
              onTulisSendiri={() => onUbah({ ...bagian, ganti: model.isi.jenis === 'dokumen' ? model.isi.dok : null })}
              onKembali={() => onUbah({ ...bagian, ganti: null })}
            />
            {bagian.ganti === null ? (
              dokPunyaIsi(model.isi.dok) ? (
                <EditorTeks key={`${bagian.id}-oto-${JSON.stringify(model.isi.dok)}`} dok={model.isi.dok} stId={stId} bacaSaja />
              ) : (
                <p className="text-sm italic text-muted-foreground">Belum ada data di surat tugas untuk bagian ini.</p>
              )
            ) : (
              <EditorTeks key={`${bagian.id}-sendiri`} dok={bagian.ganti} stId={stId} onUbah={(d) => onUbah({ ...bagian, ganti: d })} />
            )}
          </>
        ) : null}

        {bagian.jenis === 'tatawaktu' && model?.isi.jenis === 'tatawaktu' ? (
          <>
            <ModeOtomatis
              otomatis={bagian.ganti === null}
              onTulisSendiri={() => onUbah({ ...bagian, ganti: model.isi.jenis === 'tatawaktu' ? model.isi.baris.map(({ kegiatan, tanggal }) => ({ kegiatan, tanggal })) : [] })}
              onKembali={() => onUbah({ ...bagian, ganti: null })}
            />
            {bagian.ganti === null ? (
              model.isi.baris.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Belum ada etape di surat tugas.</p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {model.isi.baris.map((r) => (
                    <li key={r.no}>
                      {r.no}. {r.kegiatan.join('; ')} <span className="text-muted-foreground">({r.tanggal})</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <EditorTataWaktu baris={bagian.ganti} onUbah={(baris) => onUbah({ ...bagian, ganti: baris })} />
            )}
          </>
        ) : null}

        {bagian.jenis === 'dokumentasi' ? (
          <p className="text-sm text-muted-foreground">
            {jumlahFoto === 0 ? 'Belum ada foto.' : `${jumlahFoto} foto akan dicetak dengan keterangannya.`} Foto diunggah di tab Bukti &amp; usulan, kartu Foto Dokumentasi Kegiatan.
          </p>
        ) : null}

        {bagian.jenis === 'teks' ? <EditorTeks key={bagian.id} dok={bagian.isi} stId={stId} placeholder={placeholderNarasi(bagian)} onUbah={(d) => onUbah({ ...bagian, isi: d })} /> : null}
      </CardContent>
    </Card>
  )
}
