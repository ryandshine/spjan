import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, DownloadIcon, ImageIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { buatLaporanAwal, idGambarLaporan, susunLaporan, type FotoDokumentasi } from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { PdfPreview } from '@/components/pdf-preview'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { muatDataUri } from '@/lib/berkas-data-uri'
import { pesanGalat } from '@/lib/format'
import { useDaftarBerkas, useHasilSuratTugas, useLaporan } from '@/lib/queries'
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
  /** Judul kelompok di daftar dokumen (nama pelaksana); dokumen tanpa kelompok tampil di atas/bawah. */
  grup?: string
}

const FOTO_KOSONG: FotoDokumentasi[] = []

export default function DokumenPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const stIdValid = Number.isInteger(id) && id > 0 ? id : undefined
  const hasil = useHasilSuratTugas(stIdValid)
  const berkasQuery = useDaftarBerkas(stIdValid ?? null)
  const laporanQuery = useLaporan(stIdValid)

  // Hanya foto dokumentasi; gambar bukti biaya (kuitansi, tiket) tidak ikut lembar foto.
  const fotoFiles = useMemo(
    () => (berkasQuery.data ?? []).filter((b) => b.jenis === 'dokumentasi'),
    [berkasQuery.data],
  )
  const [termuat, setTermuat] = useState<{ untuk: typeof fotoFiles; data: FotoDokumentasi[] } | null>(null)
  // Hasil unduhan hanya berlaku untuk daftar berkas yang sama; selain itu dianggap belum siap (turunan, bukan setState di efek).
  const siap = termuat !== null && termuat.untuk === fotoFiles
  const fotoDokumentasi = siap ? termuat.data : FOTO_KOSONG
  const sedangMuatFoto = fotoFiles.length > 0 && !siap

  // Ambil data foto dokumentasi dan ubah ke data URI agar @react-pdf/renderer merender gambar secara mulus
  useEffect(() => {
    if (fotoFiles.length === 0) return

    let batal = false

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
        if (!batal) setTermuat({ untuk: fotoFiles, data: fotoArray })
      } catch {
        // Abaikan galat konversi gambar
      }
    })()

    return () => {
      batal = true
    }
  }, [fotoFiles])

  const d = useMemo(
    () => (hasil.data ? siapkanDokumen(hasil.data, fotoDokumentasi) : null),
    [hasil.data, fotoDokumentasi],
  )
  const modelLaporan = useMemo(
    () => (d ? susunLaporan(d.st, d.pengaturan, laporanQuery.data?.isi ?? buatLaporanAwal(), fotoDokumentasi) : null),
    [d, laporanQuery.data, fotoDokumentasi],
  )
  // Gambar yang disisipkan di teks laporan dimuat sebagai data URI sebelum PDF dirender.
  const idGambar = useMemo(() => (modelLaporan ? idGambarLaporan(modelLaporan) : []), [modelLaporan])
  const kunciGambar = idGambar.join(',')
  const [gambarTermuat, setGambarTermuat] = useState<{ kunci: string; data: Record<number, string> } | null>(null)
  useEffect(() => {
    if (idGambar.length === 0) return
    let batal = false
    ;(async () => {
      const data: Record<number, string> = {}
      await Promise.all(
        idGambar.map(async (id) => {
          try {
            data[id] = await muatDataUri(id)
          } catch {
            // Gambar yang gagal dimuat dilewati saat mencetak.
          }
        }),
      )
      if (!batal) setGambarTermuat({ kunci: kunciGambar, data })
    })()
    return () => {
      batal = true
    }
  }, [idGambar, kunciGambar])
  const gambarSiap = idGambar.length === 0 || gambarTermuat?.kunci === kunciGambar
  const gambarLaporan = gambarTermuat?.kunci === kunciGambar ? gambarTermuat.data : undefined
  const [kunci, setKunci] = useState('sptb')
  const blobTerakhir = useRef<Blob | null>(null)

  const pilihan: Pilihan[] = useMemo(() => {
    const daftar: Pilihan[] = [{ kunci: 'sptb', label: 'SPTB', jenis: 'sptb' }]
    d?.pelaksana.forEach((p, i) => {
      const nama = p.nama || `Pelaksana ${i + 1}`
      daftar.push({ kunci: `spd:${i}`, label: 'SPD', jenis: 'spd', indeks: i, grup: nama })
      daftar.push({ kunci: `rincian:${i}`, label: 'Rincian', jenis: 'rincian', indeks: i, grup: nama })
      daftar.push({ kunci: `kuitansi:${i}`, label: 'Kuitansi', jenis: 'kuitansi', indeks: i, grup: nama })
      if (p.pengeluaranRiil && p.pengeluaranRiil.length > 0) {
        daftar.push({ kunci: `dpr:${i}`, label: 'DPR', jenis: 'dpr', indeks: i, grup: nama })
      }
    })
    if (fotoDokumentasi.length > 0) {
      daftar.push({
        kunci: 'dokumentasi',
        label: `Bukti Dokumentasi (${fotoDokumentasi.length} foto)`,
        jenis: 'dokumentasi',
      })
    }
    daftar.push({ kunci: 'laporan', label: 'Laporan Perjalanan Dinas', jenis: 'laporan' })
    daftar.push({ kunci: 'semua', label: 'Semua dokumen (satu berkas)', jenis: 'semua' })
    return daftar
  }, [d, fotoDokumentasi])

  const terpilih = pilihan.find((p) => p.kunci === kunci) ?? pilihan[0]

  const dokumen = useMemo(
    () =>
      d && terpilih && !(terpilih.jenis === 'laporan' && !gambarSiap) ? (
        <SpjDocument d={d} jenis={terpilih.jenis} indeks={terpilih.indeks} laporan={modelLaporan ?? undefined} gambarLaporan={gambarLaporan} />
      ) : null,
    [d, terpilih, modelLaporan, gambarSiap, gambarLaporan],
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
    a.download = `${terpilih.jenis === 'laporan' ? 'Laporan' : 'SPJ'}-${d.st.nomor.replace(/[^A-Za-z0-9]+/g, '-')}-${terpilih.kunci.replace(':', '-')}.pdf`
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
        <nav className="grid gap-1" aria-label="Daftar dokumen">
          {pilihan.map((p, n) => (
            <Fragment key={p.kunci}>
            {p.grup && p.grup !== pilihan[n - 1]?.grup ? (
              <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground [overflow-wrap:anywhere] first:mt-0">
                {p.grup}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setKunci(p.kunci)}
              aria-current={terpilih?.kunci === p.kunci ? 'true' : undefined}
              className={cn(
                'flex items-center justify-between gap-2 rounded-r-md border-l-4 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                terpilih?.kunci === p.kunci ? 'border-primary bg-accent font-medium' : 'border-transparent',
              )}
            >
              <span className="flex items-center gap-1.5 [overflow-wrap:anywhere]">
                {p.jenis === 'dokumentasi' ? <ImageIcon className="size-3.5 text-sky-600" /> : null}
                {p.label}
              </span>
              {p.jenis !== 'sptb' && p.jenis !== 'semua' && p.indeks !== undefined && (d.pelaksana[p.indeks]?.peringatan.length ?? 0) > 0 ? (
                <Badge variant="warning">!</Badge>
              ) : null}
            </button>
            </Fragment>
          ))}
        </nav>
        <div className="h-[80vh] min-h-[500px]">
          {(sedangMuatFoto || (terpilih?.jenis === 'laporan' && !gambarSiap)) && !dokumen ? (
            <div className="flex h-full items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
              Menyiapkan foto dan gambar untuk dokumen...
            </div>
          ) : dokumen ? (
            <PdfPreview dokumen={dokumen} onSiap={simpanBlob} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
