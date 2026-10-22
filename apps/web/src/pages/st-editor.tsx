import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FileTextIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  SuratTugasPayloadSchema,
  hitungSpj,
  payloadDariDto,
  stKosong,
  toSpjInput,
  type BiayaPayload,
  type PengaturanPayload,
  type Sbm,
  type SumberDana,
  type SuratTugasPayload,
  type UsulanHotelItem,
} from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { LaporanEditor } from '@/components/laporan/laporan-editor'
import { AksiHeaderSt, PeringatanBelumSimpan } from '@/components/st/aksi-header-st'
import { BannerGalatSimpan, BannerStatusSt } from '@/components/st/banner-st'
import { BuktiPanel } from '@/components/st/bukti-panel'
import { DialogKonfirmasiPassword } from '@/components/dialog-konfirmasi-password'
import { DialogKunciSt, DialogTinggalkanHalaman } from '@/components/st/dialog-editor-st'
import { FotoDokumentasiPanel } from '@/components/st/foto-dokumentasi-panel'
import { KartuDataSt } from '@/components/st/kartu-data-st'
import { KartuPejabatSt } from '@/components/st/kartu-pejabat-st'
import { DaftarPelaksanaSt } from '@/components/st/daftar-pelaksana-st'
import { KelompokIsian } from '@/components/st/kelompok-isian'
import { LangkahSt, type LangkahItem } from '@/components/st/langkah-st'
import { NavigasiLangkah, type NavigasiAksi } from '@/components/st/navigasi-langkah'
import { RingkasanRingkas, RingkasanSt } from '@/components/st/ringkasan-st'
import { TabPelaksanaSt } from '@/components/st/tab-pelaksana-st'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { pesanGalat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { hitungProgresSpj } from '@/lib/progres-spj'
import {
  useDaftarBerkas,
  useHapusSuratTugas,
  useKunciSuratTugas,
  useLaporan,
  useMe,
  usePegawai,
  usePengaturan,
  useSbm,
  useSimpanSuratTugas,
  useSuratTugas,
  useUpdateUsulanBerkas,
  useUsulanHotelSt,
  useUsulanTransportSt,
  useVersiSbm,
} from '@/lib/queries'
import {
  sesuaikanKodeAkun,
  sinkronkanSemuaUsulanOtomatis,
  tabBergalat,
  tambahBiayaKePelaksana,
  terapkanHotelKeEtape,
} from '@/lib/st-editor'
import { bagianUntukSasaran, lompatKeIsian } from '@/lib/periksa'
import { useSlotSidebar } from '@/lib/slot-sidebar'
import { useDaftarPelaksana } from '@/lib/use-daftar-pelaksana'
import { usePenjagaPerubahan } from '@/lib/use-penjaga-perubahan'
import { pesanValidasi, petaGalat } from '@/lib/validasi'

type TabKunci = 'data' | 'bukti' | 'pelaksana' | 'laporan'
type SubBukti = 'bukti' | 'foto'

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
  const stTerserialisasi = useMemo(() => JSON.stringify(st), [st])
  const [baseline, setBaseline] = useState(stTerserialisasi)
  const [galat, setGalat] = useState<string[]>([])
  const [dialogHapus, setDialogHapus] = useState(false)
  const [cobaSimpan, setCobaSimpan] = useState(false)
  const [searchParams] = useSearchParams()
  const tabAwal = searchParams.get('tab') as TabKunci | null
  const [tab, setTab] = useState<TabKunci>(tabAwal ?? 'data')
  const daftarBerkas = useDaftarBerkas(id)
  const laporanQuery = useLaporan(id ?? undefined)
  const slotSidebar = useSlotSidebar()
  const daftarPelaksana = useDaftarPelaksana(setSt, awal.pelaksana, st.pelaksana.length)
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

  const pilihPelaksana = (i: number) => {
    setTab('pelaksana')
    daftarPelaksana.setAktif(i)
  }

  async function terapkanUsulanHotel(pelaksanaIdx: number, etapeIdx: number, usulan: UsulanHotelItem) {
    const stBaru = terapkanHotelKeEtape(st, pelaksanaIdx, etapeIdx, usulan)
    setSt(stBaru)
    if (id !== null) {
      await simpan.mutateAsync({ id, payload: stBaru })
      tandaiTersimpan(stBaru)
    }
  }

  async function terapkanUsulanTransport(pelaksanaIdx: number, biaya: BiayaPayload) {
    const stBaru = tambahBiayaKePelaksana(st, pelaksanaIdx, biaya)
    setSt(stBaru)
    if (id !== null) {
      await simpan.mutateAsync({ id, payload: stBaru })
      tandaiTersimpan(stBaru)
    }
  }

  const { data: usulanHotelList } = useUsulanHotelSt(id)
  const { data: usulanTransportList } = useUsulanTransportSt(id)
  const updateUsulan = useUpdateUsulanBerkas()
  const sedangSinkronRef = useRef<Set<number>>(new Set())

  // Sinkronisasi otomatis (Auto-Fill): saat berkas tiket & hotel selesai dibaca OCR
  // dan cocok dengan nama pelaksana di ST, langsung masukkan ke formulir rincian pelaksana.
  useEffect(() => {
    if (id === null || !usulanHotelList || !usulanTransportList) return

    const hotelMenunggu = usulanHotelList.filter(
      (h) => h.usulanStatus === 'menunggu' && h.pelaksanaIndex >= 0 && !sedangSinkronRef.current.has(h.berkasId),
    )
    const transportMenunggu = usulanTransportList.filter(
      (t) => t.usulanStatus === 'menunggu' && t.pelaksanaIndex >= 0 && !sedangSinkronRef.current.has(t.berkasId),
    )

    if (hotelMenunggu.length === 0 && transportMenunggu.length === 0) return

    for (const h of hotelMenunggu) sedangSinkronRef.current.add(h.berkasId)
    for (const t of transportMenunggu) sedangSinkronRef.current.add(t.berkasId)

    void (async () => {
      try {
        const { stBaru, hotelBerkasIds, transportBerkasIds } = sinkronkanSemuaUsulanOtomatis(
          st,
          hotelMenunggu,
          transportMenunggu,
        )

        const totalDiterapkan = hotelBerkasIds.length + transportBerkasIds.length
        if (totalDiterapkan === 0) return

        setSt(stBaru)
        await simpan.mutateAsync({ id, payload: stBaru })
        tandaiTersimpan(stBaru)

        for (const bId of [...hotelBerkasIds, ...transportBerkasIds]) {
          await updateUsulan.mutateAsync({
            id: bId,
            payload: { usulanStatus: 'diterapkan' },
          })
        }

        toast.success(`${totalDiterapkan} bukti pengeluaran otomatis dimasukkan ke rincian pelaksana.`)
      } catch (err) {
        console.error('Gagal sinkronisasi otomatis berkas:', err)
      }
    })()
  }, [id, usulanHotelList, usulanTransportList, st, simpan, updateUsulan])

  async function kirim() {
    const cek = SuratTugasPayloadSchema.safeParse(st)
    if (!cek.success) {
      setCobaSimpan(true)
      setGalat([])
      // Pindah ke tab yang berisi isian bermasalah, karena kolom merahnya tidak terlihat di tab lain.
      setTab(cek.error.issues.some((i) => i.path[0] !== 'pelaksana') ? 'data' : 'pelaksana')
      const galatPelaksana = cek.error.issues.find((i) => i.path[0] === 'pelaksana' && typeof i.path[1] === 'number')
      if (galatPelaksana) {
        daftarPelaksana.setAktif(Number(galatPelaksana.path[1]))
        daftarPelaksana.setBagian('perjalanan')
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

  const progres = useMemo(
    () => hitungProgresSpj(st, hasil, daftarBerkas.data ?? [], !!laporanQuery.data?.isi),
    [st, hasil, daftarBerkas.data, laporanQuery.data?.isi],
  )

  const adaPerlu = hasil.pelaksana.some((p) => p.peringatan.length > 0)
  const langkah: LangkahItem<TabKunci>[] = [
    {
      kunci: 'data',
      label: 'Data surat tugas',
      deskripsi: 'Identitas & anggaran',
      galat: galatTab.data,
      jumlahPerlu: progres.perTahap.data.peringatan,
    },
    {
      kunci: 'bukti',
      label: 'Bukti pengeluaran',
      deskripsi: 'Tiket, hotel, kuitansi, foto',
      jumlah: daftarBerkas.data?.length,
      galat: galatTab.bukti,
      jumlahPerlu: progres.perTahap.bukti.peringatan,
    },
    {
      kunci: 'pelaksana',
      label: 'Pelaksana & rincian biaya',
      deskripsi: 'Personel, perjalanan, biaya',
      jumlah: st.pelaksana.length,
      galat: galatTab.pelaksana,
      jumlahPerlu: progres.perTahap.pelaksana.peringatan,
      perlu: adaPerlu,
    },
    {
      kunci: 'laporan',
      label: 'Laporan & berkas cetak',
      deskripsi: 'Laporan pelaksanaan, SPTB, SPD',
      galat: false,
      jumlahPerlu: progres.perTahap.laporan.peringatan,
    },
  ]

  const pilihTab = (k: TabKunci) => {
    if (id === null && (k === 'bukti' || k === 'laporan')) {
      toast.info('Simpan data surat tugas terlebih dahulu untuk mengunggah bukti atau menyusun laporan.')
      return
    }
    setTab(k)
  }

  const modeLaporan = tab === 'laporan' && id !== null

  // Navigasi linier antar langkah dan antar sub-tab pelaksana
  let navSebelumnya: NavigasiAksi | null = null
  let navBerikutnya: NavigasiAksi | null = null
  let navEkstraBerikutnya: NavigasiAksi | null = null

  if (tab === 'data') {
    navBerikutnya = {
      label: 'Lanjut ke Bukti Pengeluaran',
      onClick: () => {
        if (id === null) {
          void kirim()
        } else {
          setTab('bukti')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },
    }
  } else if (tab === 'bukti') {
    navSebelumnya = {
      label: 'Sebelumnya: Data ST',
      onClick: () => {
        setTab('data')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    }
    navBerikutnya = {
      label: 'Lanjut ke Pelaksana & Biaya',
      onClick: () => {
        setTab('pelaksana')
        daftarPelaksana.setBagian('perjalanan')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    }
  } else if (tab === 'pelaksana') {
    const aktifIdx = daftarPelaksana.aktif
    const subBagian = daftarPelaksana.bagian
    const jumlahPelaksana = st.pelaksana.length

    if (subBagian === 'perjalanan') {
      if (aktifIdx === 0) {
        navSebelumnya = {
          label: 'Sebelumnya: Bukti Pengeluaran',
          onClick: () => {
            if (id === null) {
              setTab('data')
            } else {
              setTab('bukti')
            }
            window.scrollTo({ top: 0, behavior: 'smooth' })
          },
        }
      } else {
        navSebelumnya = {
          label: `Sebelumnya: Pelaksana ${aktifIdx} (Biaya)`,
          onClick: () => {
            daftarPelaksana.setAktif(aktifIdx - 1)
            daftarPelaksana.setBagian('biaya')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          },
        }
      }

      navBerikutnya = {
        label: 'Lanjut ke Penginapan',
        onClick: () => {
          daftarPelaksana.setBagian('penginapan')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      }
    } else if (subBagian === 'penginapan') {
      navSebelumnya = {
        label: 'Sebelumnya: Perjalanan',
        onClick: () => {
          daftarPelaksana.setBagian('perjalanan')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      }

      navBerikutnya = {
        label: 'Lanjut ke Rincian Biaya',
        onClick: () => {
          daftarPelaksana.setBagian('biaya')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      }
    } else if (subBagian === 'biaya') {
      navSebelumnya = {
        label: 'Sebelumnya: Penginapan',
        onClick: () => {
          daftarPelaksana.setBagian('penginapan')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      }

      if (aktifIdx < jumlahPelaksana - 1) {
        navEkstraBerikutnya = {
          label: `Lanjut ke Pelaksana ${aktifIdx + 2}`,
          variant: 'outline',
          onClick: () => {
            daftarPelaksana.setAktif(aktifIdx + 1)
            daftarPelaksana.setBagian('perjalanan')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          },
        }
      }

      if (id !== null) {
        navBerikutnya = {
          label: 'Lanjut ke Laporan',
          onClick: () => {
            setTab('laporan')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          },
        }
      } else {
        navBerikutnya = {
          label: 'Simpan Surat Tugas',
          onClick: () => void kirim(),
        }
      }
    }
  } else if (tab === 'laporan') {
    navSebelumnya = {
      label: 'Sebelumnya: Pelaksana & Biaya',
      onClick: () => {
        setTab('pelaksana')
        daftarPelaksana.setBagian('biaya')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    }

    if (id !== null) {
      navBerikutnya = {
        label: 'Selesai & Unduh Berkas',
        variant: 'default',
        onClick: () => {
          navigate(`/st/${id}/dokumen`)
        },
      }
    }
  }

  // Isian pelaksana ada di langkah Pelaksana: buka langkah, pelaksana, dan sub-tabnya dulu supaya elemen terlihat sebelum difokuskan.
  const perbaikiIsian = (sasaranId: string, nomorPelaksana: number) => {
    setTab('pelaksana')
    daftarPelaksana.setAktif(nomorPelaksana - 1)
    daftarPelaksana.setBagian(bagianUntukSasaran(sasaranId))
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
    { kunci: 'bukti', label: 'Bukti Pengeluaran' },
    { kunci: 'foto', label: 'Foto Dokumentasi' },
  ]

  return (
    <div>
      <PageHeader
        lengket={!modeLaporan}
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={!bolehUbah ? `Hanya lihat: dibuat oleh ${pembuat ?? 'pengguna lain'}.` : dikunci ? 'Selesai dan terkunci. Buka kunci untuk mengubah.' : deskripsiHeader({ modeLaporan, kotor, baru: id === null })}
        actions={aksiHeader}
      />

      <BannerStatusSt bolehUbah={bolehUbah} dikunci={dikunci} pembuat={pembuat} onBukaKunci={() => setDialogKunci('buka')} />
      <BannerGalatSimpan pesan={pesanTampil} alertRef={alertRef} />

      {/* Menu langkah (dan daftar pelaksana) ada di sidebar aplikasi; di layar sempit tanpa sidebar tampil sebagai baris tab di sini. */}
      {slotSidebar
        ? createPortal(
            <LangkahSt
              kolom
              item={langkah}
              aktif={tab}
              onPilih={pilihTab}
              idAwal="st-menu"
              label="Langkah surat tugas"
              progres={progres}
              anak={{
                pelaksana: (
                  <DaftarPelaksanaSt
                    pelaksana={st.pelaksana}
                    kunci={daftarPelaksana.kunci}
                    hasil={hasil.pelaksana}
                    peta={peta}
                    terkunci={terkunci}
                    aktif={daftarPelaksana.aktif}
                    onPilih={pilihPelaksana}
                    onTambah={daftarPelaksana.tambah}
                  />
                ),
              }}
            />,
            slotSidebar,
          )
        : null}
      <div className="md:hidden">
        <LangkahSt item={langkah} aktif={tab} onPilih={pilihTab} idAwal="st" label="Langkah surat tugas" progres={progres} />
      </div>

      <div className={cn('grid items-start gap-6', !modeLaporan && 'xl:grid-cols-[minmax(0,1fr)_18rem]')}>
        <div className="min-w-0">
          {modeLaporan ? null : (
            <div className="xl:hidden">
              <RingkasanRingkas
                hasil={hasil}
                onPerbaiki={perbaikiIsian}
                jumlahPerlu={progres.perTahap[tab]?.peringatan ?? 0}
                labelPerlu="isian perlu di tahap ini"
              />
            </div>
          )}

          {/* Tahap 1: Data Surat Tugas */}
          <TabPanel idAwal="st" kunci="data" aktif={tab === 'data'}>
            <KelompokIsian terkunci={terkunci}>
              <div className="grid gap-6">
                <KartuDataSt st={st} peta={peta} pengaturan={pengaturan} onUbah={ubahSt} onUbahSumberDana={ubahSumberDana} />
                <KartuPejabatSt st={st} pengaturan={pengaturan} pegawai={daftarPegawai} onUbah={ubahSt} />
              </div>
            </KelompokIsian>
          </TabPanel>

          {/* Tahap 2: Bukti Pengeluaran & Lampiran */}
          {id !== null ? (
            <TabPanel idAwal="st" kunci="bukti" aktif={tab === 'bukti'}>
              <Tabs gaya="segmen" item={itemSubBukti} aktif={subBukti} onPilih={setSubBukti} idAwal="st-bukti" label="Bagian bukti dan dokumentasi" />
              <KelompokIsian terkunci={terkunci}>
                <TabPanel idAwal="st-bukti" kunci="bukti" aktif={subBukti === 'bukti'}>
                  <BuktiPanel
                    stId={id}
                    pelaksanaList={st.pelaksana}
                    onTerapkanHotel={terapkanUsulanHotel}
                    onTerapkanTransport={terapkanUsulanTransport}
                  />
                </TabPanel>
                <TabPanel idAwal="st-bukti" kunci="foto" aktif={subBukti === 'foto'}>
                  <FotoDokumentasiPanel stId={id} />
                </TabPanel>
              </KelompokIsian>
            </TabPanel>
          ) : (
            <TabPanel idAwal="st" kunci="bukti" aktif={tab === 'bukti'}>
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <p>Simpan data surat tugas terlebih dahulu untuk mengunggah bukti pengeluaran.</p>
                <Button className="mt-3" onClick={() => void kirim()}>
                  Simpan Data ST &amp; Buka Unggah Bukti
                </Button>
              </div>
            </TabPanel>
          )}

          {/* Tahap 3: Pelaksana & Rincian Biaya */}
          <TabPanel idAwal="st" kunci="pelaksana" aktif={tab === 'pelaksana'}>
            <TabPelaksanaSt
              pelaksana={st.pelaksana}
              kunci={daftarPelaksana.kunci}
              hasil={hasil.pelaksana}
              sbm={sbm}
              pegawai={daftarPegawai}
              provinsi={provinsi}
              provinsiKedudukan={pengaturan.provinsiKedudukan}
              peta={peta}
              terkunci={terkunci}
              aktif={daftarPelaksana.aktif}
              bagian={daftarPelaksana.bagian}
              onPilih={pilihPelaksana}
              onBagian={daftarPelaksana.setBagian}
              onUbah={daftarPelaksana.ubah}
              onHapus={daftarPelaksana.hapus}
              onTambah={daftarPelaksana.tambah}
            />
          </TabPanel>

          {/* Tahap 4: Laporan & Berkas Cetak */}
          {id !== null ? (
            <TabPanel idAwal="st" kunci="laporan" aktif={tab === 'laporan'}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Pratinjau &amp; Unduh Dokumen Lengkap</h3>
                  <p className="text-xs text-muted-foreground">Unduh berkas SPTB, SPD, Kuitansi Rampung, dan Laporan Perjalanan Dinas sekaligus.</p>
                </div>
                <Button variant="default" size="sm" onClick={() => navigate(`/st/${id}/dokumen`)} className="gap-1.5">
                  <FileTextIcon className="size-4" /> Buka Halaman Unduh Dokumen
                </Button>
              </div>
              <LaporanEditor stId={id} terkunci={terkunci} />
            </TabPanel>
          ) : (
            <TabPanel idAwal="st" kunci="laporan" aktif={tab === 'laporan'}>
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <p>Simpan data surat tugas terlebih dahulu untuk menyusun laporan perjalanan dinas.</p>
              </div>
            </TabPanel>
          )}

          <NavigasiLangkah
            sebelumnya={navSebelumnya}
            berikutnya={navBerikutnya}
            ekstraBerikutnya={modeLaporan ? null : navEkstraBerikutnya}
            tampilSimpan={!modeLaporan && bolehUbah && !dikunci}
            menyimpan={simpan.isPending}
            simpanNonaktif={!kotor && id !== null}
            onSimpan={kirim}
          />
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
