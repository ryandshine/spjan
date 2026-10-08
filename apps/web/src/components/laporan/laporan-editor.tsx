import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  buatLaporanAwal,
  dokKosong,
  ringkasStatusLaporan,
  susunLaporan,
  type Bagian,
  type FotoDokumentasi,
  type LaporanIsi,
} from '@spjan/shared'

import { BarLaporan, type StatusSimpan } from '@/components/laporan/bar-laporan'
import { KerangkaLaporan, type JenisBaru } from '@/components/laporan/kerangka-laporan'
import { PanelBagian } from '@/components/laporan/panel-bagian'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { keteranganFoto } from '@/lib/gambar'
import { pesanGalat } from '@/lib/format'
import { geser } from '@/lib/geser'
import { labelBagian } from '@/lib/laporan-label'
import { useDaftarBerkas, useLaporan, usePengaturan, useSimpanLaporan, useSuratTugas } from '@/lib/queries'

const MAKS_BAGIAN = 40

function bagianBaru(jenis: JenisBaru): Bagian {
  const id = crypto.randomUUID().slice(0, 8)
  switch (jenis) {
    case 'teks':
      return { id, jenis: 'teks', judul: 'Bagian baru', isi: dokKosong() }
    case 'tatawaktu':
      return { id, jenis: 'tatawaktu', judul: 'Tata Waktu Pelaksanaan', ganti: null }
    case 'petugas':
      return { id, jenis: 'petugas', judul: 'Petugas yang Melaksanakan Perjalanan Dinas', instansi: [] }
    case 'dokumentasi':
      return { id, jenis: 'dokumentasi', judul: 'Dokumentasi Kegiatan' }
  }
}

const jamId = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')

export function LaporanEditor({ stId }: { stId: number }) {
  const navigate = useNavigate()
  const st = useSuratTugas(stId)
  const pengaturan = usePengaturan()
  const laporan = useLaporan(stId)
  const berkas = useDaftarBerkas(stId)
  const { mutate: simpanMutate, mutateAsync: simpanAsync, isPending, isError, error } = useSimpanLaporan(stId)

  const [draf, setDraf] = useState<LaporanIsi | null>(null)
  const [tersimpan, setTersimpan] = useState<LaporanIsi | null>(null)
  const [waktuSimpan, setWaktuSimpan] = useState<string | null>(null)
  const [terpilihId, setTerpilihId] = useState<string | null>(null)
  const [akanDihapus, setAkanDihapus] = useState<Bagian | null>(null)
  const [peringatanCetak, setPeringatanCetak] = useState(false)
  const [melihat, setMelihat] = useState(false)

  const awal = useMemo(() => buatLaporanAwal(), [])
  const isi = draf ?? laporan.data?.isi ?? awal
  const kotor = draf !== null && draf !== tersimpan

  const berhasilSimpan = (d: LaporanIsi) => {
    setTersimpan(d)
    setWaktuSimpan(jamId(new Date()))
  }

  useEffect(() => {
    if (!kotor || !draf) return
    const t = window.setTimeout(() => simpanMutate(draf, { onSuccess: () => berhasilSimpan(draf) }), 1500)
    return () => window.clearTimeout(t)
  }, [draf, kotor, simpanMutate])

  const adaYangBelumTersimpan = kotor || isPending
  useEffect(() => {
    if (!adaYangBelumTersimpan) return
    const cegah = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', cegah)
    return () => window.removeEventListener('beforeunload', cegah)
  }, [adaYangBelumTersimpan])

  const foto = useMemo<FotoDokumentasi[]>(
    () =>
      (berkas.data ?? [])
        .filter((b) => b.jenis === 'dokumentasi')
        .map((b) => ({ id: b.id, namaAsli: b.namaAsli, keterangan: keteranganFoto(b), mime: b.mime, src: `/api/berkas/${b.id}/isi`, createdAt: b.createdAt })),
    [berkas.data],
  )

  const model = useMemo(
    () => (st.data && pengaturan.data ? susunLaporan(st.data, pengaturan.data, isi, foto) : null),
    [st.data, pengaturan.data, isi, foto],
  )
  const ringkasan = useMemo(() => (model ? ringkasStatusLaporan(model, isi) : null), [model, isi])

  const ubah = (bagian: Bagian[]) => setDraf({ ...isi, bagian })

  // Setelah memilih bagian, panel disunting digulirkan ke layar bila bagian atasnya tidak terlihat (daftar bagian panjang, halaman sudah digulir).
  const pilih = (id: string) => {
    setTerpilihId(id)
    window.requestAnimationFrame(() => {
      const panel = document.getElementById('panel-laporan')
      if (!panel) return
      const atas = panel.getBoundingClientRect().top
      const ponsel = window.matchMedia('(max-width: 1023px)').matches
      if (ponsel || atas < 0 || atas > window.innerHeight * 0.6) panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function lihatPdf(abaikanPeringatan = false) {
    if (!abaikanPeringatan && ringkasan && ringkasan.belumSiap.length > 0) {
      setPeringatanCetak(true)
      return
    }
    setPeringatanCetak(false)
    setMelihat(true)
    try {
      if (kotor && draf) {
        await simpanAsync(draf)
        berhasilSimpan(draf)
      }
      navigate(`/st/${stId}/dokumen`)
    } catch {
      toast.error('Laporan belum tersimpan, jadi PDF belum dibuka. Coba lagi.')
      setMelihat(false)
    }
  }

  function hapusBagian(b: Bagian) {
    const indeks = isi.bagian.findIndex((x) => x.id === b.id)
    if (indeks < 1) return
    ubah(isi.bagian.filter((x) => x.id !== b.id))
    setAkanDihapus(null)
    toast(`Bagian "${labelBagian(b)}" dihapus.`, {
      duration: 8000,
      action: {
        label: 'Urungkan',
        onClick: () =>
          setDraf((d) => {
            if (!d || d.bagian.some((x) => x.id === b.id)) return d
            const salin = [...d.bagian]
            salin.splice(Math.min(indeks, salin.length), 0, b)
            return { ...d, bagian: salin }
          }),
      },
    })
  }

  if (laporan.isError) return <Alert variant="destructive">{pesanGalat(laporan.error)}</Alert>
  if (laporan.isLoading || !model || !ringkasan) return <p className="text-sm text-muted-foreground">Memuat laporan...</p>

  // Bagian terpilih; awalnya narasi wajib pertama yang masih kosong, agar pengguna langsung tahu harus menulis di mana.
  const bawaan =
    ringkasan.bagian.find((s) => s.kelompok === 'tulis' && s.wajib && !s.siap)?.id ??
    ringkasan.bagian.find((s) => s.kelompok === 'tulis')?.id ??
    isi.bagian[0]?.id ??
    ''
  const aktifId = terpilihId && isi.bagian.some((b) => b.id === terpilihId) ? terpilihId : bawaan
  const indeksAktif = isi.bagian.findIndex((b) => b.id === aktifId)
  const aktif = isi.bagian[indeksAktif]

  const status: StatusSimpan = isError && !adaYangBelumTersimpan ? { jenis: 'gagal' } : adaYangBelumTersimpan ? { jenis: 'menyimpan' } : { jenis: 'tersimpan', waktu: waktuSimpan }

  return (
    <div>
      <BarLaporan
        wajibSiap={ringkasan.wajibSiap}
        wajibTotal={ringkasan.wajibTotal}
        status={status}
        melihat={melihat}
        onLihatPdf={() => void lihatPdf()}
        onCobaLagi={() => draf && simpanMutate(draf, { onSuccess: () => berhasilSimpan(draf) })}
      />
      {isError ? <p className="mb-3 text-xs text-destructive">{pesanGalat(error)}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <KerangkaLaporan
          bagian={isi.bagian}
          ringkasan={ringkasan}
          terpilihId={aktifId}
          penuh={isi.bagian.length >= MAKS_BAGIAN}
          onPilih={pilih}
          onTambah={(jenis) => {
            const b = bagianBaru(jenis)
            ubah([...isi.bagian, b])
            pilih(b.id)
          }}
        />
        {aktif ? (
          <PanelBagian
            key={aktif.id}
            bagian={aktif}
            model={model.bagian.find((m) => m.id === aktif.id)}
            stId={stId}
            sampul={model.sampul}
            jumlahFoto={foto.length}
            bisaNaik={indeksAktif > 1}
            bisaTurun={indeksAktif < isi.bagian.length - 1}
            onUbah={(nb) => ubah(isi.bagian.map((x) => (x.id === nb.id ? nb : x)))}
            onNaik={() => indeksAktif > 1 && ubah(geser(isi.bagian, indeksAktif, -1))}
            onTurun={() => ubah(geser(isi.bagian, indeksAktif, 1))}
            onHapus={() => setAkanDihapus(aktif)}
          />
        ) : null}
      </div>

      <Dialog open={akanDihapus !== null} onOpenChange={(buka) => !buka && setAkanDihapus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus bagian &quot;{akanDihapus ? labelBagian(akanDihapus) : ''}&quot;?</DialogTitle>
            <DialogDescription>Isinya akan hilang dari laporan. Anda masih bisa mengurungkan lewat tombol Urungkan selama beberapa detik.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAkanDihapus(null)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={() => akanDihapus && hapusBagian(akanDihapus)}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={peringatanCetak} onOpenChange={setPeringatanCetak}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Masih ada bagian yang belum siap</DialogTitle>
            <DialogDescription>
              {ringkasan.belumSiap.join(', ')} belum lengkap. PDF tetap bisa dibuat, tetapi bagian itu akan kosong atau tidak lengkap.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void lihatPdf(true)}>
              Tetap lihat PDF
            </Button>
            <Button type="button" onClick={() => setPeringatanCetak(false)}>
              Lanjut menulis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
