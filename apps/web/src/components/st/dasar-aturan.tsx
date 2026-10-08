import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Tautan kecil "Lihat dasar aturan" yang membuka kutipan aturan lengkap, agar teks hukum tidak memenuhi formulir. */
export function DasarAturan({ judul, children }: { judul: string; children: ReactNode }) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Button type="button" variant="link" className="h-auto justify-start p-0 text-xs" onClick={() => setBuka(true)}>
        Lihat dasar aturan
      </Button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            <DialogDescription className="sr-only">Kutipan aturan yang menjadi dasar perhitungan.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm [overflow-wrap:anywhere]">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}
