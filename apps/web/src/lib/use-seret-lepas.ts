import { useState, type DragEvent } from 'react'

/** Perilaku seret-dan-lepas berkas: `dragOver` menyala saat berkas di atas area, `props` dipasang pada elemen areanya. */
export function useSeretLepas(onFiles: (files: FileList) => void) {
  const [dragOver, setDragOver] = useState(false)
  const props = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      setDragOver(true)
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files) onFiles(e.dataTransfer.files)
    },
  }
  return { dragOver, props }
}
