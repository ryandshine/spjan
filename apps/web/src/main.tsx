import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import App from '@/App'
import { Toaster } from '@/components/ui/sonner'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

// Data router diperlukan agar halaman dapat memblokir perpindahan saat ada perubahan belum disimpan (useBlocker).
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <>
        <App />
        <Toaster />
      </>
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
