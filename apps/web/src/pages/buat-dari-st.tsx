import { useState, useRef } from 'react'
import {
  UploadCloudIcon,
  FileTextIcon,
  Loader2Icon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  RotateCcwIcon,
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { parseTanggal, selisihHari } from '@spjan/shared'
import { tanggalPendek, pesanGalat } from '@/lib/format'
import { api } from '@/lib/api'
import { useBerkas, useUsulanSt, useBuatStDariBerkas } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function hitungHari(berangkat: string, pulang: string): number {
  const a = parseTanggal(berangkat)
  const b = parseTanggal(pulang)
  if (!a || !b) return 0
  const selisih = selisihHari(a, b) + 1
  return selisih > 0 ? selisih : 0
}

export default function BuatDariStPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [berkasId, setBerkasId] = useState<number | null>(null)
  const [mengunggah, setMengunggah] = useState(false)
  const [pesanUnggah, setPesanUnggah] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const queryBerkas = useBerkas(berkasId)
  const berkas = queryBerkas.data
  const ekstraksiSelesai = berkas?.ekstraksi?.status === 'selesai' && berkas?.jenis === 'st'
  const queryUsulan = useUsulanSt(berkasId, ekstraksiSelesai)
  const usulan = queryUsulan.data?.usulan

  const buatSt = useBuatStDariBerkas()

  async function prosesFile(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Hanya dokumen PDF yang didukung.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran berkas melebihi batas 10 MB.')
      return
    }

    try {
      setMengunggah(true)
      setPesanUnggah(null)
      const res = await api.berkas.unggah(file)
      setBerkasId(res.berkas.id)
      if (res.duplikat) {
        toast.info('Berkas identik telah ada, menggunakan data berkas yang tersimpan.')
      } else {
        toast.success('Berkas berhasil diunggah. AI mulai memproses.')
      }
    } catch (err) {
      setPesanUnggah(pesanGalat(err))
      toast.error(pesanGalat(err))
    } finally {
      setMengunggah(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void prosesFile(file)
    }
  }

  async function tanganiBuatSt() {
    if (!berkasId || !usulan) return
    try {
      const hasil = await buatSt.mutateAsync({
        berkasId,
        payload: usulan.payload,
      })
      toast.success('Draf Surat Tugas berhasil dibuat!')
      navigate(`/st/${hasil.id}`)
    } catch (err) {
      toast.error(pesanGalat(err))
    }
  }

  function resetUnggahan() {
    setBerkasId(null)
    setPesanUnggah(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Kegiatan diambil dari etape pertama pelaksana pertama
  const maksudKegiatan = usulan?.payload.pelaksana[0]?.etape[0]?.kegiatan ?? ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buat dari Surat Tugas"
        description="Unggah PDF Surat Tugas (ST). AI akan mengekstrak personil, tanggal, dan tujuan perjalanan dinas ke dalam draf SPJ."
        actions={
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Kembali ke Daftar
          </Link>
        }
      />

      {pesanUnggah && <Alert variant="destructive">{pesanUnggah}</Alert>}

      {berkasId === null ? (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={mengunggah}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void prosesFile(file)
                }}
              />
              <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary">
                {mengunggah ? <Loader2Icon className="size-8 animate-spin" /> : <UploadCloudIcon className="size-8" />}
              </div>
              <h3 className="text-base font-semibold">
                {mengunggah ? 'Mengunggah dokumen...' : 'Pilih atau seret dokumen Surat Tugas (PDF)'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Format PDF standar Kementerian/Instansi pemerintah. Ukuran maksimal 10 MB.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-4" disabled={mengunggah}>
                {mengunggah ? 'Memproses...' : 'Pilih Berkas'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Status Pemrosesan Berkas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <FileTextIcon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{berkas?.namaAsli ?? 'Memuat berkas...'}</CardTitle>
                    <CardDescription className="text-xs">
                      {berkas ? formatUkuran(berkas.ukuran) : 'Menghubungkan ke server...'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={resetUnggahan}>
                    <RotateCcwIcon className="size-4" /> Ganti Berkas
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {queryBerkas.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2Icon className="size-4 animate-spin text-primary" /> Memuat status berkas...
                </div>
              )}

              {berkas && berkas.ekstraksi?.status === 'antre' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2Icon className="size-4 animate-spin text-primary" /> Berkas dalam antrean ekstraksi AI...
                </div>
              )}

              {berkas && berkas.ekstraksi?.status === 'berjalan' && (
                <div className="flex items-center gap-2 text-sm text-primary py-2">
                  <Loader2Icon className="size-4 animate-spin" /> AI sedang membaca dokumen dan mengekstrak rincian Surat Tugas...
                </div>
              )}

              {berkas && berkas.ekstraksi?.status === 'gagal' && (
                <Alert variant="destructive" className="mt-2">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Ekstraksi berkas gagal</p>
                      <p className="text-xs mt-0.5">{berkas.ekstraksi.galat ?? 'Terjadi kesalahan pada AI saat memproses berkas.'}</p>
                    </div>
                  </div>
                </Alert>
              )}

              {berkas && berkas.ekstraksi?.status === 'selesai' && berkas.jenis !== 'st' && (
                <Alert variant="warning" className="mt-2">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Berkas bukan Surat Tugas</p>
                      <p className="text-xs mt-0.5">
                        Dokumen ini terklasifikasi sebagai <strong>{berkas.jenis}</strong>. Fitur ini memerlukan berkas Surat Tugas (ST).
                      </p>
                    </div>
                  </div>
                </Alert>
              )}

              {berkas && berkas.ekstraksi?.status === 'selesai' && berkas.jenis === 'st' && queryUsulan.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2Icon className="size-4 animate-spin text-primary" /> Menyiapkan pratinjau usulan draf...
                </div>
              )}

              {queryUsulan.isError && (
                <Alert variant="destructive" className="mt-2">
                  {pesanGalat(queryUsulan.error)}
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Pratinjau Draf Usulan */}
          {usulan && (
            <div className="space-y-6">
              {usulan.peringatan.length > 0 && (
                <Alert variant="warning">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="size-4 shrink-0 mt-0.5 text-warning" />
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Catatan Pemetaan:</p>
                      <ul className="list-disc list-inside text-xs space-y-0.5">
                        {usulan.peringatan.map((p, idx) => (
                          <li key={idx}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Detail Penugasan */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informasi Surat Tugas</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-medium">Nomor Surat Tugas</span>
                    <p className="text-base font-semibold">{usulan.payload.nomor || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-medium">Tanggal Surat</span>
                    <p className="text-sm font-medium flex items-center gap-1.5 mt-0.5">
                      <CalendarIcon className="size-4 text-muted-foreground" />
                      {tanggalPendek(usulan.payload.tanggal)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-muted-foreground uppercase font-medium">Maksud / Kegiatan Penugasan</span>
                    <p className="text-sm mt-0.5 leading-relaxed bg-muted/30 p-3 rounded-lg border">
                      {maksudKegiatan || '-'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Daftar Pelaksana */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base">Daftar Pelaksana & Tujuan</CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {usulan.pelaksanaStatus.length} personil terdeteksi
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Nama & NIP</TableHead>
                        <TableHead>Status Master</TableHead>
                        <TableHead>Tujuan & Provinsi SBM</TableHead>
                        <TableHead>Jadwal Perjalanan</TableHead>
                        <TableHead className="text-right">Durasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usulan.pelaksanaStatus.map((ps, i) => {
                        const pelaksana = usulan.payload.pelaksana[i]
                        const etapeUtama = pelaksana?.etape[0]
                        const hari = etapeUtama ? hitungHari(etapeUtama.berangkat, etapeUtama.pulang) : 0

                        return (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{ps.nama}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {ps.nip ? `NIP ${ps.nip}` : 'Non-NIP / Belum ada NIP'}
                              </div>
                            </TableCell>
                            <TableCell>
                              {ps.baru ? (
                                <Badge variant="warning">Pegawai Baru</Badge>
                              ) : (
                                <Badge variant="success">Terdaftar</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {pelaksana?.etape.map((et, j) => (
                                <div key={j} className="text-xs flex flex-wrap items-center gap-1.5 py-0.5">
                                  <MapPinIcon className="size-3 text-muted-foreground shrink-0" />
                                  <span>{et.kota}</span>
                                  <span className="text-muted-foreground font-mono">({et.provinsi})</span>
                                  {et.dalamKota8Jam ? (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                      Dalam Kota &gt; 8 jam
                                    </Badge>
                                  ) : null}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell>
                              {pelaksana?.etape.map((et, j) => (
                                <div key={j} className="text-xs text-muted-foreground py-0.5">
                                  {tanggalPendek(et.berangkat)} s.d. {tanggalPendek(et.pulang)}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs">
                              {hari > 0 ? `${hari} hari` : '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Aksi Buat Draf */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs">
                <div className="text-xs text-muted-foreground">
                  Draf Surat Tugas akan dibuat dan berkas PDF akan ditautkan secara otomatis sebagai arsip.
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={resetUnggahan} disabled={buatSt.isPending}>
                    Batal
                  </Button>
                  <Button onClick={tanganiBuatSt} disabled={buatSt.isPending}>
                    {buatSt.isPending ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" /> Menyimpan Draf...
                      </>
                    ) : (
                      <>
                        <CheckCircle2Icon className="size-4" /> Buat Draf Surat Tugas <ArrowRightIcon className="size-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
