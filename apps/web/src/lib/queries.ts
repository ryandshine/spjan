import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PegawaiPayload, PengaturanPayload, StatusKode, StatusKonfigurasi, SuratTugasPayload } from '@spjan/shared'

import { api, ApiError } from '@/lib/api'

export const keys = {
  me: ['me'] as const,
  pegawai: (aktif: boolean) => ['pegawai', aktif] as const,
  pengaturan: ['pengaturan'] as const,
  sbmVersi: ['sbm', 'versi'] as const,
  sbm: (id: number) => ['sbm', id] as const,
  stList: ['st', 'list'] as const,
  st: (id: number) => ['st', id] as const,
  hasil: (id: number) => ['st', id, 'hasil'] as const,
}

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: api.me,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { username: string; password: string }) => api.login(v.username, v.password),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => qc.clear(),
  })
}

export function usePegawai(aktif: boolean) {
  return useQuery({ queryKey: keys.pegawai(aktif), queryFn: () => api.pegawai.list(aktif) })
}

export function usePegawaiMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['pegawai'] })
  return {
    buat: useMutation({ mutationFn: (p: PegawaiPayload) => api.pegawai.create(p), onSuccess: refresh }),
    ubah: useMutation({
      mutationFn: (v: { id: number; data: Partial<PegawaiPayload> }) => api.pegawai.update(v.id, v.data),
      onSuccess: refresh,
    }),
    nonaktifkan: useMutation({ mutationFn: (id: number) => api.pegawai.nonaktifkan(id), onSuccess: refresh }),
  }
}

export function usePengaturan() {
  return useQuery({ queryKey: keys.pengaturan, queryFn: api.pengaturan.get })
}

export function useSimpanPengaturan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: PengaturanPayload) => api.pengaturan.save(p),
    onSuccess: (data) => qc.setQueryData(keys.pengaturan, data),
  })
}

export function useVersiSbm() {
  return useQuery({ queryKey: keys.sbmVersi, queryFn: api.sbm.versi })
}

export function useSbm(id: number | undefined) {
  return useQuery({
    queryKey: keys.sbm(id ?? 0),
    queryFn: () => api.sbm.detail(id as number),
    enabled: id !== undefined,
    staleTime: 5 * 60_000,
  })
}

export function useSimpanStatusSbm(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (k: Record<StatusKode, StatusKonfigurasi>) => api.sbm.simpanStatus(id, k),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sbm(id) }),
  })
}

export function useDaftarSuratTugas() {
  return useQuery({ queryKey: keys.stList, queryFn: api.suratTugas.list })
}

export function useHapusSuratTugas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.suratTugas.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['st'] }),
  })
}

export function useSuratTugas(id: number | undefined) {
  return useQuery({
    queryKey: keys.st(id ?? 0),
    queryFn: () => api.suratTugas.get(id as number),
    enabled: id !== undefined,
  })
}

export function useSimpanSuratTugas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number | null; payload: SuratTugasPayload }) =>
      v.id === null ? api.suratTugas.create(v.payload) : api.suratTugas.replace(v.id, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['st'] }),
  })
}

export function useHasilSuratTugas(id: number | undefined) {
  return useQuery({
    queryKey: keys.hasil(id ?? 0),
    queryFn: () => api.suratTugas.hasil(id as number),
    enabled: id !== undefined,
    staleTime: 0,
  })
}
