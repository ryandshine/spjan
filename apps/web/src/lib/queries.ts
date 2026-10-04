import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ModelAiPayload, PegawaiPayload, PengaturanPayload, StatusKode, StatusKonfigurasi, SuratTugasPayload, UpdateUsulanBerkasPayload } from '@spjan/shared'

import { api, ApiError } from '@/lib/api'

export const keys = {
  me: ['me'] as const,
  pegawai: (aktif: boolean) => ['pegawai', aktif] as const,
  pengaturan: ['pengaturan'] as const,
  modelAi: ['model-ai'] as const,
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

export function useModelAi() {
  return useQuery({ queryKey: keys.modelAi, queryFn: api.modelAi.get })
}

export function useSimpanModelAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: ModelAiPayload) => api.modelAi.save(p),
    onSuccess: (data) => qc.setQueryData(keys.modelAi, data),
  })
}

export function useUjiModelAi() {
  return useMutation({ mutationFn: (jenis: 'teks' | 'gambar') => api.modelAi.uji(jenis) })
}

export function useBerkas(id: number | null) {
  return useQuery({
    queryKey: ['berkas', id] as const,
    queryFn: () => api.berkas.get(id as number),
    enabled: id !== null,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 1500
      const status = data.ekstraksi?.status
      if (status === 'antre' || status === 'berjalan') return 1500
      return false
    },
  })
}

export function useUsulanSt(berkasId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['berkas', berkasId, 'usulan-st'] as const,
    queryFn: () => api.berkas.usulanSt(berkasId as number),
    enabled: berkasId !== null && enabled,
    retry: (count, error) => {
      if (error instanceof ApiError && (error.code === 'EKSTRAKSI_BELUM_SELESAI' || error.code === 'BELUM_DIEKSTRAK')) {
        return true
      }
      return count < 3
    },
    retryDelay: 2000,
  })
}

export function useBuatStDariBerkas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { berkasId: number; payload: SuratTugasPayload }) =>
      api.suratTugas.create(v.payload, v.berkasId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['st'] }),
  })
}

export function useDaftarBerkas(stId: number | null) {
  return useQuery({
    queryKey: ['berkas', 'list', stId] as const,
    queryFn: () => api.berkas.list(stId ?? undefined),
    enabled: stId !== null,
    refetchInterval: (query) => {
      const list = query.state.data
      if (!list) return false
      const adaProses = list.some((b) => b.ekstraksi?.status === 'antre' || b.ekstraksi?.status === 'berjalan')
      return adaProses ? 2000 : false
    },
  })
}

export function useUsulanHotelSt(stId: number | null) {
  return useQuery({
    queryKey: ['st', stId, 'usulan-hotel'] as const,
    queryFn: () => api.suratTugas.usulanHotel(stId as number),
    enabled: stId !== null,
  })
}

export function useUsulanTransportSt(stId: number | null) {
  return useQuery({
    queryKey: ['st', stId, 'usulan-transport'] as const,
    queryFn: () => api.suratTugas.usulanTransport(stId as number),
    enabled: stId !== null,
  })
}

export function useUpdateUsulanBerkas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; payload: UpdateUsulanBerkasPayload }) =>
      api.berkas.updateUsulan(v.id, v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st'] })
    },
  })
}

export function useHapusBerkas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.berkas.hapus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st'] })
    },
  })
}

export function useUlangiEkstraksiBerkas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.berkas.ulang(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['berkas'] })
      qc.invalidateQueries({ queryKey: ['st'] })
    },
  })
}

