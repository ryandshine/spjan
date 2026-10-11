import type { ReactNode } from 'react'

/**
 * Mengunci semua isian di dalamnya (fieldset disabled) tanpa mematikan tombol navigasi di luarnya,
 * sehingga surat tugas yang terkunci tetap bisa dilihat bagian demi bagian.
 */
export function KelompokIsian({ terkunci, children }: { terkunci: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={terkunci} className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  )
}
