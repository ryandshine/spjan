import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /**
   * Nilai yang, bila berubah, menghapus status galat (mis. pathname). Sengaja bukan `key`: `key` akan
   * memasang ulang halaman pada /st/baru -> /st/:id setelah simpan dan membuang state editor.
   */
  kunciReset?: unknown
}

interface State {
  galat: Error | null
}

/** Menangkap galat render di halaman agar aplikasi tidak menjadi layar kosong. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { galat: null }

  static getDerivedStateFromError(galat: Error): State {
    return { galat }
  }

  componentDidUpdate(sebelum: Props) {
    if (this.state.galat && sebelum.kunciReset !== this.props.kunciReset) this.setState({ galat: null })
  }

  componentDidCatch(galat: Error, info: ErrorInfo) {
    console.error('Galat saat menampilkan halaman:', galat, info.componentStack)
  }

  render() {
    if (!this.state.galat) return this.props.children
    return (
      <Alert variant="destructive" className="space-y-3">
        <p>Terjadi kesalahan saat menampilkan halaman ini. Muat ulang halaman untuk mencoba lagi.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Muat ulang halaman
        </Button>
      </Alert>
    )
  }
}
