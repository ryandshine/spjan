import * as React from 'react'

import { cn } from '@/lib/utils'

/** Kolom teks satu baris yang tumbuh ke bawah mengikuti isinya, sehingga teks panjang tidak terpotong. */
function TextareaOtomatis({ className, value, ...props }: React.ComponentProps<'textarea'>) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const sesuaikan = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [])
  React.useLayoutEffect(sesuaikan, [value, sesuaikan])
  // Lebar kolom bisa berubah tanpa isi berubah (ubah ukuran jendela, zoom halaman, grid bergeser): hitung ulang tinggi agar tidak terpotong.
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lebar = el.clientWidth
    const pengamat = new ResizeObserver(() => {
      if (el.clientWidth !== lebar) {
        lebar = el.clientWidth
        sesuaikan()
      }
    })
    pengamat.observe(el)
    return () => pengamat.disconnect()
  }, [sesuaikan])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn(
        'min-h-9 w-full resize-none overflow-hidden rounded-md border border-input bg-card px-3 py-[7px] text-sm leading-normal shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
      onKeyDown={(e) => {
        // Kolom satu baris yang membungkus: Enter tidak menambah baris baru.
        if (e.key === 'Enter') e.preventDefault()
        props.onKeyDown?.(e)
      }}
    />
  )
}

export { TextareaOtomatis }
