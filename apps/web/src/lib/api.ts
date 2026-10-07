import type {
  BerkasDto,
  HasilSuratTugasDto,
  JenisBerkas,
  ModelAiDto,
  ModelAiPayload,
  PegawaiDto,
  PegawaiPayload,
  PengaturanPayload,
  SbmDetailDto,
  SbmVersiDto,
  StatusKode,
  StatusKonfigurasi,
  SuratTugasDto,
  SuratTugasPayload,
  SuratTugasRingkasDto,
  UjiModelHasil,
  UpdateBerkasPayload,
  UpdateUsulanBerkasPayload,
  UsulanHotelItem,
  UsulanStHasil,
  UsulanTransportItem,
} from '@spjan/shared'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly rincian?: unknown

  constructor(status: number, code: string, message: string, rincian?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.rincian = rincian
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; pesan?: string; rincian?: unknown }
    throw new ApiError(res.status, d.error ?? 'GALAT', d.pesan ?? res.statusText, d.rincian)
  }
  return data as T
}

export interface SessionUser {
  id: number
  username: string
}

export const api = {
  me: () => request<SessionUser>('GET', '/api/auth/me'),
  login: (username: string, password: string) => request<SessionUser>('POST', '/api/auth/login', { username, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),

  pegawai: {
    list: (aktif = true) => request<PegawaiDto[]>('GET', `/api/pegawai?aktif=${aktif}`),
    create: (p: PegawaiPayload) => request<PegawaiDto>('POST', '/api/pegawai', p),
    update: (id: number, p: Partial<PegawaiPayload>) => request<PegawaiDto>('PATCH', `/api/pegawai/${id}`, p),
    nonaktifkan: (id: number) => request<void>('DELETE', `/api/pegawai/${id}`),
  },

  pengaturan: {
    get: () => request<PengaturanPayload>('GET', '/api/pengaturan'),
    save: (p: PengaturanPayload) => request<PengaturanPayload>('PUT', '/api/pengaturan', p),
  },

  modelAi: {
    get: () => request<ModelAiDto>('GET', '/api/model-ai'),
    save: (p: ModelAiPayload) => request<ModelAiDto>('PUT', '/api/model-ai', p),
    uji: (jenis: 'teks' | 'gambar') => request<UjiModelHasil>('POST', '/api/model-ai/uji', { jenis }),
  },

  sbm: {
    versi: () => request<SbmVersiDto[]>('GET', '/api/sbm/versi'),
    detail: (id: number) => request<SbmDetailDto>('GET', `/api/sbm/versi/${id}`),
    simpanStatus: (id: number, konfigurasi: Record<StatusKode, StatusKonfigurasi>) =>
      request<Record<StatusKode, StatusKonfigurasi>>('PATCH', `/api/sbm/versi/${id}/status-konfigurasi`, konfigurasi),
  },

  berkas: {
    unggah: async (
      file: File,
      stId?: number,
      opsi?: { jenis?: JenisBerkas; keterangan?: string },
    ): Promise<{ berkas: BerkasDto; duplikat: boolean }> => {
      const form = new FormData()
      form.append('file', file)
      const params = new URLSearchParams()
      if (stId !== undefined) params.set('stId', String(stId))
      if (opsi?.jenis) params.set('jenis', opsi.jenis)
      if (opsi?.keterangan) params.set('keterangan', opsi.keterangan)
      const qs = params.toString()
      const url = qs ? `/api/berkas?${qs}` : '/api/berkas'
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      })
      const data: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const d = (data ?? {}) as { error?: string; pesan?: string; rincian?: unknown }
        throw new ApiError(res.status, d.error ?? 'GALAT', d.pesan ?? res.statusText, d.rincian)
      }
      return data as { berkas: BerkasDto; duplikat: boolean }
    },
    get: (id: number) => request<BerkasDto>('GET', `/api/berkas/${id}`),
    list: (stId?: number) => request<BerkasDto[]>('GET', stId !== undefined ? `/api/berkas?stId=${stId}` : '/api/berkas'),
    update: (id: number, payload: UpdateBerkasPayload) => request<BerkasDto>('PATCH', `/api/berkas/${id}`, payload),
    hapus: (id: number) => request<void>('DELETE', `/api/berkas/${id}`),
    ulang: (id: number) => request<BerkasDto>('POST', `/api/berkas/${id}/ulang`),
    updateUsulan: (id: number, payload: UpdateUsulanBerkasPayload) =>
      request<BerkasDto>('PATCH', `/api/berkas/${id}/usulan-status`, payload),
    usulanSt: (id: number) => request<{ berkas: BerkasDto; usulan: UsulanStHasil }>('GET', `/api/berkas/${id}/usulan-st`),
  },

  suratTugas: {
    list: () => request<SuratTugasRingkasDto[]>('GET', '/api/surat-tugas'),
    get: (id: number) => request<SuratTugasDto>('GET', `/api/surat-tugas/${id}`),
    create: (p: SuratTugasPayload, berkasId?: number) =>
      request<SuratTugasDto>('POST', berkasId ? `/api/surat-tugas?berkasId=${berkasId}` : '/api/surat-tugas', p),
    replace: (id: number, p: SuratTugasPayload) => request<SuratTugasDto>('PUT', `/api/surat-tugas/${id}`, p),
    remove: (id: number) => request<void>('DELETE', `/api/surat-tugas/${id}`),
    hasil: (id: number) => request<HasilSuratTugasDto>('GET', `/api/surat-tugas/${id}/hasil`),
    usulanHotel: (id: number) => request<UsulanHotelItem[]>('GET', `/api/surat-tugas/${id}/usulan-hotel`),
    usulanTransport: (id: number) => request<UsulanTransportItem[]>('GET', `/api/surat-tugas/${id}/usulan-transport`),
  },
}
