import { useState } from 'react'
import { FileDownIcon, FileTextIcon, PencilIcon, PlusIcon, Trash2Icon, ArrowRightIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { toast } from 'sonner'
import { formatRentangWaktuSt, type NaskahStRingkasDto } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pesanGalat, waktuPendek } from '@/lib/format'
import { useBuatSpjDariNaskah, useDaftarNaskahSt, useHapusNaskahSt, useMe } from '@/lib/queries'

export default function NaskahStListPage() {
  const navigate = useNavigate()
  const daftar = useDaftarNaskahSt()
  const hapus = useHapusNaskahSt()
  const buatSpj = useBuatSpjDariNaskah()
  const me = useMe()
  const boleh = (b: NaskahStRingkasDto) => me.data?.peran === 'admin' || (b.dibuatOleh !== null && b.dibuatOleh === me.data?.id)

  const [targetHapus, setTargetHapus] = useState<NaskahStRingkasDto | null>(null)
  const [sedangBuatSpjId, setSedangBuatSpjId] = useState<number | null>(null)

  async function handleBuatSpj(id: number) {
    try {
      setSedangBuatSpjId(id)
      const res = await buatSpj.mutateAsync(id)
      toast.success('SPJ berhasil dibuat dari naskah ST!')
      navigate(`/st/${res.spjId}`)
    } catch (err) {
      toast.error(pesanGalat(err))
    } finally {
      setSedangBuatSpjId(null)
    }
  }

  const kolom: Kolom<NaskahStRingkasDto>[] = [
    {
      judul: 'Nomor ST',
      teks: (b) => b.nomor,
      sel: (b) => (
        <div className="flex flex-col gap-1">
          <Link to={`/st-naskah/${b.id}`} className="font-medium text-primary hover:underline">
            {b.nomor}
          </Link>
          <div>
            {b.modeNomor === 'srikandi' ? (
              <Badge variant="outline" className="text-[10px] font-normal border-primary/30 text-primary">
                Srikandi Ready
              </Badge>
            ) : (
              <Badge variant="muted" className="text-[10px] font-normal">
                Manual
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      judul: 'Maksud Penugasan',
      teks: (b) => b.maksudTugas,
      sel: (b) => (
        <div className="max-w-xs sm:max-w-md">
          <p className="line-clamp-2 text-sm leading-snug font-medium" title={b.maksudTugas}>
            {b.maksudTugas}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
            <span>📍 {b.lokasiTugas}</span>
          </p>
        </div>
      ),
    },
    {
      judul: 'Waktu Tugas',
      sel: (b) => (
        <div className="text-xs">
          <p className="font-medium text-foreground whitespace-nowrap">
            {formatRentangWaktuSt(b.tanggalMulai, b.tanggalSelesai)}
          </p>
          <p className="text-muted-foreground">{b.lamaHari} hari</p>
        </div>
      ),
    },
    {
      judul: 'Personil',
      rataKanan: true,
      sel: (b) => (
        <Badge variant="muted" className="font-normal">
          {b.jumlahPelaksana} orang
        </Badge>
      ),
    },

    {
      judul: 'Integrasi SPJ',
      sel: (b) =>
        b.spjId ? (
          <Link
            to={`/st/${b.spjId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            title="Lihat SPJ terkait di modul keuangan"
          >
            <FileTextIcon className="size-3" /> SPJ Terbit
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
            disabled={sedangBuatSpjId === b.id}
            onClick={() => handleBuatSpj(b.id)}
            title="Buat draf SPJ keuangan langsung dari ST ini"
          >
            <ArrowRightIcon className="size-3" /> Buat SPJ
          </Button>
        ),
    },
    {
      judul: 'Pembuat',
      sel: (b) => <span className="text-xs text-muted-foreground">{b.dibuatOlehNama ?? '-'}</span>,
    },
    {
      judul: 'Diperbarui',
      sel: (b) => <span className="text-xs text-muted-foreground">{waktuPendek(b.updatedAt)}</span>,
    },
    {
      judul: '',
      sel: (b) => {
        const tglMentah = b.tanggalMulai
        let tgl = new Date().toISOString().slice(0, 10)
        if (tglMentah) {
          const m = String(tglMentah).match(/\d{4}-\d{2}-\d{2}/)
          if (m) tgl = m[0]
        }
        const nomorClean = (b.nomor || 'Draft').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        const namaFile = `${tgl}_Surat_Tugas_${nomorClean}.docx`

        return (
          <div className="flex justify-end gap-1">
            <a
              href={`/api/naskah-st/${b.id}/docx`}
              download={namaFile}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              title="Unduh format DOCX resmi (siap upload Srikandi/Word)"
            >
              <FileDownIcon className="size-3.5" /> DOCX
            </a>
            <Link
              to={`/st-naskah/${b.id}`}
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
              title="Edit naskah Surat Tugas"
            >
              <PencilIcon className="size-3.5" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Hapus ST ${b.nomor}`}
              disabled={!boleh(b)}
              onClick={() => setTargetHapus(b)}
              title={!boleh(b) ? 'Hanya pembuat atau admin yang boleh menghapus' : 'Hapus ST'}
            >
              <Trash2Icon className="size-3.5 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Surat Tugas (ST / SPT)"
        description="Penyusunan naskah dinas penugasan resmi Direktorat Pengendalian Perhutanan Sosial (format SRIKANDI TTE & Word)."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/st-naskah/baru" className={buttonVariants()}>
              <PlusIcon className="size-4" /> Buat Surat Tugas Baru
            </Link>
          </div>
        }
      />

      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat naskah surat tugas...' : 'Belum ada surat tugas yang dibuat.'}
        />
      )}

      {/* Dialog Konfirmasi Hapus */}
      <Dialog open={targetHapus !== null} onOpenChange={(open) => !open && setTargetHapus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Surat Tugas?</DialogTitle>
            <DialogDescription>
              Naskah surat tugas <strong>{targetHapus?.nomor}</strong> akan dihapus permanen. Aksi ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTargetHapus(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={hapus.isPending}
              onClick={async () => {
                if (!targetHapus) return
                await hapus.mutateAsync(targetHapus.id)
                toast.success('Surat tugas berhasil dihapus.')
                setTargetHapus(null)
              }}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
