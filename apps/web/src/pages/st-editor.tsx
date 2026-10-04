import { useEffect, useMemo, useState } from 'react'
import { FileTextIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  SuratTugasPayloadSchema,
  hitungSpj,
  payloadDariDto,
  pelaksanaKosong,
  stKosong,
  toSpjInput,
  type PelaksanaPayload,
  type PengaturanPayload,
  type Sbm,
  type SuratTugasPayload,
  type UsulanHotelItem,
} from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { BuktiPanel } from '@/components/st/bukti-panel'
import { PelaksanaCard } from '@/components/st/pelaksana-card'
import { RingkasanPanel } from '@/components/st/ringkasan'
import { UsulanHotelPanel } from '@/components/st/usulan-hotel-panel'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { pesanGalat } from '@/lib/format'
import {
  useHapusSuratTugas,
  usePegawai,
  usePengaturan,
  useSbm,
  useSimpanSuratTugas,
  useSuratTugas,
  useVersiSbm,
} from '@/lib/queries'
import { pesanValidasi } from '@/lib/validasi'

function Editor({ id, awal, sbm, pengaturan }: { id: number | null; awal: SuratTugasPayload; sbm: Sbm; pengaturan: PengaturanPayload }) {
  const navigate = useNavigate()
  const pegawai = usePegawai(true)
  const simpan = useSimpanSuratTugas()
  const hapus = useHapusSuratTugas()
  const [st, setSt] = useState<SuratTugasPayload>(awal)
  const [baseline, setBaseline] = useState(() => JSON.stringify(awal))
  const [galat, setGalat] = useState<string[]>([])
  const [dialogHapus, setDialogHapus] = useState(false)
  const kotor = JSON.stringify(st) !== baseline

  useEffect(() => {
    if (!kotor) return
    const cegah = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', cegah)
    return () => window.removeEventListener('beforeunload', cegah)
  }, [kotor])

  const hasil = useMemo(() => hitungSpj(toSpjInput(st, pengaturan), sbm), [st, pengaturan, sbm])
  const provinsi = useMemo(() => Object.keys(sbm.uangHarian), [sbm])

  const ubahSt = (patch: Partial<SuratTugasPayload>) => setSt((s) => ({ ...s, ...patch }))
  const ubahPelaksana = (i: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) =>
    setSt((s) => ({ ...s, pelaksana: s.pelaksana.map((p, j) => (j === i ? fn(p) : p)) }))

  const terapkanUsulanHotel = (pIdx: number, eIdx: number, usulan: UsulanHotelItem) => {
    ubahPelaksana(pIdx, (p) => ({
      ...p,
      etape: p.etape.map((e, ei) => {
        if (ei !== eIdx) return e
        return {
          ...e,
          hotelNama: usulan.ekstraksi.namaHotel,
          hotelTarif: usulan.tarifRiilPerMalam,
          malamOverride: usulan.malam,
        }
      }),
    }))
  }

  async function kirim() {
    const cek = SuratTugasPayloadSchema.safeParse(st)
    if (!cek.success) {
      const pesan = pesanValidasi(cek.error.issues)
      setGalat(pesan)
      toast.error('Ada isian yang belum benar.')
      return
    }
    setGalat([])
    try {
      const dto = await simpan.mutateAsync({ id, payload: cek.data })
      setBaseline(JSON.stringify(st))
      toast.success('Surat tugas disimpan.')
      if (id === null) navigate(`/st/${dto.id}`, { replace: true })
    } catch (error) {
      setGalat([pesanGalat(error)])
    }
  }

  async function konfirmasiHapus() {
    if (id === null) return
    try {
      await hapus.mutateAsync(id)
      toast.success('Surat tugas dihapus.')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(pesanGalat(error))
      setDialogHapus(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={kotor ? 'Ada perubahan yang belum disimpan.' : id === null ? 'Isi data lalu simpan.' : 'Tersimpan.'}
        actions={
          <>
            {id !== null ? (
              <>
                <Button variant="ghost" onClick={() => setDialogHapus(true)}>
                  <Trash2Icon className="text-destructive" /> Hapus
                </Button>
                <Link
                  to={`/st/${id}/dokumen`}
                  className={buttonVariants({ variant: 'outline' })}
                  aria-disabled={kotor}
                  onClick={(e) => {
                    if (kotor) {
                      e.preventDefault()
                      toast.info('Simpan perubahan dulu sebelum membuka dokumen.')
                    }
                  }}
                >
                  <FileTextIcon className="size-4" /> Dokumen
                </Link>
              </>
            ) : null}
            <Button onClick={kirim} disabled={simpan.isPending || (!kotor && id !== null)}>
              <SaveIcon /> {simpan.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      />

      {galat.length > 0 ? (
        <Alert variant="destructive" className="mb-5">
          <p className="mb-1 font-medium">Belum bisa disimpan:</p>
          <ul className="list-inside list-disc">
            {galat.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Surat tugas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomor surat tugas" htmlFor="st-nomor" className="sm:col-span-2">
                <Input id="st-nomor" value={st.nomor} onChange={(e) => ubahSt({ nomor: e.target.value })} placeholder="ST.226/PPS/PEMPS/PSL.04.02/B/09/2026" />
              </Field>
              <Field label="Tanggal surat tugas" htmlFor="st-tanggal">
                <Input id="st-tanggal" type="date" value={st.tanggal} onChange={(e) => ubahSt({ tanggal: e.target.value })} />
              </Field>
              <Field label="Tanggal SPJ (tanggal dokumen)" htmlFor="st-spj" hint="Boleh kosong; dilengkapi saat dokumen dicetak.">
                <Input id="st-spj" type="date" value={st.tanggalSpj ?? ''} onChange={(e) => ubahSt({ tanggalSpj: e.target.value || null })} />
              </Field>
              <Field label="Kode akun (mata anggaran)" htmlFor="st-akun" className="sm:col-span-2">
                <Input id="st-akun" value={st.kodeAkun} onChange={(e) => ubahSt({ kodeAkun: e.target.value })} />
              </Field>
              <Field label="Catatan" htmlFor="st-catatan" className="sm:col-span-2">
                <Textarea id="st-catatan" rows={2} value={st.catatan} onChange={(e) => ubahSt({ catatan: e.target.value })} />
              </Field>
            </CardContent>
          </Card>

          {id !== null ? (
            <>
              <BuktiPanel stId={id} />
              <UsulanHotelPanel
                stId={id}
                pelaksanaList={st.pelaksana}
                onTerapkan={terapkanUsulanHotel}
              />
            </>
          ) : null}

          {st.pelaksana.map((p, i) => (
            <PelaksanaCard
              key={i}
              nomor={i + 1}
              p={p}
              hasil={hasil.pelaksana[i]}
              sbm={sbm}
              pegawai={pegawai.data ?? []}
              provinsi={provinsi}
              onUbah={(fn) => ubahPelaksana(i, fn)}
              onHapus={() => setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))}
            />
          ))}
          <div>
            <Button variant="outline" onClick={() => setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))}>
              <PlusIcon /> Tambah pelaksana
            </Button>
          </div>
        </div>
        <RingkasanPanel hasil={hasil} />
      </div>

      <Dialog open={dialogHapus} onOpenChange={setDialogHapus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus surat tugas?</DialogTitle>
            <DialogDescription>{st.nomor} beserta seluruh pelaksana, etape, dan biayanya akan dihapus permanen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogHapus(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={konfirmasiHapus} disabled={hapus.isPending}>
              {hapus.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Memuat data yang dibutuhkan lalu menampilkan editor; `key` memastikan state direset saat berpindah surat tugas. */
export default function StEditorPage() {
  const { id: idParam } = useParams()
  const id = idParam === undefined ? null : Number(idParam)
  const idValid = id === null || (Number.isInteger(id) && id > 0)
  const pengaturan = usePengaturan()
  const versi = useVersiSbm()
  const st = useSuratTugas(id ?? undefined)
  const versiId = id === null ? versi.data?.[0]?.id : st.data?.versiSbmId
  const sbm = useSbm(versiId)

  if (!idValid) return <Alert variant="destructive">Alamat surat tugas tidak valid.</Alert>
  const galat = pengaturan.error ?? versi.error ?? st.error ?? sbm.error
  if (galat) return <Alert variant="destructive">{pesanGalat(galat)}</Alert>
  if (!pengaturan.data || !sbm.data || (id !== null && !st.data)) {
    return <p className="text-sm text-muted-foreground">Memuat...</p>
  }
  const awal: SuratTugasPayload = st.data ? payloadDariDto(st.data) : stKosong(pengaturan.data.kodeAkunDefault)
  return <Editor key={id ?? 'baru'} id={id} awal={awal} sbm={sbm.data.data} pengaturan={pengaturan.data} />
}
