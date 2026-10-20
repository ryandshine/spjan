import { useRef, useState } from 'react'
import { Loader2Icon, MailOpenIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  tanggalIndonesia,
  terapkanUsulan,
  usulanDariUndangan,
  type BagianNaskahUsulan,
  type FieldUsulanUndangan,
  type UsulanIsian,
} from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pesanGalat } from '@/lib/format'
import { useEkstrakUndangan } from '@/lib/queries'
import { useSeretLepas } from '@/lib/use-seret-lepas'
import { cn } from '@/lib/utils'

interface Props {
  naskah: BagianNaskahUsulan
  onTerapkan: (patch: ReturnType<typeof terapkanUsulan>) => void
}

const BATAS_UKURAN = 10 * 1024 * 1024
const FIELD_TANGGAL: FieldUsulanUndangan[] = ['tanggalMulai', 'tanggalSelesai']

function tampil(field: FieldUsulanUndangan, nilai: string): string {
  if (nilai === '') return 'kosong'
  return FIELD_TANGGAL.includes(field) ? tanggalIndonesia(nilai) : nilai
}

export function IsiDariUndangan({ naskah, onTerapkan }: Props) {
  const mutation = useEkstrakUndangan()
  const inputRef = useRef<HTMLInputElement>(null)
  const [usulan, setUsulan] = useState<UsulanIsian[] | null>(null)
  const [terpilih, setTerpilih] = useState<Set<FieldUsulanUndangan>>(new Set())
  const [model, setModel] = useState<string | null>(null)

  async function proses(file: File | undefined) {
    if (!file || mutation.isPending) return
    if (file.size > BATAS_UKURAN) {
      toast.error('Ukuran berkas melebihi batas 10 MB.')
      return
    }
    try {
      const { hasil, model: m } = await mutation.mutateAsync(file)
      const u = usulanDariUndangan(naskah, hasil, new Date().toISOString().slice(0, 10))
      if (u.length === 0) {
        toast.info('Tidak ada isian baru yang dapat diusulkan dari dokumen ini.')
        return
      }
      setModel(m)
      setUsulan(u)
      setTerpilih(new Set(u.filter((x) => x.bawaanAtauKosong).map((x) => x.field)))
    } catch (err) {
      toast.error(pesanGalat(err))
    }
  }

  const { dragOver, props: dropProps } = useSeretLepas((files) => void proses(files[0]))

  function alih(field: FieldUsulanUndangan) {
    setTerpilih((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  function terapkan() {
    if (!usulan) return
    const dipilih = usulan.filter((u) => terpilih.has(u.field))
    const masihCocok = dipilih.filter((u) => u.nilaiLama === naskah[u.field])
    const adaDibuang = masihCocok.length < dipilih.length
    if (masihCocok.length > 0) {
      onTerapkan(terapkanUsulan(naskah, masihCocok))
      toast.success('Isian diterapkan. Periksa kembali sebelum menyimpan.')
    }
    if (adaDibuang) toast.info('Sebagian isian tidak diterapkan karena sudah Anda ubah.')
    setUsulan(null)
  }

  if (usulan) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usulan dari surat undangan</CardTitle>
          {model && <CardDescription className="text-xs">Dibaca dengan model {model}.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <ul className="space-y-2">
            {usulan.map((u) => (
              <li key={u.field} className="rounded-md border border-border bg-card p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={terpilih.has(u.field)}
                    onChange={() => alih(u.field)}
                  />
                  <span className="min-w-0 flex-1 space-y-1 text-sm">
                    <span className="block font-medium">{u.label}</span>
                    <span className="block break-words text-muted-foreground line-through">
                      {tampil(u.field, u.nilaiLama)}
                    </span>
                    <span className="block break-words">{tampil(u.field, u.nilaiBaru)}</span>
                    {!u.bawaanAtauKosong && (
                      <span className="block text-xs text-muted-foreground">akan menimpa isian Anda</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setUsulan(null)}>
              Batal
            </Button>
            <Button size="sm" disabled={terpilih.size === 0} onClick={terapkan}>
              Terapkan ({terpilih.size})
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div
          {...dropProps}
          className={cn(
            'flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-5 text-center',
            dragOver && 'border-primary bg-primary/5',
          )}
        >
          <MailOpenIcon className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Unggah surat undangan (PDF atau gambar, maks. 10 MB) untuk mengisi maksud, lokasi, dan tanggal.
          </p>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void proses(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => inputRef.current?.click()}>
            {mutation.isPending ? (
              <>
                <Loader2Icon className="animate-spin" /> Membaca dokumen…
              </>
            ) : (
              <>
                <UploadIcon /> Isi dari surat undangan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
