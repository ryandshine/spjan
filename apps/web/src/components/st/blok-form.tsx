import type { ReactNode } from 'react'

/** Blok bergaris halus untuk mengelompokkan isian dalam kartu pelaksana (identitas, tujuan, transportasi). */
export function BlokForm({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border/70 p-4">
      <h3 className="text-sm font-semibold">{judul}</h3>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}
