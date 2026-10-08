import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import type { Bagian, KelompokBagian, RingkasanLaporan } from '@spjan/shared'

import { StatusChip } from '@/components/laporan/status-chip'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { labelBagian } from '@/lib/laporan-label'
import { cn } from '@/lib/utils'

export type JenisBaru = 'teks' | 'tatawaktu' | 'petugas' | 'dokumentasi'

const KELOMPOK: { kunci: KelompokBagian; judul: string }[] = [
  { kunci: 'tulis', judul: 'Perlu Anda tulis' },
  { kunci: 'otomatis', judul: 'Terisi otomatis dari surat tugas' },
  { kunci: 'lampiran', judul: 'Lampiran' },
]

/** Daftar bagian laporan dengan status; satu bagian dipilih untuk disunting di panel. */
export function KerangkaLaporan({
  bagian,
  ringkasan,
  terpilihId,
  penuh,
  onPilih,
  onTambah,
}: {
  bagian: Bagian[]
  ringkasan: RingkasanLaporan
  terpilihId: string
  penuh: boolean
  onPilih: (id: string) => void
  onTambah: (jenis: JenisBaru) => void
}) {
  const [jenisBaru, setJenisBaru] = useState<JenisBaru>('teks')
  const status = new Map(ringkasan.bagian.map((s) => [s.id, s]))
  return (
    <nav aria-label="Bagian laporan" className="grid content-start gap-5">
      {KELOMPOK.map((k) => {
        const baris = bagian.filter((b) => status.get(b.id)?.kelompok === k.kunci)
        if (baris.length === 0) return null
        return (
          <section key={k.kunci} aria-labelledby={`kel-${k.kunci}`}>
            <h2 id={`kel-${k.kunci}`} className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {k.judul}
            </h2>
            <ul className="grid gap-1">
              {baris.map((b) => {
                const s = status.get(b.id)
                const aktif = b.id === terpilihId
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onPilih(b.id)}
                      aria-current={aktif ? 'true' : undefined}
                      className={cn(
                        'flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-l-4 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        aktif ? 'border-primary bg-accent font-medium' : 'border-l-transparent bg-card',
                      )}
                    >
                      <span className="min-w-0 truncate">{labelBagian(b)}</span>
                      {s ? <StatusChip status={s.status} detail={s.detail} /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Select className="h-10 min-w-0 flex-1" aria-label="Jenis bagian baru" value={jenisBaru} onChange={(e) => setJenisBaru(e.target.value as JenisBaru)}>
          <option value="teks">Bagian tulisan baru</option>
          <option value="tatawaktu">Tata waktu</option>
          <option value="petugas">Tabel petugas</option>
          <option value="dokumentasi">Dokumentasi foto</option>
        </Select>
        <Button type="button" variant="outline" className="h-10" disabled={penuh} onClick={() => onTambah(jenisBaru)}>
          <PlusIcon className="size-4" /> Tambah
        </Button>
      </div>
    </nav>
  )
}
