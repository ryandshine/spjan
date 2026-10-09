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
import { BannerPeriksa } from '@/components/st/banner-periksa'
import { BarBawahSt } from '@/components/st/bar-bawah-st'
import { BuktiPanel } from '@/components/st/bukti-panel'
import { DialogKonfirmasiPassword } from '@/components/dialog-konfirmasi-password'
import { DialogKunciSt, DialogNoSpd, DialogTinggalkanHalaman } from '@/components/st/dialog-editor-st'
import { FotoDokumentasiPanel } from '@/components/st/foto-dokumentasi-panel'
import { KartuDataSt } from '@/components/st/kartu-data-st'
import { KartuPejabatSt } from '@/components/st/kartu-pejabat-st'
import { TabPelaksanaSt } from '@/components/st/tab-pelaksana-st'
import { UsulanHotelPanel } from '@/components/st/usulan-hotel-panel'
import { UsulanTransportPanel } from '@/components/st/usulan-transport-panel'
import { LockOpenIcon } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { pesanGalat } from '@/lib/format'
import {
  useHapusSuratTugas,
  useKunciSuratTugas,
  useMe,
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
import { lompatKeIsian } from '@/lib/periksa'
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

function Editor({
  id,
  awal,
  sbm,
  pengaturan,
  dikunci,
  bolehUbah,
  pembuat,
}: {
  id: number | null
  awal: SuratTugasPayload
  sbm: Sbm
  pengaturan: PengaturanPayload
  /** Status final dari server: seluruh isian dikunci sampai kunci dibuka. */
  dikunci: boolean
  /** Admin atau pembuat surat tugas; selain itu hanya boleh melihat. */
  bolehUbah: boolean
  pembuat: string | null
}) {
  const terkunci = dikunci || !bolehUbah
  const navigate = useNavigate()
  const pegawai = usePegawai(true)
  const simpan = useSimpanSuratTugas()
  const hapus = useHapusSuratTugas()
  const kunciSt = useKunciSuratTugas()
  const [dialogKunci, setDialogKunci] = useState<'kunci' | 'buka' | null>(null)
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

  async function konfirmasiHapus(password: string) {
    if (id === null) return
    await hapus.mutateAsync({ id, password })
    toast.success('Surat tugas dipindah ke tempat sampah.')
    izinkanNavigasi()
    navigate('/', { replace: true })
  }

  async function kunciSekarang() {
    if (id === null) return
    try {
      await kunciSt.mutateAsync({ id, kunci: true })
      toast.success('Surat tugas ditandai selesai dan dikunci.')
    } catch (error) {
      toast.error(pesanGalat(error))
    }
    setDialogKunci(null)
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

  // Isian pelaksana ada di tab Pelaksana: buka tabnya dulu supaya elemen terlihat sebelum difokuskan.
  const perbaikiIsian = (sasaranId: string, nomorPelaksana: number) => {
    setTab('pelaksana')
    window.setTimeout(() => lompatKeIsian(sasaranId, nomorPelaksana), 60)
  }

  let aksiHeader: ReactNode = null
  if (!modeLaporan) {
    if (id !== null && bolehUbah) {
      aksiHeader = (
        <AksiHeaderSt
          terkunci={dikunci}
          bisaKunci={!kotor}
          onHapus={() => setDialogHapus(true)}
          onKunci={() => setDialogKunci('kunci')}
          onBukaKunci={() => setDialogKunci('buka')}
        />
      )
    }
  } else if (kotor) {
    aksiHeader = <PeringatanBelumSimpan menyimpan={simpan.isPending} onSimpan={kirim} />
  }

  return (
    <div className={modeLaporan ? undefined : 'pb-32'}>
      <PageHeader
        lengket={!modeLaporan}
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={!bolehUbah ? `Hanya lihat: dibuat oleh ${pembuat ?? 'pengguna lain'}.` : dikunci ? 'Selesai dan terkunci. Buka kunci untuk mengubah.' : deskripsiHeader({ modeLaporan, kotor, baru: id === null })}
        actions={aksiHeader}
      />

      {!bolehUbah ? (
        <Alert className="mb-5">
          Surat tugas ini dibuat oleh {pembuat ?? 'pengguna lain'}. Anda hanya bisa melihat dan mencetak dokumennya; perubahan hanya oleh pembuat atau admin.
        </Alert>
      ) : dikunci ? (
        <Alert className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <span>Surat tugas ini sudah ditandai selesai dan terkunci, jadi data, bukti, dan laporan tidak bisa diubah. Dokumen tetap bisa dicetak.</span>
          <Button size="sm" variant="outline" onClick={() => setDialogKunci('buka')}>
            <LockOpenIcon /> Buka kunci
          </Button>
        </Alert>
      ) : null}

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

      {modeLaporan ? null : <BannerPeriksa hasil={hasil} onPerbaiki={perbaikiIsian} />}

      <Tabs item={itemTab} aktif={tab} onPilih={setTab} idAwal="st" label="Bagian surat tugas" />

      <fieldset disabled={terkunci} className={`m-0 border-0 p-0 ${modeLaporan ? 'min-w-0' : 'min-w-0 max-w-6xl'}`}>
        <TabPanel idAwal="st" kunci="data" aktif={tab === 'data'}>
          <div className="grid gap-6">
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
              <LaporanEditor stId={id} terkunci={terkunci} />
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
      </fieldset>

      {modeLaporan ? null : (
        <BarBawahSt
          id={id} hasil={hasil} kotor={kotor} menyimpan={simpan.isPending} onSimpan={kirim}
          terkunci={terkunci}
          bisaBukaKunci={dikunci && bolehUbah}
          bisaKunci={bolehUbah}
          onPerbaiki={perbaikiIsian}
          onKunci={() => setDialogKunci('kunci')}
          onBukaKunci={() => setDialogKunci('buka')}
        />
      )}

      <DialogNoSpd
        buka={dialogSpd}
        onBukaChange={setDialogSpd}
        jumlahPelaksana={st.pelaksana.length}
        sufiks={sufiksSpd}
        onKonfirmasi={(angkaAwal) => terapkanNoSpd(angkaAwal, sufiksSpd)}
      />
      <DialogKunciSt
        buka={dialogKunci === 'kunci'}
        onBukaChange={(b) => !b && setDialogKunci(null)}
        kunci
        nomor={st.nomor}
        memproses={kunciSt.isPending}
        onKonfirmasi={() => void kunciSekarang()}
      />
      <DialogKonfirmasiPassword
        buka={dialogKunci === 'buka'}
        onBukaChange={(b) => !b && setDialogKunci(null)}
        judul="Buka kunci surat tugas?"
        deskripsi={`${st.nomor} akan bisa diubah lagi. Pembukaan kunci dicatat di log audit beserta alasannya.`}
        labelAksi="Buka kunci"
        perluAlasan
        onKonfirmasi={async ({ password, alasan }) => {
          if (id === null) return
          await kunciSt.mutateAsync({ id, kunci: false, password, alasan })
          toast.success('Kunci dibuka. Surat tugas bisa diubah lagi.')
        }}
      />
      <DialogKonfirmasiPassword
        buka={dialogHapus}
        onBukaChange={setDialogHapus}
        judul="Hapus surat tugas?"
        deskripsi={`${st.nomor} beserta pelaksana, tujuan, biaya, dan berkasnya dipindah ke tempat sampah. Admin masih bisa memulihkannya.`}
        labelAksi="Hapus"
        bahaya
        onKonfirmasi={({ password }) => konfirmasiHapus(password)}
      />
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
  const me = useMe()

  if (!idValid) return <Alert variant="destructive">Alamat surat tugas tidak valid.</Alert>
  const galat = pengaturan.error ?? versi.error ?? st.error ?? sbm.error
  if (galat) return <Alert variant="destructive">{pesanGalat(galat)}</Alert>
  if (!pengaturan.data || !sbm.data || !me.data || (id !== null && !st.data)) {
    return <p className="text-sm text-muted-foreground">Memuat...</p>
  }
  const awal: SuratTugasPayload = st.data
    ? payloadDariDto(st.data)
    : stKosong(pengaturan.data.kodeAkunDefault, pengaturan.data.tahunAnggaran)
  return <Editor key={id ?? 'baru'} id={id} awal={awal} sbm={sbm.data.data} pengaturan={pengaturan.data} dikunci={st.data?.status === 'final'}
      bolehUbah={id === null || me.data?.peran === 'admin' || st.data?.dibuatOleh === me.data?.id}
      pembuat={st.data?.dibuatOlehNama ?? null}
    />
}
