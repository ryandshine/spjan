import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { DataTable, type Kolom } from '@/components/data-table'
import { pesanGalat, waktuPendek } from '@/lib/format'
import { useAudit } from '@/lib/queries'
import type { LogAuditDto } from '@spjan/shared'

const LABEL_AKSI: Record<string, string> = {
  'st.buat': 'Buat surat tugas',
  'st.kunci': 'Tandai selesai (kunci)',
  'st.buka_kunci': 'Buka kunci',
  'st.hapus': 'Hapus surat tugas',
  'st.pulihkan': 'Pulihkan surat tugas',
  'st.hapus_permanen': 'Hapus permanen surat tugas',
  'berkas.hapus': 'Hapus berkas',
  'berkas.pulihkan': 'Pulihkan berkas',
  'berkas.hapus_permanen': 'Hapus permanen berkas',
  'pengguna.buat': 'Tambah pengguna',
  'pengguna.ubah': 'Ubah pengguna',
  'pengguna.reset_password': 'Reset password',
}

export default function AuditPage() {
  const audit = useAudit()
  const kolom: Kolom<LogAuditDto>[] = [
    { judul: 'Waktu', sel: (l) => <span className="whitespace-nowrap text-muted-foreground">{waktuPendek(l.waktu)}</span> },
    { judul: 'Pengguna', teks: (l) => l.username, sel: (l) => <span className="font-medium">{l.username}</span> },
    { judul: 'Aksi', teks: (l) => LABEL_AKSI[l.aksi] ?? l.aksi, sel: (l) => LABEL_AKSI[l.aksi] ?? l.aksi },
    { judul: 'Surat tugas', sel: (l) => (l.stId !== null ? `#${l.stId}` : '-') },
    { judul: 'Alasan / rincian', teks: (l) => l.alasan ?? '', sel: (l) => l.alasan ?? (l.detail ? <code className="text-xs text-muted-foreground">{JSON.stringify(l.detail)}</code> : '-') },
  ]
  return (
    <div>
      <PageHeader title="Log Audit" description="200 aktivitas terakhir: siapa melakukan apa dan kapan." />
      {audit.isError ? <Alert variant="destructive">{pesanGalat(audit.error)}</Alert> : <DataTable kolom={kolom} baris={audit.data ?? []} kosong={audit.isPending ? 'Memuat...' : 'Belum ada aktivitas.'} />}
    </div>
  )
}
