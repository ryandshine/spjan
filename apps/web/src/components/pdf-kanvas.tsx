import { useEffect, useRef, useState } from 'react'

import { pasangPolyfillPdf } from '@/lib/polyfill-pdf'

/** Merender PDF ke kanvas per halaman untuk peramban tanpa penampil PDF bawaan (mis. Chrome Android). */
export function PdfKanvas({ blob }: { blob: Blob }) {
  const wadah = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'memuat' | 'siap' | 'galat'>('memuat')
  const [pesan, setPesan] = useState('')

  useEffect(() => {
    let batal = false
    const el = wadah.current
    ;(async () => {
      try {
        pasangPolyfillPdf()
        // Build legacy memuat polyfill untuk Chrome/WebView Android yang belum mendukung fitur JS terbaru.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
        if (batal || !el) return
        el.replaceChildren()
        const lebar = el.clientWidth || 600
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= doc.numPages; n++) {
          const halaman = await doc.getPage(n)
          if (batal) return
          const dasar = halaman.getViewport({ scale: 1 })
          const viewport = halaman.getViewport({ scale: (lebar / dasar.width) * dpr })
          const kanvas = document.createElement('canvas')
          kanvas.width = Math.floor(viewport.width)
          kanvas.height = Math.floor(viewport.height)
          kanvas.style.width = '100%'
          kanvas.className = 'mb-3 rounded border bg-white shadow-xs'
          kanvas.setAttribute('role', 'img')
          kanvas.setAttribute('aria-label', `Halaman ${n} dari ${doc.numPages}`)
          el.appendChild(kanvas)
          await halaman.render({ canvas: kanvas, viewport }).promise
        }
        if (!batal) setStatus('siap')
      } catch (error) {
        if (!batal) {
          setPesan(error instanceof Error ? error.message : String(error))
          setStatus('galat')
        }
      }
    })()
    return () => {
      batal = true
    }
  }, [blob])

  return (
    <div className="h-full overflow-y-auto rounded-lg border bg-muted/40 p-3">
      {status === 'memuat' ? <p className="text-sm text-muted-foreground">Menggambar halaman...</p> : null}
      {status === 'galat' ? <p className="text-sm text-destructive">Pratinjau gagal ditampilkan. Gunakan tombol Unduh PDF.{pesan ? <span className="mt-1 block text-xs text-muted-foreground">Rincian: {pesan}</span> : null}</p> : null}
      <div ref={wadah} />
    </div>
  )
}
