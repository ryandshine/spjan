import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { norm, type Bagian, type BagianModel, type BarisTataWaktuLaporan, type Blok, type ModelLaporan } from '@spjan/shared'

import { BlokEditor } from '@/components/laporan/blok-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const NAMA_JENIS: Record<Bagian['jenis'], string> = {
  sampul: 'Sampul',
  petugas: 'Tabel petugas',
  dokumentasi: 'Dokumentasi',
  dasar: 'Teks otomatis',
  maksud: 'Teks otomatis',
  tempat: 'Teks otomatis',
  lama: 'Teks otomatis',
  tatawaktu: 'Tata waktu',
  teks: 'Teks bebas',
}

function PratinjauBlok({ blok }: { blok: Blok[] }) {
  if (blok.length === 0) return <p className="text-sm italic text-muted-foreground">Belum ada data di surat tugas untuk bagian ini.</p>
  return (
    <div className="grid gap-1 text-sm">
      {blok.map((b, i) =>
        b.tipe === 'paragraf' ? (
          <p key={i}>{b.teks}</p>
        ) : b.tipe === 'subjudul' ? (
          <p key={i} className="font-semibold">{b.teks}</p>
        ) : (
          <ul key={i} className={b.tipe === 'nomor' ? 'list-inside list-decimal' : 'list-inside list-disc'}>
            {b.butir.map((x, n) => (
              <li key={n}>{x}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
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
      {otomatis ? <Badge variant="default">Otomatis dari data ST</Badge> : <Badge variant="warning">Ditulis sendiri (tidak mengikuti ST)</Badge>}
      {otomatis ? (
        <Button type="button" variant="outline" size="sm" onClick={onTulisSendiri}>Tulis sendiri</Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onKembali}>Kembali ke otomatis</Button>
      )}
    </div>
  )
}

function EditorTataWaktu({ baris, onUbah }: { baris: BarisTataWaktuLaporan[]; onUbah: (b: BarisTataWaktuLaporan[]) => void }) {
  const ganti = (i: number, b: BarisTataWaktuLaporan) => onUbah(baris.map((x, n) => (n === i ? b : x)))
  return (
    <div className="grid gap-2">
      {baris.map((b, i) => (
        <div key={i} className="grid items-start gap-2 rounded-md border bg-card p-2 sm:grid-cols-[1fr_180px_auto]">
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

export function BagianCard({
  bagian,
  model,
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
  sampul: ModelLaporan['sampul']
  jumlahFoto: number
  bisaNaik: boolean
  bisaTurun: boolean
  onUbah: (b: Bagian) => void
  onNaik: () => void
  onTurun: () => void
  onHapus: () => void
}) {
  const tetap = bagian.jenis === 'sampul'
  return (
    <Card>
      <CardContent className="grid gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {model?.nomor ? `${model.nomor}. ` : ''}
            {NAMA_JENIS[bagian.jenis]}
          </span>
          {bagian.jenis !== 'sampul' ? (
            <Input
              className="min-w-48 flex-1 font-semibold"
              aria-label="Judul bagian"
              placeholder={bagian.jenis === 'teks' ? 'Tanpa judul (tidak bernomor)' : 'Judul bagian'}
              value={bagian.judul}
              onChange={(e) => onUbah({ ...bagian, judul: e.target.value })}
            />
          ) : (
            <span className="flex-1" />
          )}
          {!tetap ? (
            <div className="flex items-center">
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Geser bagian ke atas" disabled={!bisaNaik} onClick={onNaik}>
                <ChevronUpIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Geser bagian ke bawah" disabled={!bisaTurun} onClick={onTurun}>
                <ChevronDownIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Hapus bagian" onClick={onHapus}>
                <Trash2Icon className="size-4 text-destructive" />
              </Button>
            </div>
          ) : null}
        </div>

        {bagian.jenis === 'sampul' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Judul (kosongkan untuk otomatis)
              <Input placeholder={sampul.judul} value={bagian.judul ?? ''} onChange={(e) => onUbah({ ...bagian, judul: e.target.value || null })} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Tanggal sampul (kosongkan untuk otomatis)
              <Input type="date" value={bagian.tanggal ?? ''} onChange={(e) => onUbah({ ...bagian, tanggal: e.target.value || null })} />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Tercetak: {sampul.tempatTanggal}</p>
          </div>
        ) : null}

        {bagian.jenis === 'petugas' && model?.isi.jenis === 'petugas' ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs">
                <tr>
                  <th className="w-10 px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Nama (dari surat tugas)</th>
                  <th className="w-64 px-2 py-1.5">Instansi (isi manual)</th>
                </tr>
              </thead>
              <tbody>
                {model.isi.baris.map((r) => (
                  <tr key={r.nama + r.no} className="border-t">
                    <td className="px-2 py-1">{r.no}</td>
                    <td className="px-2 py-1">{r.nama}</td>
                    <td className="px-2 py-1">
                      <Input
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

        {(bagian.jenis === 'dasar' || bagian.jenis === 'maksud' || bagian.jenis === 'tempat' || bagian.jenis === 'lama') && model?.isi.jenis === 'blok' ? (
          <>
            <ModeOtomatis
              otomatis={bagian.ganti === null}
              onTulisSendiri={() => onUbah({ ...bagian, ganti: model.isi.jenis === 'blok' ? model.isi.blok : [] })}
              onKembali={() => onUbah({ ...bagian, ganti: null })}
            />
            {bagian.ganti === null ? (
              <PratinjauBlok blok={model.isi.blok} />
            ) : (
              <BlokEditor blok={bagian.ganti} onUbah={(blok) => onUbah({ ...bagian, ganti: blok })} />
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
            {jumlahFoto} foto dari kartu Foto Dokumentasi (tab Bukti &amp; usulan), dicetak dengan keterangannya.
          </p>
        ) : null}

        {bagian.jenis === 'teks' ? <BlokEditor blok={bagian.blok} onUbah={(blok) => onUbah({ ...bagian, blok })} /> : null}
      </CardContent>
    </Card>
  )
}
