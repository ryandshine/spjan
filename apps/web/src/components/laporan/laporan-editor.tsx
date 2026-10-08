import { useEffect, useMemo, useState } from 'react'
import { PlusIcon, PrinterIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buatLaporanAwal, susunLaporan, type Bagian, type FotoDokumentasi, type LaporanIsi } from '@spjan/shared'

import { BagianCard } from '@/components/laporan/bagian-card'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { pesanGalat } from '@/lib/format'
import { geser } from '@/lib/geser'
import { useDaftarBerkas, useLaporan, usePengaturan, useSimpanLaporan, useSuratTugas } from '@/lib/queries'

type JenisBaru = 'teks' | 'tatawaktu' | 'petugas' | 'dokumentasi'

const MAKS_BAGIAN = 40

function bagianBaru(jenis: JenisBaru): Bagian {
  const id = crypto.randomUUID().slice(0, 8)
  switch (jenis) {
    case 'teks':
      return { id, jenis: 'teks', judul: 'Bagian baru', blok: [{ tipe: 'paragraf', teks: '' }] }
    case 'tatawaktu':
      return { id, jenis: 'tatawaktu', judul: 'Tata Waktu Pelaksanaan', ganti: null }
    case 'petugas':
      return { id, jenis: 'petugas', judul: 'Petugas yang Melaksanakan Perjalanan Dinas', instansi: [] }
    case 'dokumentasi':
      return { id, jenis: 'dokumentasi', judul: 'Dokumentasi Kegiatan' }
  }
}

export function LaporanEditor({ stId }: { stId: number }) {
  const st = useSuratTugas(stId)
  const pengaturan = usePengaturan()
  const laporan = useLaporan(stId)
  const berkas = useDaftarBerkas(stId)
  const { mutate: simpanMutate, isPending, isError, error } = useSimpanLaporan(stId)

  const [draf, setDraf] = useState<LaporanIsi | null>(null)
  const [tersimpan, setTersimpan] = useState<LaporanIsi | null>(null)
  const [jenisBaru, setJenisBaru] = useState<JenisBaru>('teks')

  const awal = useMemo(() => buatLaporanAwal(), [])
  const isi = draf ?? laporan.data?.isi ?? awal
  const kotor = draf !== null && draf !== tersimpan

  useEffect(() => {
    if (!kotor || !draf) return
    const t = window.setTimeout(() => simpanMutate(draf, { onSuccess: () => setTersimpan(draf) }), 1500)
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
        .map((b) => ({
          id: b.id,
          namaAsli: b.namaAsli,
          keterangan: b.keterangan || b.namaAsli,
          mime: b.mime,
          src: `/api/berkas/${b.id}/isi`,
          createdAt: b.createdAt,
        })),
    [berkas.data],
  )

  const model = useMemo(
    () => (st.data && pengaturan.data ? susunLaporan(st.data, pengaturan.data, isi, foto) : null),
    [st.data, pengaturan.data, isi, foto],
  )

  const ubah = (bagian: Bagian[]) => setDraf({ ...isi, bagian })
  const ubahBagian = (i: number, b: Bagian) => ubah(isi.bagian.map((x, n) => (n === i ? b : x)))
  const geserBagian = (i: number, delta: -1 | 1) => {
    if (i + delta < 1) return // sampul selalu pertama
    ubah(geser(isi.bagian, i, delta))
  }

  if (laporan.isError) return <Alert variant="destructive">{pesanGalat(laporan.error)}</Alert>
  if (laporan.isLoading || !model) return <p className="text-sm text-muted-foreground">Memuat laporan...</p>

  const status = isError ? `Gagal menyimpan: ${pesanGalat(error)}` : adaYangBelumTersimpan ? 'Menyimpan...' : 'Tersimpan'

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            Bagian bertanda "Otomatis dari data ST" mengikuti surat tugas yang tersimpan. Narasi hasil, simpulan, dan saran diisi manual.
          </p>
          <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p>
        </div>
        <Link to={`/st/${stId}/dokumen`} className={buttonVariants({ variant: 'outline' })}>
          <PrinterIcon className="size-4" /> Pratinjau &amp; cetak
        </Link>
      </div>

      {isi.bagian.map((b, i) => (
        <BagianCard
          key={b.id}
          bagian={b}
          model={model.bagian.find((m) => m.id === b.id)}
          sampul={model.sampul}
          jumlahFoto={foto.length}
          bisaNaik={i > 1}
          bisaTurun={i < isi.bagian.length - 1}
          onUbah={(nb) => ubahBagian(i, nb)}
          onNaik={() => geserBagian(i, -1)}
          onTurun={() => geserBagian(i, 1)}
          onHapus={() => ubah(isi.bagian.filter((_, n) => n !== i))}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-52" aria-label="Jenis bagian baru" value={jenisBaru} onChange={(e) => setJenisBaru(e.target.value as JenisBaru)}>
          <option value="teks">Teks bebas</option>
          <option value="tatawaktu">Tata waktu</option>
          <option value="petugas">Tabel petugas</option>
          <option value="dokumentasi">Dokumentasi</option>
        </Select>
        <Button type="button" variant="outline" disabled={isi.bagian.length >= MAKS_BAGIAN} onClick={() => ubah([...isi.bagian, bagianBaru(jenisBaru)])}>
          <PlusIcon className="size-4" /> Tambah bagian
        </Button>
      </div>
    </div>
  )
}
