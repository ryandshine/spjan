import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
import { DialogKonfirmasiPassword } from '@/components/dialog-konfirmasi-password'
import { DialogKunciSt, DialogTinggalkanHalaman } from '@/components/st/dialog-editor-st'
import { FotoDokumentasiPanel } from '@/components/st/foto-dokumentasi-panel'
import { KartuDataSt } from '@/components/st/kartu-data-st'
import { KartuPejabatSt } from '@/components/st/kartu-pejabat-st'
import { DaftarPelaksanaSt } from '@/components/st/daftar-pelaksana-st'
import { KelompokIsian } from '@/components/st/kelompok-isian'
import { LangkahSt, type LangkahItem } from '@/components/st/langkah-st'
import { RingkasanRingkas, RingkasanSt } from '@/components/st/ringkasan-st'
import { TabPelaksanaSt } from '@/components/st/tab-pelaksana-st'
import { UsulanHotelPanel } from '@/components/st/usulan-hotel-panel'
import { UsulanTransportPanel } from '@/components/st/usulan-transport-panel'
import { ArrowLeftIcon, ArrowRightIcon, LockOpenIcon, SaveIcon } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { pesanGalat } from '@/lib/format'
import { cn } from '@/lib/utils'
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
  sesuaikanKodeAkun,
  tabBergalat,
  tambahBiayaKePelaksana,
  terapkanHotelKeEtape,
} from '@/lib/st-editor'
import { bagianUntukSasaran, lompatKeIsian, type BagianPelaksana } from '@/lib/periksa'
import { useSlotSidebar } from '@/lib/slot-sidebar'
import { usePenjagaPerubahan } from '@/lib/use-penjaga-perubahan'
import { pesanValidasi, petaGalat } from '@/lib/validasi'

type TabKunci = 'data' | 'pelaksana' | 'bukti' | 'laporan'
type SubBukti = 'bukti' | 'hotel' | 'transport' | 'foto'

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
  const slotSidebar = useSlotSidebar()
  const [pelaksanaAktif, setPelaksanaAktif] = useState(0)
  const [bagianPelaksana, setBagianPelaksana] = useState<BagianPelaksana>('perjalanan')
  const [subBukti, setSubBukti] = useState<SubBukti>('bukti')
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
  const pilihPelaksana = (i: number) => {
    setTab('pelaksana')
    setPelaksanaAktif(i)
  }
  const tambahPelaksana = () => {
    setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))
    setKunciPelaksana((k) => [...k, kunciPelaksanaBaru()])
    setPelaksanaAktif(st.pelaksana.length)
    setBagianPelaksana('perjalanan')
  }
  const hapusPelaksana = (i: number) => {
    setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))
    setKunciPelaksana((k) => k.filter((_, j) => j !== i))
    setPelaksanaAktif((a) => Math.max(0, i < a ? a - 1 : Math.min(a, st.pelaksana.length - 2)))
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
      const galatPelaksana = cek.error.issues.find((i) => i.path[0] === 'pelaksana' && typeof i.path[1] === 'number')
      if (galatPelaksana) {
        setPelaksanaAktif(Number(galatPelaksana.path[1]))
        setBagianPelaksana('perjalanan')
      }
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

  const adaPerlu = hasil.pelaksana.some((p) => p.peringatan.length > 0)
  const langkah: LangkahItem<TabKunci>[] = [
    { kunci: 'data', label: 'Data surat tugas', deskripsi: 'Identitas & anggaran', galat: galatTab.data },
    { kunci: 'pelaksana', label: 'Pelaksana', deskripsi: 'Personel, perjalanan, biaya', jumlah: st.pelaksana.length, galat: galatTab.pelaksana, perlu: adaPerlu },
  ]
  if (id !== null) langkah.push({ kunci: 'bukti', label: 'Bukti & usulan', deskripsi: 'Lampiran dan usulan biaya' }, { kunci: 'laporan', label: 'Laporan', deskripsi: 'Laporan perjalanan dinas' })

  const modeLaporan = tab === 'laporan' && id !== null
  const posisiLangkah = langkah.findIndex((l) => l.kunci === tab)
  const sebelumnya = langkah[posisiLangkah - 1]
  const berikutnya = langkah[posisiLangkah + 1]

  // Isian pelaksana ada di langkah Pelaksana: buka langkah, pelaksana, dan sub-tabnya dulu supaya elemen terlihat sebelum difokuskan.
  const perbaikiIsian = (sasaranId: string, nomorPelaksana: number) => {
    setTab('pelaksana')
    setPelaksanaAktif(nomorPelaksana - 1)
    setBagianPelaksana(bagianUntukSasaran(sasaranId))
    window.setTimeout(() => lompatKeIsian(sasaranId), 60)
  }

  let aksiHeader: ReactNode = null
  if (!modeLaporan) {
    aksiHeader = (
      <AksiHeaderSt
        id={id}
        kotor={kotor}
        menyimpan={simpan.isPending}
        dikunci={dikunci}
        bolehUbah={bolehUbah}
        onSimpan={kirim}
        onHapus={() => setDialogHapus(true)}
        onKunci={() => setDialogKunci('kunci')}
        onBukaKunci={() => setDialogKunci('buka')}
      />
    )
  } else if (kotor) {
    aksiHeader = <PeringatanBelumSimpan menyimpan={simpan.isPending} onSimpan={kirim} />
  }

  const itemSubBukti: TabItem<SubBukti>[] = [
    { kunci: 'bukti', label: 'Bukti' },
    { kunci: 'hotel', label: 'Usulan hotel' },
    { kunci: 'transport', label: 'Usulan transport' },
    { kunci: 'foto', label: 'Foto dokumentasi' },
  ]

  return (
    <div>
      <PageHeader
        lengket={!modeLaporan}
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={!bolehUbah ? `Hanya lihat: dibuat oleh ${pembuat ?? 'pengguna lain'}.` : dikunci ? 'Selesai dan terkunci. Buka kunci untuk mengubah.' : deskripsiHeader({ modeLaporan, kotor, baru: id === null })}
        actions={aksiHeader}
      />

      {!bolehUbah ? (
        <Alert className="mb-5">
          Surat tugas ini dibuat oleh {pembuat ?? 'pengguna lain'}. Anda tercantum sebagai pelaksana, jadi bisa melihat serta mengunduh dokumen dan berkasnya; perubahan hanya oleh pembuat atau admin.
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

      {/* Menu langkah (dan daftar pelaksana) ada di sidebar aplikasi; di layar sempit tanpa sidebar tampil sebagai baris tab di sini. */}
      {slotSidebar
        ? createPortal(
            <LangkahSt
              kolom
              item={langkah}
              aktif={tab}
              onPilih={setTab}
              idAwal="st-menu"
              label="Langkah surat tugas"
              anak={{
                pelaksana: (
                  <DaftarPelaksanaSt
                    pelaksana={st.pelaksana}
                    kunci={kunciPelaksana}
                    hasil={hasil.pelaksana}
                    peta={peta}
                    terkunci={terkunci}
                    aktif={pelaksanaAktif}
                    onPilih={pilihPelaksana}
                    onTambah={tambahPelaksana}
                  />
                ),
              }}
            />,
            slotSidebar,
          )
        : null}
      <div className="md:hidden">
        <LangkahSt item={langkah} aktif={tab} onPilih={setTab} idAwal="st" label="Langkah surat tugas" />
      </div>

      <div className={cn('grid items-start gap-6', !modeLaporan && 'xl:grid-cols-[minmax(0,1fr)_18rem]')}>
        <div className="min-w-0">
          {modeLaporan ? null : (
            <div className="xl:hidden">
              <RingkasanRingkas hasil={hasil} onPerbaiki={perbaikiIsian} />
            </div>
          )}

          <TabPanel idAwal="st" kunci="data" aktif={tab === 'data'}>
            <KelompokIsian terkunci={terkunci}>
              <div className="grid gap-6">
                <KartuDataSt st={st} peta={peta} pengaturan={pengaturan} onUbah={ubahSt} onUbahSumberDana={ubahSumberDana} />
                <KartuPejabatSt st={st} pengaturan={pengaturan} pegawai={daftarPegawai} onUbah={ubahSt} />
              </div>
            </KelompokIsian>
          </TabPanel>

          {id !== null ? (
            <>
              <TabPanel idAwal="st" kunci="bukti" aktif={tab === 'bukti'}>
                <Tabs gaya="segmen" item={itemSubBukti} aktif={subBukti} onPilih={setSubBukti} idAwal="st-bukti" label="Bagian bukti dan usulan" />
                <KelompokIsian terkunci={terkunci}>
                  <TabPanel idAwal="st-bukti" kunci="bukti" aktif={subBukti === 'bukti'}>
                    <BuktiPanel stId={id} />
                  </TabPanel>
                  <TabPanel idAwal="st-bukti" kunci="hotel" aktif={subBukti === 'hotel'}>
                    <UsulanHotelPanel stId={id} pelaksanaList={st.pelaksana} onTerapkan={terapkanUsulanHotel} />
                  </TabPanel>
                  <TabPanel idAwal="st-bukti" kunci="transport" aktif={subBukti === 'transport'}>
                    <UsulanTransportPanel stId={id} pelaksanaList={st.pelaksana} onTerapkan={terapkanUsulanTransport} />
                  </TabPanel>
                  <TabPanel idAwal="st-bukti" kunci="foto" aktif={subBukti === 'foto'}>
                    <FotoDokumentasiPanel stId={id} />
                  </TabPanel>
                </KelompokIsian>
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
              terkunci={terkunci}
              aktif={pelaksanaAktif}
              bagian={bagianPelaksana}
              onPilih={pilihPelaksana}
              onBagian={setBagianPelaksana}
              onUbah={ubahPelaksana}
              onHapus={hapusPelaksana}
              onTambah={tambahPelaksana}
            />
          </TabPanel>

          {/* Navigasi langkah menempel di bawah layar supaya selalu terjangkau di halaman panjang; di ponsel (header tidak lengket) Simpan ikut di sini. */}
          <div className="sticky bottom-0 z-10 mt-6 -mb-6 flex items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur">
            {sebelumnya ? (
              <Button variant="outline" onClick={() => setTab(sebelumnya.kunci)}>
                <ArrowLeftIcon /> Kembali
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {!modeLaporan && bolehUbah && !dikunci ? (
                <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 md:hidden" onClick={kirim} disabled={simpan.isPending || (!kotor && id !== null)}>
                  <SaveIcon /> {simpan.isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
              ) : null}
              {berikutnya && !modeLaporan ? (
                <Button onClick={() => setTab(berikutnya.kunci)}>
                  Lanjut<span className="hidden sm:inline"> ke {berikutnya.label}</span> <ArrowRightIcon />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {modeLaporan ? null : (
          <aside className="hidden xl:sticky xl:top-24 xl:block">
            <RingkasanSt hasil={hasil} status={{ dikunci, bolehUbah, kotor }} onPerbaiki={perbaikiIsian} />
          </aside>
        )}
      </div>

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
