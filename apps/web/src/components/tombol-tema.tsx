import { MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTema } from '@/lib/tema'
import { cn } from '@/lib/utils'

/** Beralih antara mode terang dan gelap; pilihan diingat di peramban. */
export function TombolTema({ className }: { className?: string }) {
  const [tema, ganti] = useTema()
  const gelap = tema === 'dark'
  return (
    <Button type="button" variant="outline" size="icon" className={cn('h-7 w-8 shrink-0 bg-card', className)} onClick={ganti} aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'} title={gelap ? 'Mode terang' : 'Mode gelap'}>
      {gelap ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
    </Button>
  )
}
