import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, DownloadIcon, ImageIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { FotoDokumentasi } from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { PdfPreview } from '@/components/pdf-preview'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { pesanGalat } from '@/lib/format'
import { useDaftarBerkas, useHasilSuratTugas } from '@/lib/queries'
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
  const stIdValid = Number.isInteger(id) && id > 0 ? id : undefined
  const hasil = useHasilSuratTugas(stIdValid)
  const berkasQuery = useDaftarBerkas(stIdValid ?? null)

  const [fotoDokumentasi, setFotoDokumentasi] = useState<FotoDokumentasi[]>([])
  const [sedangMuatFoto, setSedangMuatFoto] = useState(false)

  // Ambil data foto dokumentasi dan ubah ke data URI agar @react-pdf/renderer merender gambar secara mulus
  useEffect(() => {
    const list = berkasQuery.data
    if (!list || list.length === 0) {
      setFotoDokumentasi([])
      return
    }

    // Filter berkas gambar: utamakan jenis 'dokumentasi' atau gambar lainnya
    const fotoFiles = list.filter(
      (b) => b.jenis === 'dokumentasi' || (b.mime.startsWith('image/') && b.jenis !== 'st'),
    )

    if (fotoFiles.length === 0) {
      setFotoDokumentasi([])
      return
    }

    let batal = false
    setSedangMuatFoto(true)

    ;(async () => {
      try {
        const fotoArray: FotoDokumentasi[] = await Promise.all(
          fotoFiles.map(async (b) => {
            try {
              const res = await fetch(`/api/berkas/${b.id}/isi`, { credentials: 'same-origin' })
              const blob = await res.blob()
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
              })
              return {
                id: b.id,
                namaAsli: b.namaAsli,
                keterangan: b.keterangan || b.namaAsli,
                mime: b.mime,
                src: dataUrl,
                createdAt: b.createdAt,
              }
            } catch {
              // Fallback ke direct URL bila fetch data URI gagal
              return {
                id: b.id,
                namaAsli: b.namaAsli,
                keterangan: b.keterangan || b.namaAsli,
                mime: b.mime,
                src: `/api/berkas/${b.id}/isi`,
                createdAt: b.createdAt,
              }
            }
          }),
        )
        if (!batal) {
          setFotoDokumentasi(fotoArray)
        }
      } catch {
        // Abaikan galat konversi gambar
      } finally {
        if (!batal) setSedangMuatFoto(false)
      }
    })()

    return () => {
      batal = true
    }
  }, [berkasQuery.data])

  const d = useMemo(
    () => (hasil.data ? siapkanDokumen(hasil.data, fotoDokumentasi) : null),
    [hasil.data, fotoDokumentasi],
  )
  const [kunci, setKunci] = useState('sptb')
  const blobTerakhir = useRef<Blob | null>(null)

  const pilihan: Pilihan[] = useMemo(() => {
    const daftar: Pilihan[] = [{ kunci: 'sptb', label: 'SPTB', jenis: 'sptb' }]
    d?.pelaksana.forEach((p, i) => {
      const nama = p.nama || `Pelaksana ${i + 1}`
      daftar.push({ kunci: `spd:${i}`, label: `SPD - ${nama}`, jenis: 'spd', indeks: i })
      daftar.push({ kunci: `rincian:${i}`, label: `Rincian - ${nama}`, jenis: 'rincian', indeks: i })
      daftar.push({ kunci: `kuitansi:${i}`, label: `Kuitansi - ${nama}`, jenis: 'kuitansi', indeks: i })
      if (p.pengeluaranRiil && p.pengeluaranRiil.length > 0) {
        daftar.push({ kunci: `dpr:${i}`, label: `DPR - ${nama}`, jenis: 'dpr', indeks: i })
      }
    })
    if (fotoDokumentasi.length > 0) {
      daftar.push({
        kunci: 'dokumentasi',
        label: `Bukti Dokumentasi (${fotoDokumentasi.length} foto)`,
        jenis: 'dokumentasi',
      })
    }
    daftar.push({ kunci: 'semua', label: 'Semua dokumen (satu berkas)', jenis: 'semua' })
    return daftar
  }, [d, fotoDokumentasi])

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
            <Button onClick={unduh} disabled={sedangMuatFoto}>
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
              <span className="truncate flex items-center gap-1.5">
                {p.jenis === 'dokumentasi' ? <ImageIcon className="size-3.5 text-sky-600" /> : null}
                {p.label}
              </span>
              {p.jenis !== 'sptb' && p.jenis !== 'semua' && p.indeks !== undefined && (d.pelaksana[p.indeks]?.peringatan.length ?? 0) > 0 ? (
                <Badge variant="warning">!</Badge>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="h-[80vh] min-h-[500px]">
          {sedangMuatFoto && !dokumen ? (
            <div className="flex h-full items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
              Menyiapkan foto dokumentasi untuk dokumen...
            </div>
          ) : dokumen ? (
            <PdfPreview dokumen={dokumen} onSiap={simpanBlob} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
