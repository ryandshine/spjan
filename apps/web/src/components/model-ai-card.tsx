import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ModelAiPayloadSchema, type ModelAiDto, type UjiModelHasil } from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { pesanGalat } from '@/lib/format'
import { useModelAi, useSimpanModelAi, useUjiModelAi } from '@/lib/queries'

const kosongJadiNull = (v: string) => (v.trim() === '' ? null : v.trim())

function HasilUji({ hasil }: { hasil: UjiModelHasil }) {
  return hasil.ok ? (
    <Alert>
      Model <strong>{hasil.model}</strong> menjawab dalam {Math.round(hasil.durasiMs / 100) / 10} detik: &ldquo;{hasil.balasan}&rdquo;
    </Alert>
  ) : (
    <Alert variant="destructive">
      {hasil.model ? <strong>{hasil.model}: </strong> : null}
      {hasil.pesan ?? 'Uji gagal.'}
    </Alert>
  )
}

function FormModelAi({ awal }: { awal: ModelAiDto }) {
  const simpan = useSimpanModelAi()
  const uji = useUjiModelAi()
  const [url, setUrl] = useState(awal.llmUrl ?? '')
  const [teks, setTeks] = useState(awal.modelTeks ?? '')
  const [gambar, setGambar] = useState(awal.modelGambar ?? '')
  const [galat, setGalat] = useState<string | null>(null)
  const [hasilUji, setHasilUji] = useState<{ jenis: 'teks' | 'gambar'; hasil: UjiModelHasil } | null>(null)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat(null)
    const parsed = ModelAiPayloadSchema.safeParse({ llmUrl: kosongJadiNull(url), modelTeks: kosongJadiNull(teks), modelGambar: kosongJadiNull(gambar) })
    if (!parsed.success) {
      setGalat(parsed.error.issues[0]?.message ?? 'Isian tidak valid.')
      return
    }
    try {
      await simpan.mutateAsync(parsed.data)
      toast.success('Model AI disimpan.')
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  async function ujiModel(jenis: 'teks' | 'gambar') {
    setHasilUji(null)
    try {
      setHasilUji({ jenis, hasil: await uji.mutateAsync(jenis) })
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  return (
    <form onSubmit={kirim} className="grid gap-4">
      {galat ? <Alert variant="destructive">{galat}</Alert> : null}
      <Field label="Alamat Ollama" htmlFor="llmUrl" hint={`Kosong = bawaan server (${awal.bawaanUrl}).`}>
        <Input id="llmUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={awal.bawaanUrl} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Model teks" htmlFor="modelTeks" hint="Untuk dokumen PDF berteks (mis. surat tugas).">
          <Input id="modelTeks" value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="gpt-oss:120b-cloud" />
        </Field>
        <Field label="Model gambar" htmlFor="modelGambar" hint="Harus mendukung gambar (vision), untuk foto invoice, tiket, dan struk.">
          <Input id="modelGambar" value={gambar} onChange={(e) => setGambar(e.target.value)} placeholder="mis. kimi-k3:cloud" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={simpan.isPending}>
          {simpan.isPending ? 'Menyimpan...' : 'Simpan model'}
        </Button>
        <Button type="button" variant="outline" disabled={uji.isPending} onClick={() => ujiModel('teks')}>
          Uji model teks
        </Button>
        <Button type="button" variant="outline" disabled={uji.isPending} onClick={() => ujiModel('gambar')}>
          Uji model gambar
        </Button>
      </div>
      {uji.isPending ? <p className="text-sm text-muted-foreground">Menguji model... (bisa sampai 1 menit)</p> : null}
      {hasilUji ? <HasilUji hasil={hasilUji.hasil} /> : null}
      <p className="text-xs text-muted-foreground">Uji memakai nilai yang sudah disimpan. Simpan dulu bila baru mengganti nama model.</p>
    </form>
  )
}

export function ModelAiCard() {
  const data = useModelAi()
  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Model AI untuk membaca dokumen</CardTitle>
        <CardDescription>
          Dokumen yang dibaca (surat tugas, invoice, tiket, struk) dikirim ke ollama.com bila memakai model cloud. Hasil bacaan selalu
          berupa usulan yang Anda setujui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.isError ? <Alert variant="destructive">{pesanGalat(data.error)}</Alert> : null}
        {data.isPending ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {data.data ? <FormModelAi awal={data.data} /> : null}
      </CardContent>
    </Card>
  )
}
