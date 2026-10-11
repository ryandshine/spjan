import { createContext, useContext } from 'react'

/**
 * Elemen kosong di sidebar aplikasi tempat halaman memasang menu kontekstualnya (lewat portal),
 * misalnya langkah-langkah editor surat tugas. Null bila sidebar belum terpasang.
 */
export const SlotSidebarContext = createContext<HTMLElement | null>(null)

export const useSlotSidebar = () => useContext(SlotSidebarContext)
