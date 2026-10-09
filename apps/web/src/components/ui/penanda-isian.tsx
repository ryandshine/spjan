import { RotateCcwIcon, SparklesIcon } from 'lucide-react'

/** Wajib = harus diisi pengguna; otomatis = terisi sendiri dari data lain; opsional = boleh dikosongkan (tanpa penanda). */
export type ModeIsian = 'wajib' | 'otomatis' | 'opsional'

/** Tanda bintang merah di belakang label isian wajib; pembaca layar tetap mendengar "wajib diisi". */
export function TandaWajib() {
  return (
    <>
      <span aria-hidden className="ml-0.5 text-destructive">
        *
      </span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )
}

/**
 * Penanda isian otomatis: ikon redup selama nilainya otomatis; setelah diisi manual berubah menjadi tombol kecil
 * untuk kembali ke otomatis (tanpa tombol bila pemanggil tidak menyediakannya).
 */
export function PenandaOtomatis({ aktif = true, onKembali }: { aktif?: boolean; onKembali?: () => void }) {
  if (aktif) {
    return (
      <span title="Terisi otomatis" className="inline-flex text-muted-foreground/60">
        <SparklesIcon className="size-3.5" aria-hidden />
        <span className="sr-only">Terisi otomatis</span>
      </span>
    )
  }
  if (!onKembali) return null
  return (
    <button
      type="button"
      onClick={onKembali}
      title="Kembali ke otomatis"
      aria-label="Kembali ke otomatis"
      className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <RotateCcwIcon className="size-3.5" aria-hidden />
    </button>
  )
}
