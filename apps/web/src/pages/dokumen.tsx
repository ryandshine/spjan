import '../pdf/polyfill-buffer'
import type * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, DownloadIcon, ImageIcon, UserIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { buatLaporanAwal, idGambarLaporan, susunLaporan, type FotoDokumentasi } from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { PdfPreview } from '@/components/pdf-preview'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { keteranganFoto } from '@/lib/gambar'
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
}

/** Kelompok tombol bersambung (segmented control). */
function Segmen({ children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div role="group" className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border bg-card" {...props}>
      {children}
    </div>
  )
}

function ItemSegmen({ aktif, className, ...props }: { aktif: boolean } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 border-r px-3 text-sm transition-colors last:border-r-0 hover:bg-accent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        aktif ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
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
                keterangan: keteranganFoto(b),
                mime: b.mime,
                src: dataUrl,
                createdAt: b.createdAt,
              }
            } catch {
              // Fallback ke direct URL bila fetch data URI gagal
              return {
                id: b.id,
                namaAsli: b.namaAsli,
                keterangan: keteranganFoto(b),
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
  const [pelIdx, setPelIdx] = useState(0)
  const blobTerakhir = useRef<Blob | null>(null)

  const pilihan: Pilihan[] = useMemo(() => {
    const daftar: Pilihan[] = [{ kunci: 'sptb', label: 'SPTB', jenis: 'sptb' }]
    d?.pelaksana.forEach((p, i) => {
      daftar.push({ kunci: `spd:${i}`, label: 'SPD', jenis: 'spd', indeks: i })
      daftar.push({ kunci: `rincian:${i}`, label: 'Rincian', jenis: 'rincian', indeks: i })
      daftar.push({ kunci: `kuitansi:${i}`, label: 'Kuitansi', jenis: 'kuitansi', indeks: i })
      if (p.pengeluaranRiil && p.pengeluaranRiil.length > 0) {
        daftar.push({ kunci: `dpr:${i}`, label: 'DPR', jenis: 'dpr', indeks: i })
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

  // Pemilih pelaksana hanya muncul bila ada lebih dari satu; satu pelaksana sudah jelas dari isi dokumen.
  const banyakPelaksana = d.pelaksana.length > 1
  const idx = Math.min(pelIdx, Math.max(d.pelaksana.length - 1, 0))
  const umum = pilihan.filter((p) => p.indeks === undefined)
  const jenisPelaksana = pilihan.filter((p) => p.indeks === idx)
  function gantiPelaksana(baru: number) {
    setPelIdx(baru)
    const jenisSekarang = terpilih?.indeks !== undefined ? terpilih.jenis : 'spd'
    const tujuan = pilihan.find((p) => p.indeks === baru && p.jenis === jenisSekarang) ?? pilihan.find((p) => p.indeks === baru && p.jenis === 'spd')
    if (tujuan) setKunci(tujuan.kunci)
  }
  const bermasalah = d.pelaksana.filter((p) => p.peringatan.length > 0)
  return (
    <div>
      <PageHeader
        title="Dokumen"
        rapat
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
      <div className="grid gap-2">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-2" aria-label="Daftar dokumen">
          <Segmen aria-label="Dokumen umum">
            {umum.map((p) => (
              <ItemSegmen key={p.kunci} aktif={terpilih?.kunci === p.kunci} onClick={() => setKunci(p.kunci)}>
                {p.jenis === 'dokumentasi' ? <ImageIcon className="size-3.5 text-sky-600" aria-hidden /> : null}
                {p.label}
              </ItemSegmen>
            ))}
          </Segmen>
          {jenisPelaksana.length > 0 ? (
            <>
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {banyakPelaksana ? (
                  <div className="relative w-full sm:w-72">
                    <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Select
                      aria-label="Pelaksana"
                      className="pl-8"
                      value={idx}
                      onChange={(e) => gantiPelaksana(Number(e.target.value))}
                    >
                      {d.pelaksana.map((p, i) => (
                        <option key={i} value={i}>
                          {p.nama || `Pelaksana ${i + 1}`}
                          {p.peringatan.length > 0 ? ' (data belum lengkap)' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                <Segmen aria-label="Dokumen pelaksana">
                  {jenisPelaksana.map((p) => (
                    <ItemSegmen key={p.kunci} aktif={terpilih?.kunci === p.kunci} onClick={() => setKunci(p.kunci)}>
                      {p.label}
                    </ItemSegmen>
                  ))}
                </Segmen>
                {(d.pelaksana[idx]?.peringatan.length ?? 0) > 0 ? <Badge variant="warning">Data belum lengkap</Badge> : null}
              </div>
            </>
          ) : null}
        </nav>
        <div className="h-[calc(100vh-11.5rem)] min-h-[560px]">
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
