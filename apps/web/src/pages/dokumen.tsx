import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, DownloadIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { PdfPreview } from '@/components/pdf-preview'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { pesanGalat } from '@/lib/format'
import { useHasilSuratTugas } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { siapkanDokumen } from '@/pdf/data'
import { daftarkanFont } from '@/pdf/fonts'
import { SpjDocument, type JenisDokumen } from '@/pdf/spj-document'

daftarkanFont(`${window.location.origin}/fonts`)

interface Pilihan {
  kunci: string
  label: string
  jenis: JenisDokumen
  indeks?: number
}

export default function DokumenPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const hasil = useHasilSuratTugas(Number.isInteger(id) && id > 0 ? id : undefined)
  const d = useMemo(() => (hasil.data ? siapkanDokumen(hasil.data) : null), [hasil.data])
  const [kunci, setKunci] = useState('sptb')
  const blobTerakhir = useRef<Blob | null>(null)

  const pilihan: Pilihan[] = useMemo(() => {
    const daftar: Pilihan[] = [{ kunci: 'sptb', label: 'SPTB', jenis: 'sptb' }]
    d?.pelaksana.forEach((p, i) => {
      const nama = p.nama || `Pelaksana ${i + 1}`
      daftar.push({ kunci: `rincian:${i}`, label: `Rincian - ${nama}`, jenis: 'rincian', indeks: i })
      daftar.push({ kunci: `kuitansi:${i}`, label: `Kuitansi - ${nama}`, jenis: 'kuitansi', indeks: i })
      if (p.pengeluaranRiil && p.pengeluaranRiil.length > 0) {
        daftar.push({ kunci: `dpr:${i}`, label: `DPR - ${nama}`, jenis: 'dpr', indeks: i })
      }
    })
    daftar.push({ kunci: 'semua', label: 'Semua dokumen (satu berkas)', jenis: 'semua' })
    return daftar
  }, [d])
  const terpilih = pilihan.find((p) => p.kunci === kunci) ?? pilihan[0]

  const dokumen = useMemo(
    () => (d && terpilih ? <SpjDocument d={d} jenis={terpilih.jenis} indeks={terpilih.indeks} /> : null),
    [d, terpilih],
  )
  const simpanBlob = useCallback((b: Blob) => {
    blobTerakhir.current = b
  }, [])

  function unduh() {
    const blob = blobTerakhir.current
    if (!blob || !d || !terpilih) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SPJ-${d.st.nomor.replace(/[^A-Za-z0-9]+/g, '-')}-${terpilih.kunci.replace(':', '-')}.pdf`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  if (hasil.isError) return <Alert variant="destructive">{pesanGalat(hasil.error)}</Alert>
  if (!d) return <p className="text-sm text-muted-foreground">Memuat...</p>

  const bermasalah = d.pelaksana.filter((p) => p.peringatan.length > 0)
  return (
    <div>
      <PageHeader
        title="Dokumen"
        description={d.st.nomor}
        actions={
          <>
            <Link to={`/st/${id}`} className={buttonVariants({ variant: 'outline' })}>
              <ArrowLeftIcon className="size-4" /> Kembali ke editor
            </Link>
            <Button onClick={unduh}>
              <DownloadIcon /> Unduh PDF
            </Button>
          </>
        }
      />
      {bermasalah.length > 0 ? (
        <Alert variant="warning" className="mb-4">
          <p className="mb-1 font-medium">Data belum lengkap. Dokumen tetap bisa dibuat, tetapi periksa dulu sebelum dicetak:</p>
          <ul className="list-inside list-disc">
            {bermasalah.map((p, i) => (
              <li key={i}>
                {p.nama}: {p.peringatan.map((w) => w.pesan).join(' ')}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {!d.st.tanggalSpj ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Tanggal dokumen otomatis menggunakan tanggal pembuatan ({d.teksTanggalDokumen}). Anda dapat mengubah Tanggal SPJ di{' '}
          <Link to={`/st/${id}`} className="text-primary hover:underline">
            editor surat tugas
          </Link>
          .
        </p>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="grid gap-1">
          {pilihan.map((p) => (
            <button
              key={p.kunci}
              type="button"
              onClick={() => setKunci(p.kunci)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                terpilih?.kunci === p.kunci ? 'border-primary bg-accent font-medium' : 'bg-card',
              )}
            >
              <span className="truncate">{p.label}</span>
              {p.jenis !== 'sptb' && p.jenis !== 'semua' && p.indeks !== undefined && (d.pelaksana[p.indeks]?.peringatan.length ?? 0) > 0 ? (
                <Badge variant="warning">!</Badge>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="h-[80vh] min-h-[500px]">{dokumen ? <PdfPreview dokumen={dokumen} onSiap={simpanBlob} /> : null}</div>
      </div>
    </div>
  )
}
