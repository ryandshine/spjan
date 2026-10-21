import type {
  HasilEkstraksiUndangan,
  BerkasDto,
  BukaKunciPayload,
  BuatPenggunaPayload,
  GantiPasswordPayload,
  LogAuditDto,
  PenggunaDto,
  PenggunaSesiDto,
  SampahDto,
  UbahPenggunaPayload,
  HasilSuratTugasDto,
  JenisBerkas,
  LaporanIsi,
  ModelAiDto,
  ModelAiPayload,
  NaskahStDto,
  NaskahStPayload,
  NaskahStRingkasDto,
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

export interface LaporanDto {
  isi: LaporanIsi | null
  updatedAt: string | null
}

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

/** Galat standar API dari badan respons yang gagal; `cadangan` dipakai bila server tidak mengirim pesan. */
function galatDariRespons(res: Response, data: unknown, cadangan = res.statusText): ApiError {
  const d = (data ?? {}) as { error?: string; pesan?: string; rincian?: unknown }
  return new ApiError(res.status, d.error ?? 'GALAT', d.pesan ?? cadangan, d.rincian)
}

/** Baca badan JSON dari respons; lempar `ApiError` bila statusnya gagal. */
async function bacaJson<T>(res: Response, cadangan?: string): Promise<T> {
  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) throw galatDariRespons(res, data, cadangan)
  return data as T
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return bacaJson<T>(res)
}

/** Kirim satu berkas sebagai multipart (kolom `file`). */
async function unggahBerkas<T>(url: string, file: File, cadanganGerbang?: string): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(url, { method: 'POST', credentials: 'same-origin', body: form })
  const galatGerbang = [502, 503, 504].includes(res.status)
  return bacaJson<T>(res, galatGerbang ? cadanganGerbang : undefined)
}

/** Ambil badan respons sebagai Blob (unduhan berkas). */
async function requestBlob(method: string, url: string, body?: unknown): Promise<Blob> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw galatDariRespons(res, await res.json().catch(() => null), 'Gagal mengunduh berkas')
  return res.blob()
}

export type SessionUser = PenggunaSesiDto

export const api = {
  me: () => request<SessionUser>('GET', '/api/auth/me'),
  login: (username: string, password: string) => request<SessionUser>('POST', '/api/auth/login', { username, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  gantiPassword: (p: GantiPasswordPayload) => request<void>('POST', '/api/auth/ganti-password', p),

  pengguna: {
    list: () => request<PenggunaDto[]>('GET', '/api/admin/pengguna'),
    create: (p: BuatPenggunaPayload) => request<PenggunaDto>('POST', '/api/admin/pengguna', p),
    update: (id: number, p: UbahPenggunaPayload) => request<PenggunaDto>('PATCH', `/api/admin/pengguna/${id}`, p),
    resetPassword: (id: number, password: string, passwordAdmin: string) => request<void>('POST', `/api/admin/pengguna/${id}/reset-password`, { password, passwordAdmin }),
  },
  audit: (stId?: number) => request<LogAuditDto[]>('GET', stId !== undefined ? `/api/admin/audit?stId=${stId}` : '/api/admin/audit'),

  sampah: {
    list: () => request<SampahDto>('GET', '/api/sampah'),
    pulihkanSt: (id: number) => request<void>('POST', `/api/sampah/surat-tugas/${id}/pulihkan`),
    hapusPermanenSt: (id: number, password: string) => request<void>('DELETE', `/api/sampah/surat-tugas/${id}`, { password }),
    pulihkanBerkas: (id: number) => request<void>('POST', `/api/sampah/berkas/${id}/pulihkan`),
    hapusPermanenBerkas: (id: number, password: string) => request<void>('DELETE', `/api/sampah/berkas/${id}`, { password }),
  },

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
    unggah: (
      file: File,
      stId?: number,
      opsi?: { jenis?: JenisBerkas; keterangan?: string },
    ): Promise<{ berkas: BerkasDto; duplikat: boolean }> => {
      const params = new URLSearchParams()
      if (stId !== undefined) params.set('stId', String(stId))
      if (opsi?.jenis) params.set('jenis', opsi.jenis)
      if (opsi?.keterangan) params.set('keterangan', opsi.keterangan)
      const qs = params.toString()
      return unggahBerkas(qs ? `/api/berkas?${qs}` : '/api/berkas', file)
    },
    get: (id: number) => request<BerkasDto>('GET', `/api/berkas/${id}`),
    list: (stId?: number) => request<BerkasDto[]>('GET', stId !== undefined ? `/api/berkas?stId=${stId}` : '/api/berkas'),
    update: (id: number, payload: UpdateBerkasPayload) => request<BerkasDto>('PATCH', `/api/berkas/${id}`, payload),
    hapus: (id: number, password: string) => request<void>('DELETE', `/api/berkas/${id}`, { password }),
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
    remove: (id: number, password: string) => request<void>('DELETE', `/api/surat-tugas/${id}`, { password }),
    kunci: (id: number) => request<SuratTugasDto>('POST', `/api/surat-tugas/${id}/kunci`),
    bukaKunci: (id: number, p: BukaKunciPayload) => request<SuratTugasDto>('POST', `/api/surat-tugas/${id}/buka-kunci`, p),
    hasil: (id: number) => request<HasilSuratTugasDto>('GET', `/api/surat-tugas/${id}/hasil`),
    usulanHotel: (id: number) => request<UsulanHotelItem[]>('GET', `/api/surat-tugas/${id}/usulan-hotel`),
    usulanTransport: (id: number) => request<UsulanTransportItem[]>('GET', `/api/surat-tugas/${id}/usulan-transport`),
    laporan: {
      get: (id: number) => request<LaporanDto>('GET', `/api/surat-tugas/${id}/laporan`),
      simpan: (id: number, isi: LaporanIsi) => request<LaporanDto>('PUT', `/api/surat-tugas/${id}/laporan`, isi),
    },
  },

  naskahSt: {
    list: () => request<NaskahStRingkasDto[]>('GET', '/api/naskah-st'),
    get: (id: number) => request<NaskahStDto>('GET', `/api/naskah-st/${id}`),
    create: (p: NaskahStPayload) => request<NaskahStDto>('POST', '/api/naskah-st', p),
    update: (id: number, p: NaskahStPayload) => request<NaskahStDto>('PUT', `/api/naskah-st/${id}`, p),
    remove: (id: number) => request<void>('DELETE', `/api/naskah-st/${id}`),
    buatSpj: (id: number) => request<{ spjId: number }>('POST', `/api/naskah-st/${id}/buat-spj`),
    ekstrakUndangan: (file: File): Promise<{ model: string; hasil: HasilEkstraksiUndangan }> =>
      unggahBerkas('/api/naskah-st/ekstrak-undangan', file, 'Server tidak merespons. Coba lagi beberapa saat lagi.'),
    /** DOCX naskah: yang tersimpan bila `id` ada, selain itu dibuat dari isian `payload` (pratinjau). */
    docx: (payload: NaskahStPayload, id?: number): Promise<Blob> =>
      id !== undefined ? requestBlob('GET', `/api/naskah-st/${id}/docx`) : requestBlob('POST', '/api/naskah-st/preview-docx', payload),
  },
}

