import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useTema } from '@/lib/tema'

function Toaster(props: ToasterProps) {
  const [tema] = useTema()
  return <Sonner position="top-right" richColors closeButton theme={tema} {...props} />
}

export { Toaster }
