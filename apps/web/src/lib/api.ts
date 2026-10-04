import type {
  HasilSuratTugasDto,
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

  sbm: {
    versi: () => request<SbmVersiDto[]>('GET', '/api/sbm/versi'),
    detail: (id: number) => request<SbmDetailDto>('GET', `/api/sbm/versi/${id}`),
    simpanStatus: (id: number, konfigurasi: Record<StatusKode, StatusKonfigurasi>) =>
      request<Record<StatusKode, StatusKonfigurasi>>('PATCH', `/api/sbm/versi/${id}/status-konfigurasi`, konfigurasi),
  },

  suratTugas: {
    list: () => request<SuratTugasRingkasDto[]>('GET', '/api/surat-tugas'),
    get: (id: number) => request<SuratTugasDto>('GET', `/api/surat-tugas/${id}`),
    create: (p: SuratTugasPayload) => request<SuratTugasDto>('POST', '/api/surat-tugas', p),
    replace: (id: number, p: SuratTugasPayload) => request<SuratTugasDto>('PUT', `/api/surat-tugas/${id}`, p),
    remove: (id: number) => request<void>('DELETE', `/api/surat-tugas/${id}`),
    hasil: (id: number) => request<HasilSuratTugasDto>('GET', `/api/surat-tugas/${id}/hasil`),
  },
}
