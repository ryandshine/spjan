import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { AksiHeaderSt, PeringatanBelumSimpan } from '@/components/st/aksi-header-st'
import { BuktiPanel } from '@/components/st/bukti-panel'
import { DialogHapusSt, DialogNoSpd, DialogTinggalkanHalaman } from '@/components/st/dialog-editor-st'
import { FotoDokumentasiPanel } from '@/components/st/foto-dokumentasi-panel'
import { KartuDataSt } from '@/components/st/kartu-data-st'
import { KartuPejabatSt } from '@/components/st/kartu-pejabat-st'
import { PanelPeriksa } from '@/components/st/panel-periksa'
import { TabPelaksanaSt } from '@/components/st/tab-pelaksana-st'
import { UsulanHotelPanel } from '@/components/st/usulan-hotel-panel'
import { UsulanTransportPanel } from '@/components/st/usulan-transport-panel'
import { Alert } from '@/components/ui/alert'
import { LegendaIsian } from '@/components/ui/penanda-isian'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
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
import {
  bacaPolaNoSpd,
  cariNoSpdTerisi,
  isiNoSpdBerurutan,
  sesuaikanKodeAkun,
  sufiksNoSpd,
  tabBergalat,
  tambahBiayaKePelaksana,
  terapkanHotelKeEtape,
} from '@/lib/st-editor'
import { usePenjagaPerubahan } from '@/lib/use-penjaga-perubahan'
import { pesanValidasi, petaGalat } from '@/lib/validasi'

type TabKunci = 'data' | 'pelaksana' | 'bukti' | 'laporan'

/** Kunci stabil per kartu pelaksana agar state lokal kartu tidak bergeser ke kartu lain saat ada yang dihapus. */
let urutanKunciPelaksana = 0
const kunciPelaksanaBaru = () => `pelaksana-${(urutanKunciPelaksana += 1)}`

function deskripsiHeader({ modeLaporan, kotor, baru }: { modeLaporan: boolean; kotor: boolean; baru: boolean }): string {
  if (modeLaporan) return 'Laporan Perjalanan Dinas'
  if (kotor) return 'Ada perubahan yang belum disimpan.'
  return baru ? 'Isi data lalu simpan.' : 'Tersimpan.'
}

function Editor({ id, awal, sbm, pengaturan }: { id: number | null; awal: SuratTugasPayload; sbm: Sbm; pengaturan: PengaturanPayload }) {
  const navigate = useNavigate()
  const pegawai = usePegawai(true)
  const simpan = useSimpanSuratTugas()
  const hapus = useHapusSuratTugas()
  const [st, setSt] = useState<SuratTugasPayload>(awal)
  const [kunciPelaksana, setKunciPelaksana] = useState(() => awal.pelaksana.map(kunciPelaksanaBaru))
  const stTerserialisasi = useMemo(() => JSON.stringify(st), [st])
  const [baseline, setBaseline] = useState(stTerserialisasi)
  const [galat, setGalat] = useState<string[]>([])
  const [dialogHapus, setDialogHapus] = useState(false)
  const [cobaSimpan, setCobaSimpan] = useState(false)
  const [tab, setTab] = useState<TabKunci>(id !== null && awal.pelaksana.length > 0 ? 'pelaksana' : 'data')
  const [dialogSpd, setDialogSpd] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)
  const kotor = stTerserialisasi !== baseline
  const { blocker, izinkanNavigasi } = usePenjagaPerubahan(kotor)

  // Setelah percobaan simpan pertama yang gagal, validasi berjalan langsung: galat hilang sendiri begitu isiannya diperbaiki.
  const isuLive = useMemo(() => {
    if (!cobaSimpan) return []
    const r = SuratTugasPayloadSchema.safeParse(st)
    return r.success ? [] : r.error.issues
  }, [cobaSimpan, st])
  const peta = useMemo(() => petaGalat(isuLive), [isuLive])
  const pesanTampil = [...pesanValidasi(isuLive), ...galat]
  const galatTab = tabBergalat(peta)

  const hasil = useMemo(() => hitungSpj(toSpjInput(st, pengaturan), sbm), [st, pengaturan, sbm])
  const provinsi = useMemo(() => Object.keys(sbm.uangHarian), [sbm])
  const daftarPegawai = pegawai.data ?? []

  const tandaiTersimpan = (payload: SuratTugasPayload) => setBaseline(JSON.stringify(payload))
  const ubahSt = (patch: Partial<SuratTugasPayload>) => setSt((s) => ({ ...s, ...patch }))
  const ubahSumberDana = (sumberDana: SumberDana) => ubahSt({ sumberDana, kodeAkun: sesuaikanKodeAkun(st.kodeAkun || '', sumberDana) })

  const ubahPelaksana = (i: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) =>
    setSt((s) => ({ ...s, pelaksana: s.pelaksana.map((p, j) => (j === i ? fn(p) : p)) }))
  const tambahPelaksana = () => {
    setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))
    setKunciPelaksana((k) => [...k, kunciPelaksanaBaru()])
  }
  const hapusPelaksana = (i: number) => {
    setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))
    setKunciPelaksana((k) => k.filter((_, j) => j !== i))
  }

  /** Menerapkan usulan ke form lalu langsung menyimpannya; kegagalan simpan dilempar ke panel pemanggil untuk ditampilkan. */
  async function terapkanDanSimpan(stBaru: SuratTugasPayload) {
    setSt(stBaru)
    if (id === null) return
    await simpan.mutateAsync({ id, payload: stBaru })
    tandaiTersimpan(stBaru)
  }
  const terapkanUsulanHotel = (pelaksanaIdx: number, etapeIdx: number, usulan: UsulanHotelItem) =>
    terapkanDanSimpan(terapkanHotelKeEtape(st, pelaksanaIdx, etapeIdx, usulan))
  const terapkanUsulanTransport = (pelaksanaIdx: number, biaya: BiayaPayload) =>
    terapkanDanSimpan(tambahBiayaKePelaksana(st, pelaksanaIdx, biaya))

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
      tandaiTersimpan(st)
      toast.success('Surat tugas disimpan.')
      if (id === null) {
        izinkanNavigasi()
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
      izinkanNavigasi()
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(pesanGalat(error))
      setDialogHapus(false)
    }
  }

  const sufiksSpd = sufiksNoSpd(st.tahunAnggaran || pengaturan.tahunAnggaran || new Date().getFullYear())

  function terapkanNoSpd(angkaAwal: number, sufiks: string) {
    setSt((s) => isiNoSpdBerurutan(s, angkaAwal, sufiks))
    toast.success(`Nomor SPD berhasil diisi berurutan untuk ${st.pelaksana.length} pelaksana.`)
  }

  function autoIsiNoSpd() {
    if (st.pelaksana.length === 0) return
    const noSpdTerisi = cariNoSpdTerisi(st.pelaksana)
    if (!noSpdTerisi) {
      setDialogSpd(true)
      return
    }
    // Sudah ada nomor: lanjutkan polanya tanpa bertanya.
    const { angkaAwal, sufiks } = bacaPolaNoSpd(noSpdTerisi, sufiksSpd)
    terapkanNoSpd(angkaAwal, sufiks)
  }

  const itemTab: TabItem<TabKunci>[] = [
    { kunci: 'data', label: 'Data surat tugas', galat: galatTab.data },
    { kunci: 'pelaksana', label: 'Pelaksana', jumlah: st.pelaksana.length, galat: galatTab.pelaksana },
  ]
  if (id !== null) itemTab.push({ kunci: 'bukti', label: 'Bukti & usulan' }, { kunci: 'laporan', label: 'Laporan' })

  const modeLaporan = tab === 'laporan' && id !== null

  let aksiHeader: ReactNode = null
  if (!modeLaporan) {
    aksiHeader = (
      <AksiHeaderSt
        id={id}
        total={hasil.total}
        kotor={kotor}
        menyimpan={simpan.isPending}
        onSimpan={kirim}
        onHapus={() => setDialogHapus(true)}
      />
    )
  } else if (kotor) {
    aksiHeader = <PeringatanBelumSimpan menyimpan={simpan.isPending} onSimpan={kirim} />
  }

  return (
    <div>
      <PageHeader
        lengket={!modeLaporan}
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={deskripsiHeader({ modeLaporan, kotor, baru: id === null })}
        actions={aksiHeader}
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
              <KartuDataSt st={st} peta={peta} pengaturan={pengaturan} onUbah={ubahSt} onUbahSumberDana={ubahSumberDana} />
              <KartuPejabatSt st={st} pengaturan={pengaturan} pegawai={daftarPegawai} onUbah={ubahSt} />
            </div>
          </TabPanel>

          {id !== null ? (
            <>
              <TabPanel idAwal="st" kunci="bukti" aktif={tab === 'bukti'}>
                <div className="grid gap-6">
                  <BuktiPanel stId={id} />
                  <UsulanHotelPanel stId={id} pelaksanaList={st.pelaksana} onTerapkan={terapkanUsulanHotel} />
                  <UsulanTransportPanel stId={id} pelaksanaList={st.pelaksana} onTerapkan={terapkanUsulanTransport} />
                  <FotoDokumentasiPanel stId={id} />
                </div>
              </TabPanel>
              <TabPanel idAwal="st" kunci="laporan" aktif={tab === 'laporan'}>
                <LaporanEditor stId={id} />
              </TabPanel>
            </>
          ) : null}

          <TabPanel idAwal="st" kunci="pelaksana" aktif={tab === 'pelaksana'}>
            <TabPelaksanaSt
              pelaksana={st.pelaksana}
              kunci={kunciPelaksana}
              hasil={hasil.pelaksana}
              sbm={sbm}
              pegawai={daftarPegawai}
              provinsi={provinsi}
              provinsiKedudukan={pengaturan.provinsiKedudukan}
              peta={peta}
              onUbah={ubahPelaksana}
              onHapus={hapusPelaksana}
              onTambah={tambahPelaksana}
              onAutoIsiNoSpd={autoIsiNoSpd}
            />
          </TabPanel>
        </div>
        {modeLaporan ? null : (
          <div className="min-w-0">
            <PanelPeriksa hasil={hasil} />
          </div>
        )}
      </div>

      <DialogNoSpd
        buka={dialogSpd}
        onBukaChange={setDialogSpd}
        jumlahPelaksana={st.pelaksana.length}
        sufiks={sufiksSpd}
        onKonfirmasi={(angkaAwal) => terapkanNoSpd(angkaAwal, sufiksSpd)}
      />
      <DialogHapusSt buka={dialogHapus} onBukaChange={setDialogHapus} nomor={st.nomor} menghapus={hapus.isPending} onKonfirmasi={konfirmasiHapus} />
      <DialogTinggalkanHalaman blocker={blocker} />
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
