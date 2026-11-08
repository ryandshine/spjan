import { useState } from 'react'
import { FileTextIcon, FileUpIcon, LockIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTable, type Kolom } from '@/components/data-table'
import { DialogKonfirmasiPassword } from '@/components/dialog-konfirmasi-password'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { pesanGalat, rupiah, tanggalPendek, waktuPendek } from '@/lib/format'
import { useDaftarSuratTugas, useHapusSuratTugas, useMe } from '@/lib/queries'
import type { SuratTugasRingkasDto } from '@spjan/shared'

import { pelaksanaCocok, ringkasCariOrang } from '@/lib/cari-st'
import { cn } from '@/lib/utils'

function renderBadgeStatus(b: SuratTugasRingkasDto) {
  if (b.status === 'final') {
    return (
      <Badge variant="muted">
        <LockIcon className="mr-1 size-3" aria-hidden /> Final
      </Badge>
    )
  }
  if (b.jumlahPelaksana === 0) {
    return <Badge variant="muted">Belum ada pelaksana</Badge>
  }
  if (b.jumlahPeringatan > 0) {
    return <Badge variant="warning">{b.jumlahPeringatan} perlu diperiksa</Badge>
  }
  return <Badge variant="success">Siap cetak</Badge>
}

function DaftarTujuan({ tujuan }: { tujuan: string }) {
  const [terbuka, setTerbuka] = useState(false)
  const daftar = tujuan
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  if (daftar.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }
  if (daftar.length === 1) {
    return <span className="text-sm leading-snug">{daftar[0]}</span>
  }

  const tampil = terbuka ? daftar : daftar.slice(0, 2)
  const sisa = daftar.length - 2

  return (
    <div className="grid gap-1 py-0.5">
      {tampil.map((rute, idx) => (
        <div key={idx} className="flex items-start gap-1.5 text-xs leading-snug">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
          <span className={terbuka ? 'break-words' : 'line-clamp-1'} title={rute}>
            {rute}
          </span>
        </div>
      ))}
      {sisa > 0 ? (
        <button
          type="button"
          onClick={() => setTerbuka((v) => !v)}
          className="mt-0.5 w-fit cursor-pointer rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {terbuka ? 'Sembunyikan' : `+${sisa} rute lainnya`}
        </button>
      ) : null}
    </div>
  )
}

/** Nama pelaksana: dua pertama, sisanya dibuka lewat tombol. Nama yang cocok dengan pencarian ditebalkan. */
function DaftarPelaksana({ b, kata }: { b: SuratTugasRingkasDto; kata: string }) {
  const [terbuka, setTerbuka] = useState(false)
  if (b.pelaksana.length === 0) return <span className="text-muted-foreground">-</span>
  const cocok = new Set(pelaksanaCocok(b, kata).map((c) => c.nomor))
  const tampil = terbuka ? b.pelaksana : b.pelaksana.slice(0, 2)
  const sisa = b.pelaksana.length - 2
  return (
    <div className="grid gap-1 py-0.5">
      {tampil.map((p, idx) => (
        <span key={idx} className={cn('text-xs leading-snug', terbuka ? 'break-words' : 'line-clamp-1', cocok.has(idx + 1) && 'font-semibold text-foreground')} title={p.nama}>
          {idx + 1}. {p.nama}
        </span>
      ))}
      {sisa > 0 ? (
        <button
          type="button"
          onClick={() => setTerbuka((v) => !v)}
          className="mt-0.5 w-fit cursor-pointer rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {terbuka ? 'Sembunyikan' : `+${sisa} pelaksana lainnya`}
        </button>
      ) : null}
    </div>
  )
}

export default function SuratTugasListPage() {
  const daftar = useDaftarSuratTugas()
  const hapus = useHapusSuratTugas()
  const me = useMe()
  const boleh = (b: SuratTugasRingkasDto) => me.data?.peran === 'admin' || (b.dibuatOleh !== null && b.dibuatOleh === me.data?.id)
  const [target, setTarget] = useState<SuratTugasRingkasDto | null>(null)
  const [kata, setKata] = useState('')
  const ringkasOrang = ringkasCariOrang(daftar.data ?? [], kata)
  const blokCocok = (b: SuratTugasRingkasDto) => {
    const cocok = pelaksanaCocok(b, kata)
    if (cocok.length === 0) return null
    return (
      <ul className="mt-1 grid gap-0.5 text-xs">
        {cocok.map((c) => (
          <li key={c.nomor}>
            <Link to={`/st/${b.id}?tab=pelaksana${c.nomor > 1 ? `&pelaksana=${c.nomor}` : ''}`} className="text-foreground hover:underline">
              Cocok: <strong>{c.nama}</strong> (pelaksana {c.nomor}) · {rupiah(c.total)}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const kolom: Kolom<SuratTugasRingkasDto>[] = [
    {
      judul: 'Nomor',
      teks: (b) => b.nomor,
      className: 'whitespace-nowrap',
      sel: (b) => (
        <>
          <Link to={`/st/${b.id}`} className="font-medium text-primary hover:underline">
            {b.nomor}
          </Link>
          {blokCocok(b)}
        </>
      ),
    },
    {
      judul: 'Tanggal',
      teks: (b) => tanggalPendek(b.tanggal),
      className: 'whitespace-nowrap',
      sel: (b) => tanggalPendek(b.tanggal),
    },
    {
      judul: 'Tujuan',
      teks: (b) => b.tujuan,
      className: 'min-w-[200px] max-w-[280px]',
      sel: (b) => <DaftarTujuan tujuan={b.tujuan} />,
    },
    {
      judul: 'Pelaksana',
      className: 'min-w-[180px] max-w-[240px]',
      sel: (b) => <DaftarPelaksana b={b} kata={kata} />,
    },
    {
      judul: 'Pembuat',
      teks: (b) => b.dibuatOlehNama ?? '',
      className: 'max-w-[130px]',
      sel: (b) => (
        <span className="block truncate text-muted-foreground" title={b.dibuatOlehNama ?? undefined}>
          {b.dibuatOlehNama ?? '-'}
        </span>
      ),
    },
    {
      judul: 'Total',
      rataKanan: true,
      className: 'whitespace-nowrap font-medium',
      sel: (b) => (b.jumlahPelaksana > 0 ? rupiah(b.total) : <span className="text-muted-foreground font-normal">-</span>),
    },
    {
      judul: 'Per komponen',
      className: 'min-w-[210px]',
      sel: (b) =>
        b.komponen.length > 0 ? (
          <ul className="grid gap-1 text-xs text-muted-foreground tabular-nums">
            {b.komponen.map((k) => (
              <li key={k.label} className="flex items-baseline justify-between gap-4 whitespace-nowrap">
                <span className="text-muted-foreground/90">{k.label}</span>
                <span className="font-medium text-foreground/85">{rupiah(k.nilai)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      judul: 'Status',
      className: 'whitespace-nowrap',
      sel: (b) => renderBadgeStatus(b),
    },
    {
      judul: 'Diperbarui',
      className: 'whitespace-nowrap text-xs',
      sel: (b) => <span className="text-muted-foreground">{waktuPendek(b.updatedAt)}</span>,
    },
    {
      judul: '',
      className: 'whitespace-nowrap',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Link to={`/st/${b.id}/dokumen`} className={buttonVariants({ variant: 'outline', size: 'sm' })} aria-label={`Dokumen ${b.nomor}`}>
            <FileTextIcon className="size-3.5" /> Dokumen
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Hapus ${b.nomor}`}
            title={b.status === 'final' ? 'Terkunci: buka kunci dulu untuk menghapus' : !boleh(b) ? 'Hanya pembuat atau admin yang boleh menghapus' : undefined}
            disabled={b.status === 'final' || !boleh(b)}
            onClick={() => setTarget(b)}
          >
            <Trash2Icon className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="SPJ Perjalanan Dinas"
        description="Penyusunan berkas pertanggungjawaban keuangan perjalanan dinas (SPTB, SPD, Kuitansi, Rincian, dan Laporan)."
        actions={

          <div className="flex items-center gap-2">
            <Link to="/st/buat-dari-st" className={buttonVariants({ variant: 'outline' })}>
              <FileUpIcon className="size-4" /> Buat dari ST
            </Link>
            <Link to="/st/baru" className={buttonVariants()}>
              <PlusIcon className="size-4" /> Isi manual
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
          kosong={daftar.isPending ? 'Memuat...' : 'Belum ada surat tugas.'}
          kata={kata}
          onKata={setKata}
          diBawahCari={
            ringkasOrang ? (
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{ringkasOrang.nama.join(', ')}</strong> ditemukan di{' '}
                <strong className="text-foreground">{ringkasOrang.jumlahSpj} SPJ</strong> · total diterima{' '}
                <strong className="text-foreground tabular-nums">{rupiah(ringkasOrang.total)}</strong>
              </p>
            ) : null
          }
          teksCari={(b) => `${b.kataKunci} ${b.status === 'final' ? 'final terkunci' : 'draf'}`}
          petunjukCari="Cari nomor ST, nama, NIP, no. SPD, tujuan, kegiatan..."
          kartuMobile={(b) => (
            <div className="rounded-lg border bg-card p-4 shadow-xs grid gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/st/${b.id}`} className="font-semibold text-sm text-primary hover:underline break-all">
                    {b.nomor}
                  </Link>
                  {blokCocok(b)}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tanggalPendek(b.tanggal)} · {b.jumlahPelaksana} pelaksana · {b.dibuatOlehNama ?? '-'}
                  </p>
                </div>
                <div className="shrink-0">{renderBadgeStatus(b)}</div>
              </div>

              <div className="border-t pt-2.5">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tujuan</p>
                <DaftarTujuan tujuan={b.tujuan} />
                <p className="mt-2.5 mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pelaksana</p>
                <DaftarPelaksana b={b} kata={kata} />
              </div>

              <div className="rounded-md bg-muted/40 p-2.5 grid gap-1.5">
                <div className="flex items-baseline justify-between text-xs font-semibold">
                  <span>Total Biaya</span>
                  <span className="tabular-nums text-sm">{b.jumlahPelaksana > 0 ? rupiah(b.total) : '-'}</span>
                </div>
                {b.komponen.length > 0 ? (
                  <ul className="grid gap-1 border-t border-border/60 pt-1.5 text-xs text-muted-foreground tabular-nums">
                    {b.komponen.map((k) => (
                      <li key={k.label} className="flex items-baseline justify-between gap-2">
                        <span>{k.label}</span>
                        <span className="text-foreground/80">{rupiah(k.nilai)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">Diperbarui {waktuPendek(b.updatedAt)}</span>
                <div className="flex items-center gap-1">
                  <Link to={`/st/${b.id}/dokumen`} className={buttonVariants({ variant: 'outline', size: 'sm' })} aria-label={`Dokumen ${b.nomor}`}>
                    <FileTextIcon className="size-3.5" /> Dokumen
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus ${b.nomor}`}
                    title={b.status === 'final' ? 'Terkunci: buka kunci dulu untuk menghapus' : !boleh(b) ? 'Hanya pembuat atau admin yang boleh menghapus' : undefined}
                    disabled={b.status === 'final' || !boleh(b)}
                    onClick={() => setTarget(b)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <DialogKonfirmasiPassword
        buka={target !== null}
        onBukaChange={(b) => !b && setTarget(null)}
        judul="Hapus surat tugas?"
        deskripsi={`${target?.nomor ?? ''} beserta pelaksana, tujuan, biaya, dan berkasnya dipindah ke tempat sampah. Admin masih bisa memulihkannya.`}
        labelAksi="Hapus"
        bahaya
        onKonfirmasi={async ({ password }) => {
          if (!target) return
          await hapus.mutateAsync({ id: target.id, password })
          toast.success('Surat tugas dipindah ke tempat sampah.')
        }}
      />
    </div>
  )
}
