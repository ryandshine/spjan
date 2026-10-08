import { useEffect, useMemo, useRef, useState } from 'react'
import { FileTextIcon, PlusIcon, RotateCcwIcon, SaveIcon, SparklesIcon, Trash2Icon } from 'lucide-react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  SuratTugasPayloadSchema,
  hitungSpj,
  payloadDariDto,
  pelaksanaKosong,
  stKosong,
  toSpjInput,
  type BiayaPayload,
  type PelaksanaPayload,
  type PengaturanPayload,
  type Sbm,
  type SumberDana,
  type SuratTugasPayload,
  type UsulanHotelItem,
} from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { LaporanEditor } from '@/components/laporan/laporan-editor'
import { BuktiPanel } from '@/components/st/bukti-panel'
import { FotoDokumentasiPanel } from '@/components/st/foto-dokumentasi-panel'
import { PelaksanaCard } from '@/components/st/pelaksana-card'
import { PanelPeriksa } from '@/components/st/panel-periksa'
import { UsulanHotelPanel } from '@/components/st/usulan-hotel-panel'
import { UsulanTransportPanel } from '@/components/st/usulan-transport-panel'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputTanggal } from '@/components/ui/input-tanggal'
import { MenuAksi } from '@/components/ui/menu-aksi'
import { LegendaIsian } from '@/components/ui/penanda-isian'
import { Select } from '@/components/ui/select'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { pesanGalat, rupiah, tanggalPanjang } from '@/lib/format'
import {
  useHapusSuratTugas,
  usePegawai,
  usePengaturan,
  useSbm,
  useSimpanSuratTugas,
  useSuratTugas,
  useVersiSbm,
} from '@/lib/queries'
import { cakupanGalat, pesanValidasi, petaGalat } from '@/lib/validasi'

type TabKunci = 'data' | 'pelaksana' | 'bukti' | 'laporan'

function Editor({ id, awal, sbm, pengaturan }: { id: number | null; awal: SuratTugasPayload; sbm: Sbm; pengaturan: PengaturanPayload }) {
  const navigate = useNavigate()
  const pegawai = usePegawai(true)
  const simpan = useSimpanSuratTugas()
  const hapus = useHapusSuratTugas()
  const [st, setSt] = useState<SuratTugasPayload>(awal)
  const [baseline, setBaseline] = useState(() => JSON.stringify(awal))
  const [galat, setGalat] = useState<string[]>([])
  const [dialogHapus, setDialogHapus] = useState(false)
  const [bukaPj, setBukaPj] = useState(false)
  const [cobaSimpan, setCobaSimpan] = useState(false)
  const [tab, setTab] = useState<TabKunci>(id !== null && awal.pelaksana.length > 0 ? 'pelaksana' : 'data')
  const [dialogSpd, setDialogSpd] = useState(false)
  const [nomorAwalSpd, setNomorAwalSpd] = useState('401')
  const [galatSpd, setGalatSpd] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const lewati = useRef(false)
  const kotor = JSON.stringify(st) !== baseline

  // Setelah percobaan simpan pertama yang gagal, validasi berjalan langsung: galat hilang sendiri begitu isiannya diperbaiki.
  const isuLive = useMemo(() => {
    if (!cobaSimpan) return []
    const r = SuratTugasPayloadSchema.safeParse(st)
    return r.success ? [] : r.error.issues
  }, [cobaSimpan, st])
  const peta = useMemo(() => petaGalat(isuLive), [isuLive])
  const pesanTampil = [...pesanValidasi(isuLive), ...galat]
  const kunciGalat = Object.keys(peta)
  const galatTabData = kunciGalat.some((k) => !k.startsWith('pelaksana.'))
  const galatTabPelaksana = kunciGalat.some((k) => k.startsWith('pelaksana.'))

  // Mencegah kehilangan data saat berpindah halaman di dalam aplikasi (beforeunload hanya menangani reload/tutup tab).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => kotor && !lewati.current && currentLocation.pathname !== nextLocation.pathname,
  )

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
  const ubahSumberDana = (baru: SumberDana) => {
    let akun = st.kodeAkun || ''
    if (/\((RM|PNBP)\)/i.test(akun)) {
      akun = akun.replace(/\((RM|PNBP)\)/i, `(${baru})`)
    } else if (/\b(RM|PNBP)\b/i.test(akun)) {
      akun = akun.replace(/\b(RM|PNBP)\b/i, baru)
    } else if (akun.trim()) {
      akun = `${akun.trim()} (${baru})`
    }
    ubahSt({ sumberDana: baru, kodeAkun: akun })
  }
  const ubahPelaksana = (i: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) =>
    setSt((s) => ({ ...s, pelaksana: s.pelaksana.map((p, j) => (j === i ? fn(p) : p)) }))

  const terapkanUsulanHotel = async (pIdx: number, eIdx: number, usulan: UsulanHotelItem) => {
    const stBaru: SuratTugasPayload = {
      ...st,
      pelaksana: st.pelaksana.map((p, j) => {
        if (j !== pIdx) return p
        return {
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
        }
      }),
    }
    setSt(stBaru)
    if (id !== null) {
      await simpan.mutateAsync({ id, payload: stBaru })
      setBaseline(JSON.stringify(stBaru))
    }
  }

  const terapkanUsulanTransport = async (pIdx: number, biayaBaru: BiayaPayload) => {
    const stBaru: SuratTugasPayload = {
      ...st,
      pelaksana: st.pelaksana.map((p, j) =>
        j === pIdx ? { ...p, biaya: [...p.biaya, biayaBaru] } : p
      ),
    }
    setSt(stBaru)
    if (id !== null) {
      await simpan.mutateAsync({ id, payload: stBaru })
      setBaseline(JSON.stringify(stBaru))
    }
  }

  async function kirim() {
    const cek = SuratTugasPayloadSchema.safeParse(st)
    if (!cek.success) {
      setCobaSimpan(true)
      setGalat([])
      // Pindah ke tab yang berisi isian bermasalah, karena kolom merahnya tidak terlihat di tab lain.
      setTab(cek.error.issues.some((i) => i.path[0] !== 'pelaksana') ? 'data' : 'pelaksana')
      toast.error('Ada isian yang belum benar. Lihat kolom bertanda merah.')
      window.setTimeout(() => alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return
    }
    setCobaSimpan(false)
    setGalat([])
    try {
      const dto = await simpan.mutateAsync({ id, payload: cek.data })
      setBaseline(JSON.stringify(st))
      toast.success('Surat tugas disimpan.')
      if (id === null) {
        lewati.current = true
        navigate(`/st/${dto.id}`, { replace: true })
      }
    } catch (error) {
      setGalat([pesanGalat(error)])
    }
  }

  async function konfirmasiHapus() {
    if (id === null) return
    try {
      await hapus.mutateAsync(id)
      toast.success('Surat tugas dihapus.')
      lewati.current = true
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(pesanGalat(error))
      setDialogHapus(false)
    }
  }

  function terapkanNoSpd(angkaAwal: number, suffix: string) {
    setSt((s) => ({
      ...s,
      pelaksana: s.pelaksana.map((p, i) => ({
        ...p,
        noSpd: `${angkaAwal + i}${suffix}`,
        tanggalSpd: p.tanggalSpd || s.tanggal || null,
      })),
    }))
    toast.success(`Nomor SPD berhasil diisi berurutan untuk ${st.pelaksana.length} pelaksana.`)
  }

  const tahunSpd = st.tahunAnggaran || pengaturan.tahunAnggaran || new Date().getFullYear()

  function autoIsiNoSpd() {
    if (st.pelaksana.length === 0) return
    let suffix = `/SPD/PPS/${tahunSpd}`
    const yangAda = st.pelaksana.find((p) => p.noSpd?.trim())?.noSpd?.trim()
    if (yangAda) {
      // Sudah ada nomor: lanjutkan polanya tanpa bertanya.
      let angkaAwal = 401
      const match = yangAda.match(/^(\d+)(.*)$/)
      if (match) {
        angkaAwal = parseInt(match[1]!, 10)
        suffix = match[2] || suffix
      }
      terapkanNoSpd(angkaAwal, suffix)
      return
    }
    setGalatSpd(null)
    setDialogSpd(true)
  }

  function konfirmasiNoSpd() {
    const angka = parseInt(nomorAwalSpd.replace(/\D/g, ''), 10)
    if (!Number.isInteger(angka) || angka <= 0) {
      setGalatSpd('Isi dengan angka lebih dari 0, misalnya 401.')
      return
    }
    terapkanNoSpd(angka, `/SPD/PPS/${tahunSpd}`)
    setDialogSpd(false)
  }

  const itemTab: TabItem<TabKunci>[] = [
    { kunci: 'data', label: 'Data surat tugas', galat: galatTabData },
    { kunci: 'pelaksana', label: 'Pelaksana', jumlah: st.pelaksana.length, galat: galatTabPelaksana },
    ...(id !== null ? [{ kunci: 'bukti' as const, label: 'Bukti & usulan' }] : []),
    ...(id !== null ? [{ kunci: 'laporan' as const, label: 'Laporan' }] : []),
  ]

  const modeLaporan = tab === 'laporan' && id !== null

  return (
    <div>
      <PageHeader
        lengket={!modeLaporan}
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={
          modeLaporan
            ? 'Laporan Perjalanan Dinas'
            : kotor
              ? 'Ada perubahan yang belum disimpan.'
              : id === null
                ? 'Isi data lalu simpan.'
                : 'Tersimpan.'
        }
        actions={
          modeLaporan ? (
            kotor ? (
              <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-sm">
                Data surat tugas belum disimpan
                <Button size="sm" onClick={kirim} disabled={simpan.isPending}>
                  <SaveIcon /> {simpan.isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            ) : null
          ) : (
          <>
            <div className="mr-1 text-right leading-tight" aria-live="polite">
              <p className="text-xs text-muted-foreground">Total SPTB</p>
              <p className="text-base font-semibold tabular-nums">{rupiah(hasil.total)}</p>
            </div>
            {id !== null ? (
              <>
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
            {id !== null ? (
              <MenuAksi
                label="Atur surat tugas"
                item={[{ label: 'Hapus surat tugas', ikon: <Trash2Icon className="size-4" />, bahaya: true, onPilih: () => setDialogHapus(true) }]}
              />
            ) : null}
          </>
          )
        }
      />

      {pesanTampil.length > 0 ? (
        <div ref={alertRef}>
          <Alert variant="destructive" className="mb-5">
            <p className="mb-1 font-medium">Belum bisa disimpan. Perbaiki {pesanTampil.length} isian berikut (juga ditandai merah di kolomnya):</p>
            <ul className="list-inside list-disc">
              {pesanTampil.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}

      <Tabs item={itemTab} aktif={tab} onPilih={setTab} idAwal="st" label="Bagian surat tugas" />

      <div className={modeLaporan ? 'grid items-start gap-6' : 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'}>
        <div className="min-w-0">
          <TabPanel idAwal="st" kunci="data" aktif={tab === 'data'}>
            <div className="grid gap-6">
              <LegendaIsian />
              <Card>
                <CardHeader>
                  <CardTitle>Surat tugas</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 items-start">
                  <Field label="Nomor surat tugas" htmlFor="st-nomor" className="sm:col-span-2" error={peta.nomor} mode="wajib">
                    <Input id="st-nomor" value={st.nomor} onChange={(e) => ubahSt({ nomor: e.target.value })} placeholder="ST.226/PPS/PEMPS/PSL.04.02/B/09/2026" />
                  </Field>
                  <Field label="Tanggal surat tugas" htmlFor="st-tanggal" error={peta.tanggal} hint={tanggalPanjang(st.tanggal) || undefined} mode="wajib">
                    <InputTanggal id="st-tanggal" label="Tanggal surat tugas" nilai={st.tanggal} onUbah={(iso) => ubahSt({ tanggal: iso ?? '' })} />
                  </Field>
                  <Field
                    label="Tanggal SPJ (tanggal dokumen)"
                    htmlFor="st-spj"
                    mode="otomatis"
                    otomatisAktif={!st.tanggalSpj}
                    onKembaliOtomatis={() => ubahSt({ tanggalSpj: null })}
                    hint={tanggalPanjang(st.tanggalSpj) || 'Otomatis: tanggal saat dokumen dibuat. Isi hanya bila ada tanggal SPJ khusus.'}
                  >
                    <InputTanggal id="st-spj" label="Tanggal SPJ" nilai={st.tanggalSpj} onUbah={(iso) => ubahSt({ tanggalSpj: iso })} />
                  </Field>
                  <Field
                    label="Tahun anggaran"
                    htmlFor="st-tahun"
                    mode="otomatis"
                    otomatisAktif={st.tahunAnggaran == null}
                    onKembaliOtomatis={() => ubahSt({ tahunAnggaran: null })}
                    hint={`Otomatis: ${pengaturan.tahunAnggaran} (dari Pengaturan).`}
                  >
                    <Input
                      id="st-tahun"
                      type="number"
                      inputMode="numeric"
                      value={st.tahunAnggaran ?? ''}
                      placeholder={String(pengaturan.tahunAnggaran)}
                      onChange={(e) => {
                        const val = e.target.value.trim()
                        ubahSt({ tahunAnggaran: val === '' ? null : Number(val) })
                      }}
                    />
                  </Field>
                  <Field label="Sumber dana (mata anggaran)" htmlFor="st-sumber-dana" mode="wajib" hint="Memilih RM atau PNBP menyesuaikan kode akun otomatis.">
                    <div className="flex items-center gap-4 pt-1.5">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="sumberDana"
                          value="RM"
                          checked={(st.sumberDana ?? 'RM') === 'RM'}
                          onChange={() => ubahSumberDana('RM')}
                          className="text-primary focus:ring-primary size-4"
                        />
                        Rupiah Murni (RM)
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="sumberDana"
                          value="PNBP"
                          checked={st.sumberDana === 'PNBP'}
                          onChange={() => ubahSumberDana('PNBP')}
                          className="text-primary focus:ring-primary size-4"
                        />
                        PNBP
                      </label>
                    </div>
                  </Field>
                  <Field label="Kode akun (mata anggaran)" htmlFor="st-akun" className="sm:col-span-2" error={peta.kodeAkun} mode="wajib">
                    <Input id="st-akun" value={st.kodeAkun} onChange={(e) => ubahSt({ kodeAkun: e.target.value })} />
                  </Field>
                  <Field label="Catatan" htmlFor="st-catatan" className="sm:col-span-2" mode="opsional">
                    <Textarea id="st-catatan" rows={2} value={st.catatan} onChange={(e) => ubahSt({ catatan: e.target.value })} />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>Pejabat yang Bertanggung Jawab</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bukaPj ? (
                        <>
                          Penandatangan kuitansi: <em>&quot;Barang / pekerjaan tersebut telah diterima / diselesaikan dengan lengkap dan baik&quot;</em>
                        </>
                      ) : (
                        <>
                          Penandatangan: <strong>{st.pjNama || pengaturan.pjNama || 'Belum diatur'}</strong>
                          {st.pjNama || st.pjNip || st.pjJabatan ? '' : ' (bawaan dari Pengaturan)'}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {bukaPj && (st.pjNama || st.pjNip || st.pjJabatan) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ubahSt({ pjNama: null, pjNip: null, pjJabatan: null })}
                        title="Gunakan pejabat bawaan dari Pengaturan"
                      >
                        <RotateCcwIcon className="size-3.5 mr-1" /> Reset ke bawaan
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => setBukaPj(!bukaPj)} aria-expanded={bukaPj}>
                      {bukaPj ? 'Tutup' : 'Ubah'}
                    </Button>
                  </div>
                </CardHeader>
                {bukaPj ? (
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Pilih dari daftar pegawai"
                    htmlFor="pj-pegawai"
                    className="sm:col-span-2"
                    hint="Memilih pegawai akan otomatis mengisi nama, NIP, dan jabatan."
                  >
                    <Select
                      id="pj-pegawai"
                      value={
                        (pegawai.data ?? []).find(
                          (g) => g.nama === st.pjNama || (st.pjNip && (g.nip === st.pjNip || `NIP. ${g.nip}` === st.pjNip))
                        )?.id ?? ''
                      }
                      onChange={(e) => {
                        const dto = (pegawai.data ?? []).find((g) => g.id === Number(e.target.value))
                        if (dto) {
                          ubahSt({
                            pjNama: dto.nama,
                            pjNip: dto.nip ? (dto.nip.toUpperCase().startsWith('NIP') ? dto.nip : `NIP. ${dto.nip}`) : '',
                            pjJabatan: dto.jabatan || null,
                          })
                        }
                      }}
                    >
                      <option value="">
                        {st.pjNama || st.pjNip || st.pjJabatan
                          ? '- Pilih pegawai untuk mengganti -'
                          : `- Gunakan bawaan Pengaturan (${pengaturan.pjNama || 'Belum diatur'}) -`}
                      </option>
                      {(pegawai.data ?? []).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nama} {g.nip ? `(${g.nip})` : ''} {g.jabatan ? `- ${g.jabatan}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Nama pejabat" htmlFor="pj-nama">
                    <Input
                      id="pj-nama"
                      value={st.pjNama ?? ''}
                      placeholder={pengaturan.pjNama || 'Nama Pejabat'}
                      onChange={(e) => ubahSt({ pjNama: e.target.value || null })}
                    />
                  </Field>
                  <Field label="NIP pejabat" htmlFor="pj-nip">
                    <Input
                      id="pj-nip"
                      value={st.pjNip ?? ''}
                      placeholder={pengaturan.pjNip || 'NIP. ...'}
                      onChange={(e) => ubahSt({ pjNip: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Jabatan pejabat" htmlFor="pj-jabatan" className="sm:col-span-2">
                    <Input
                      id="pj-jabatan"
                      value={st.pjJabatan ?? ''}
                      placeholder={pengaturan.pjJabatan || 'Jabatan'}
                      onChange={(e) => ubahSt({ pjJabatan: e.target.value || null })}
                    />
                  </Field>
                </CardContent>
                ) : null}
              </Card>
            </div>
          </TabPanel>

          {id !== null ? (
            <TabPanel idAwal="st" kunci="bukti" aktif={tab === 'bukti'}>
              <div className="grid gap-6">
                <BuktiPanel stId={id} />
                <UsulanHotelPanel stId={id} pelaksanaList={st.pelaksana} onTerapkan={terapkanUsulanHotel} />
                <UsulanTransportPanel stId={id} pelaksanaList={st.pelaksana} onTerapkan={terapkanUsulanTransport} />
                <FotoDokumentasiPanel stId={id} />
              </div>
            </TabPanel>
          ) : null}

          {id !== null ? (
            <TabPanel idAwal="st" kunci="laporan" aktif={tab === 'laporan'}>
              <LaporanEditor stId={id} />
            </TabPanel>
          ) : null}

          <TabPanel idAwal="st" kunci="pelaksana" aktif={tab === 'pelaksana'}>
            <div className="grid gap-6">
              <LegendaIsian />
              {st.pelaksana.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada pelaksana. Klik &quot;Tambah pelaksana&quot; untuk memulai.
                </p>
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
                  provinsiKedudukan={pengaturan?.provinsiKedudukan}
                  galat={cakupanGalat(peta, `pelaksana.${i}`)}
                  onUbah={(fn) => ubahPelaksana(i, fn)}
                  onHapus={() => setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))}
                />
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))}>
                  <PlusIcon /> Tambah pelaksana
                </Button>
                {st.pelaksana.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={autoIsiNoSpd}
                    title="Isi nomor SPD secara otomatis dan berurutan untuk semua pelaksana"
                  >
                    <SparklesIcon className="size-4 mr-1 text-primary" /> Auto-isi No. SPD
                  </Button>
                ) : null}
              </div>
            </div>
          </TabPanel>
        </div>
        {modeLaporan ? null : (
          <div className="min-w-0">
            <PanelPeriksa hasil={hasil} />
          </div>
        )}
      </div>

      <Dialog open={dialogSpd} onOpenChange={setDialogSpd}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              konfirmasiNoSpd()
            }}
          >
            <DialogHeader>
              <DialogTitle>Auto-isi nomor SPD</DialogTitle>
              <DialogDescription>
                Nomor diisi berurutan untuk {st.pelaksana.length} pelaksana, contoh: {nomorAwalSpd || '401'}/SPD/PPS/{tahunSpd}.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4">
              <Field label="Nomor urut awal" htmlFor="spd-awal" error={galatSpd ?? undefined}>
                <Input id="spd-awal" inputMode="numeric" autoFocus value={nomorAwalSpd} onChange={(e) => setNomorAwalSpd(e.target.value)} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogSpd(false)}>
                Batal
              </Button>
              <Button type="submit">Isi nomor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogHapus} onOpenChange={setDialogHapus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus surat tugas?</DialogTitle>
            <DialogDescription>{st.nomor} beserta seluruh pelaksana, tujuan perjalanan, dan biayanya akan dihapus permanen.</DialogDescription>
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

      <Dialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tinggalkan halaman ini?</DialogTitle>
            <DialogDescription>Ada perubahan yang belum disimpan. Jika Anda keluar sekarang, perubahan tersebut akan hilang.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => blocker.state === 'blocked' && blocker.reset()}>
              Tetap di sini
            </Button>
            <Button variant="destructive" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
              Keluar tanpa menyimpan
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
  const awal: SuratTugasPayload = st.data
    ? payloadDariDto(st.data)
    : stKosong(pengaturan.data.kodeAkunDefault, pengaturan.data.tahunAnggaran)
  return <Editor key={id ?? 'baru'} id={id} awal={awal} sbm={sbm.data.data} pengaturan={pengaturan.data} />
}
