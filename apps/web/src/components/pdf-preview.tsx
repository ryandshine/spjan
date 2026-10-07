import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

const PdfKanvas = lazy(() => import('@/components/pdf-kanvas').then((m) => ({ default: m.PdfKanvas })))

/** Peramban dengan penampil PDF bawaan memakai iframe; sisanya (Chrome Android) memakai kanvas pdf.js. */
const bisaIframePdf = typeof navigator !== 'undefined' && navigator.pdfViewerEnabled !== false

/** Membuat PDF dari `dokumen` di peramban dan menampilkannya di iframe. */
export function PdfPreview({ dokumen, onSiap }: { dokumen: ReactElement<DocumentProps>; onSiap?: (blob: Blob) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    let objek: string | null = null
    ;(async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer')
        const blob = await pdf(dokumen).toBlob()
        if (batal) return
        objek = URL.createObjectURL(blob)
        setUrl(objek)
        setBlob(blob)
        setGalat(null)
        onSiap?.(blob)
      } catch (error) {
        if (!batal) setGalat(error instanceof Error ? error.message : 'Gagal membuat PDF')
      }
    })()
    return () => {
      batal = true
      if (objek) URL.revokeObjectURL(objek)
    }
  }, [dokumen, onSiap])

  if (galat) return <p className="p-6 text-sm text-destructive">Gagal membuat pratinjau: {galat}</p>
  if (!url || !blob) return <p className="p-6 text-sm text-muted-foreground">Menyiapkan pratinjau...</p>
  if (!bisaIframePdf) {
    return (
      <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Menyiapkan pratinjau...</p>}>
        <PdfKanvas blob={blob} />
      </Suspense>
    )
  }
  return <iframe title="Pratinjau dokumen" src={url} className="h-full w-full rounded-lg border bg-card" />
}
