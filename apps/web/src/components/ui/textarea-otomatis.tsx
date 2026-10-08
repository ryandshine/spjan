import * as React from 'react'

import { cn } from '@/lib/utils'

/** Kolom teks satu baris yang tumbuh ke bawah mengikuti isinya, sehingga teks panjang tidak terpotong. */
function TextareaOtomatis({ className, value, ...props }: React.ComponentProps<'textarea'>) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn(
        'min-h-9 w-full resize-none rounded-md border border-input bg-card px-3 py-[7px] text-sm leading-normal shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
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
