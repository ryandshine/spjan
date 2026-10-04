# SPJAN Tahap 1C-1: Fondasi Web, Login, dan Data Induk - Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat `apps/web` (React + Vite) dengan login, kerangka navigasi, dan halaman data induk (Surat Tugas daftar, Pegawai, Pengaturan, Tabel SBM) yang terhubung ke `apps/api`.

**Architecture:** SPA React 19 dengan react-router-dom 7, TanStack Query untuk data server, komponen UI bergaya shadcn yang ditulis tangan (Tailwind 4, Radix Dialog), klien API tipis di `lib/api.ts` yang memakai DTO dari `@spjan/shared`. Dev server Vite meneruskan `/api` ke apps/api agar cookie sesi satu origin.

**Tech Stack:** React ^19.2, Vite ^8, Tailwind ^4.2, TypeScript ~6.0.2, @tanstack/react-query ^5.97, react-router-dom ^7.14, radix-ui ^1.4, lucide-react, sonner, class-variance-authority, eslint ^9.

**Spec:** `docs/superpowers/specs/2026-10-04-spjan-design.md` (bagian 3, 7, 8); rencana sebelumnya `2026-10-04-spjan-1a-shared.md` dan `2026-10-04-spjan-1b-api.md` (sudah di `main`).

## Cakupan rencana ini dan rencana berikutnya

1C dibagi tiga rencana. Rencana ini (1C-1) menghasilkan aplikasi yang bisa dipakai untuk login dan mengelola data induk. Rute `/st/baru` dan `/st/:id` masih halaman "segera hadir".
- 1C-2: editor surat tugas (pelaksana, etape, biaya) dengan hitungan langsung memakai `hitungSpj`.
- 1C-3: dokumen PDF (SPTB, Rincian, Kuitansi) dengan `@react-pdf/renderer`, pratinjau, dan unduh.
- 1D: deploy Dokploy.

## Global Constraints

- TypeScript `strict` + `noUncheckedIndexedAccess`; `verbatimModuleSyntax`; impor alias `@/` untuk `apps/web/src`, `@spjan/shared` dipetakan ke `packages/shared/src/index.ts` (Vite alias + tsconfig paths).
- Semua teks antarmuka berbahasa Indonesia; angka rupiah memakai titik (`rupiah()` dari `lib/format.ts`).
- Tidak ada tes frontend (konvensi proyek); verifikasi: `tsc -b`, `eslint .`, `vite build`, dan pemeriksaan di peramban.
- Cookie sesi tidak pernah dibaca dari JavaScript (httpOnly); semua `fetch` memakai `credentials: 'same-origin'`.
- Respons API tidak pernah di-cache oleh service worker (tidak ada PWA/service worker pada tahap ini).
- Validasi formulir memakai skema zod dari `@spjan/shared` yang sama dengan API.
- Jangan commit, push, atau deploy tanpa persetujuan eksplisit pengguna di setiap gerbang. Pesan commit Conventional Commits dengan trailer `Co-Authored-By` dan `Claude-Session`.

## Struktur berkas

```
packages/shared/src/schemas.ts                 + SbmDetailDto, SuratTugasRingkasDto, HasilSuratTugasDto
apps/web/package.json, tsconfig*.json, eslint.config.js, vite.config.ts, index.html, public/favicon.svg
apps/web/src/index.css, main.tsx, App.tsx
apps/web/src/lib/{utils,api,queries,format}.ts
apps/web/src/components/ui/{button,input,select,label,card,table,badge,alert,dialog,sonner,field}.tsx
apps/web/src/components/{app-shell,require-auth,page-header,data-table}.tsx
apps/web/src/pages/{login,placeholder,pegawai,st-list,pengaturan,sbm}.tsx
```

## Pemeriksaan peramban (dipakai di beberapa tugas)

Siapkan sekali: `npm run db:up` lalu `docker exec spjan-dev-postgres psql -U postgres -c "drop database if exists spjan_dev" -c "create database spjan_dev"`.
Jalankan API dan web (dua terminal, dari root):
```bash
cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:55432/spjan_dev PORT=3001 ADMIN_USERNAME=admin ADMIN_PASSWORD=sandi-dev-12345 npx tsx src/server.ts
cd apps/web && npx vite --port 5173
```
Buka http://localhost:5173, masuk dengan `admin` / `sandi-dev-12345`. Hentikan kedua proses setelah selesai.

---

### Task 1: DTO respons bersama di @spjan/shared

**Files:**
- Modify: `packages/shared/src/schemas.ts`, `apps/api/src/repositories/surat-tugas.ts`

**Interfaces:**
- Consumes: `Sbm`, `SpjHasil` (types.ts), `SuratTugasDto`, `PengaturanPayload` (schemas.ts).
- Produces: `SbmDetailDto { versi: SbmVersiDto; data: Sbm }`, `SuratTugasRingkasDto { id; nomor; tanggal; jumlahPelaksana; updatedAt }`, `HasilSuratTugasDto { suratTugas: SuratTugasDto; pengaturan: PengaturanPayload; hasil: SpjHasil }`; API memakai `SuratTugasRingkasDto` (menggantikan antarmuka lokal).

- [ ] **Step 1: Ubah schemas.ts**

Ganti impor tipe di bagian atas `packages/shared/src/schemas.ts`:
```ts
import type { Sbm, SpjHasil, SpjInput } from "./types.js";
```
dan tambahkan setelah `SbmVersiDto`:
```ts
export interface SbmDetailDto {
  versi: SbmVersiDto;
  data: Sbm;
}

export interface SuratTugasRingkasDto {
  id: number;
  nomor: string;
  tanggal: string;
  jumlahPelaksana: number;
  updatedAt: string;
}

/** Respons GET /api/surat-tugas/:id/hasil */
export interface HasilSuratTugasDto {
  suratTugas: SuratTugasDto;
  pengaturan: PengaturanPayload;
  hasil: SpjHasil;
}
```

- [ ] **Step 2: Ubah repositori API**

Di `apps/api/src/repositories/surat-tugas.ts`: tambahkan `SuratTugasRingkasDto` pada impor dari `@spjan/shared`, hapus `interface SuratTugasRingkas {...}`, dan ubah tipe kembalian `listSuratTugas` menjadi `Promise<SuratTugasRingkasDto[]>`.

- [ ] **Step 3: Jalankan gerbang**

Run: `npm run build -w @spjan/shared && npm run lint -w api && npm run test -w api`
Expected: build dan lint tanpa galat; `Tests  21 passed (21)`.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add packages/shared/src/schemas.ts apps/api/src/repositories/surat-tugas.ts
git commit -m "feat(shared): DTO respons surat tugas, SBM, dan hasil

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 2: Kerangka apps/web, komponen UI, klien API, kerangka navigasi, dan login

**Files:**
- Create: semua berkas pada daftar di Step 1 (konfigurasi, `lib/`, `components/ui/`, kerangka, `pages/login.tsx`, `pages/placeholder.tsx`, `main.tsx`, `App.tsx`)

**Interfaces:**
- Consumes: DTO dan skema dari `@spjan/shared` (Task 1); kontrak API rencana 1B.
- Produces: `api` (objek klien: `me`, `login`, `logout`, `pegawai.*`, `pengaturan.*`, `sbm.*`, `suratTugas.*`), `ApiError { status, code, message, rincian }`, hook `useMe/useLogin/useLogout/usePegawai/usePegawaiMutations/usePengaturan/useSimpanPengaturan/useVersiSbm/useSbm/useSimpanStatusSbm/useDaftarSuratTugas/useHapusSuratTugas` dan `keys`; komponen `AppShell`, `RequireAuth`, `PageHeader`, `Field`, `Button/buttonVariants`, `Input`, `Select`, `Label`, `Card*`, `Table*`, `Badge`, `Alert`, `Dialog*`, `Toaster`; `rupiah(n)`, `tanggalPendek(iso)`, `waktuPendek(iso)`, `pesanGalat(error)`; `SegeraPage({judul})`, `NotFoundPage`.

- [ ] **Step 1: Buat semua berkas kerangka**

`apps/web/package.json`:
```json
{
  "name": "web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@spjan/shared": "*",
    "@tanstack/react-query": "^5.97.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.8.0",
    "radix-ui": "^1.4.3",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/vite": "^4.2.2",
    "@types/node": "^24.12.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "tailwindcss": "^4.2.2",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.58.0",
    "vite": "^8.0.4"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`apps/web/tsconfig.app.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "types": ["vite/client"],
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"],
      "@spjan/shared": ["../../packages/shared/src/index.ts"]
    },
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`apps/web/tsconfig.node.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "types": ["node"],
    "lib": ["ES2023"],
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

`apps/web/eslint.config.js`:
```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
```

`apps/web/vite.config.ts`:
```ts
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Pengembangan: /api diteruskan ke apps/api (default port 3001) agar cookie sesi satu origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@spjan/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: false },
    },
  },
})
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>SPJAN - SPJ Perjalanan Dinas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/public/favicon.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#007a50"/><text x="16" y="21.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#fff">SJ</text></svg>
```

`apps/web/src/index.css`:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.5rem;
  --background: oklch(0.985 0.003 150);
  --foreground: oklch(0.22 0.015 160);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.015 160);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.015 160);
  --primary: oklch(0.5 0.115 160);
  --primary-foreground: oklch(0.99 0.005 150);
  --secondary: oklch(0.955 0.012 160);
  --secondary-foreground: oklch(0.3 0.04 160);
  --muted: oklch(0.96 0.006 150);
  --muted-foreground: oklch(0.5 0.015 160);
  --accent: oklch(0.94 0.03 160);
  --accent-foreground: oklch(0.3 0.06 160);
  --destructive: oklch(0.55 0.22 27);
  --border: oklch(0.91 0.008 150);
  --input: oklch(0.88 0.01 150);
  --ring: oklch(0.5 0.115 160);
  --success: oklch(0.52 0.13 150);
  --warning: oklch(0.7 0.15 75);
  --sidebar: oklch(0.975 0.008 155);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-sidebar: var(--sidebar);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

`apps/web/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`apps/web/src/lib/api.ts`:
```ts
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
```

`apps/web/src/lib/queries.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PegawaiPayload, PengaturanPayload, StatusKode, StatusKonfigurasi } from '@spjan/shared'

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
```

`apps/web/src/lib/format.ts`:
```ts
import { formatAngka, parseTanggal } from '@spjan/shared'

export const rupiah = (n: number) => `Rp${formatAngka(n)}`

/** "2026-09-08" -> "08/09/2026" */
export function tanggalPendek(iso: string | null | undefined): string {
  const t = parseTanggal(iso)
  if (!t) return '-'
  return `${String(t.d).padStart(2, '0')}/${String(t.m).padStart(2, '0')}/${t.y}`
}

/** Waktu ISO dari server -> "08/09/2026 14.05" (zona waktu peramban). */
export function waktuPendek(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}.${p(d.getMinutes())}`
}

export function pesanGalat(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan.'
}
```

`apps/web/src/components/ui/button.tsx`:
```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border bg-card hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 gap-1.5 px-3 text-[13px]',
        lg: 'h-10 px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
```

`apps/web/src/components/ui/input.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
```

`apps/web/src/components/ui/select.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

/** Select bawaan peramban dengan gaya yang sama seperti Input. */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Select }
```

`apps/web/src/components/ui/label.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm leading-none font-medium select-none', className)} {...props} />
}

export { Label }
```

`apps/web/src/components/ui/card.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)} {...props} />
}
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-5 pt-5', className)} {...props} />
}
function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-base leading-none font-semibold', className)} {...props} />
}
function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 py-5', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

`apps/web/src/components/ui/table.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
}
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn('h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground uppercase tracking-wide', className)}
      {...props}
    />
  )
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
```

`apps/web/src/components/ui/badge.tsx`:
```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary/10 text-primary',
      muted: 'border-transparent bg-muted text-muted-foreground',
      success: 'border-transparent bg-success/15 text-success',
      warning: 'border-transparent bg-warning/20 text-[oklch(0.45_0.1_70)]',
      destructive: 'border-transparent bg-destructive/10 text-destructive',
      outline: 'text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
```

`apps/web/src/components/ui/alert.tsx`:
```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-lg border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'bg-card',
      destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
      warning: 'border-warning/40 bg-warning/10',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export { Alert }
```

`apps/web/src/components/ui/dialog.tsx`:
```tsx
import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
          <XIcon className="size-4" />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg leading-none font-semibold', className)} {...props} />
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
```

`apps/web/src/components/ui/sonner.tsx`:
```tsx
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return <Sonner position="top-right" richColors closeButton {...props} />
}

export { Toaster }
```

`apps/web/src/components/ui/field.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/** Label + kontrol + pesan galat dalam satu blok. */
function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export { Field }
```

`apps/web/src/components/app-shell.tsx`:
```tsx
import { BookOpenIcon, FileTextIcon, LogOutIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useLogout, useMe } from '@/lib/queries'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Surat Tugas', icon: FileTextIcon, end: true },
  { to: '/pegawai', label: 'Pegawai', icon: UsersIcon, end: false },
  { to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon, end: false },
  { to: '/sbm', label: 'Tabel SBM', icon: BookOpenIcon, end: false },
]

export function AppShell() {
  const navigate = useNavigate()
  const me = useMe()
  const logout = useLogout()

  async function keluar() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b bg-sidebar md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">SJ</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">SPJAN</p>
            <p className="text-xs text-muted-foreground">SPJ Perjalanan Dinas</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center justify-between gap-2 border-t px-4 py-3 md:flex">
          <span className="truncate text-xs text-muted-foreground">{me.data?.username}</span>
          <Button variant="ghost" size="sm" onClick={keluar} disabled={logout.isPending}>
            <LogOutIcon /> Keluar
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
```

`apps/web/src/components/require-auth.tsx`:
```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ApiError } from '@/lib/api'
import { useMe } from '@/lib/queries'

export function RequireAuth() {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Memuat...</div>
  }
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Navigate to="/login" replace state={{ dari: location.pathname }} />
    }
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-destructive">
        Tidak dapat menghubungi server. Muat ulang halaman ini.
      </div>
    )
  }
  return <Outlet />
}
```

`apps/web/src/components/page-header.tsx`:
```tsx
import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import App from '@/App'
import { Toaster } from '@/components/ui/sonner'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

`apps/web/src/pages/placeholder.tsx`:
```tsx
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function SegeraPage({ judul }: { judul: string }) {
  return (
    <div>
      <PageHeader title={judul} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Halaman ini dikerjakan pada tahap berikutnya (editor surat tugas dan dokumen).
          <div className="mt-4">
            <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Kembali ke daftar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Halaman tidak ditemukan" />
      <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Ke beranda
      </Link>
    </div>
  )
}
```

`apps/web/src/pages/login.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useLogin, useMe } from '@/lib/queries'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const me = useMe()
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const dari = (location.state as { dari?: string } | null)?.dari ?? '/'

  if (me.data) return <Navigate to={dari} replace />

  async function kirim(e: FormEvent) {
    e.preventDefault()
    try {
      await login.mutateAsync({ username: username.trim(), password })
      navigate(dari, { replace: true })
    } catch {
      /* pesan galat ditampilkan dari login.error */
    }
  }

  const galat =
    login.error instanceof ApiError
      ? login.error.status === 429
        ? 'Terlalu banyak percobaan. Coba lagi sebentar lagi.'
        : login.error.message
      : login.error
        ? 'Tidak dapat menghubungi server.'
        : null

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">SJ</span>
          <div className="leading-tight">
            <p className="text-lg font-semibold">SPJAN</p>
            <p className="text-xs text-muted-foreground">SPJ Perjalanan Dinas</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>Gunakan akun yang sudah disediakan.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={kirim} className="grid gap-4">
              {galat ? <Alert variant="destructive">{galat}</Alert> : null}
              <Field label="Nama pengguna" htmlFor="username">
                <Input id="username" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label="Kata sandi" htmlFor="password">
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" disabled={login.isPending || !username || !password}>
                {login.isPending ? 'Memeriksa...' : 'Masuk'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

`apps/web/src/App.tsx` (versi tugas ini):
```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SegeraPage judul="Surat Tugas" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Pasang dependensi**

Run (dari root): `npm install`
Expected: selesai tanpa galat; `node_modules/vite` dan `node_modules/react` ada.

- [ ] **Step 3: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat; `dist/index.html` dan `dist/assets/*.js` terbentuk (peringatan ukuran chunk > 500 kB boleh diabaikan).

- [ ] **Step 4: Periksa di peramban**

Ikuti bagian "Pemeriksaan peramban". Buka http://localhost:5173/: harus diarahkan ke `/login`; kata sandi salah menampilkan "Nama pengguna atau kata sandi salah."; kata sandi benar membawa ke halaman "Surat Tugas" (halaman segera hadir) dengan sidebar (Surat Tugas, Pegawai, Pengaturan, Tabel SBM) dan tombol Keluar yang mengembalikan ke `/login`. Atau jalankan skrip otomatis (pasang `playwright-core` di folder sementara, bukan di repo):
```js
// smoke.mjs - jalankan dari folder sementara: npm init -y && npm i playwright-core
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5173/')
await page.waitForURL('**/login')
await page.fill('#username', 'admin'); await page.fill('#password', 'sandi-dev-12345')
await page.click('button[type=submit]')
await page.waitForURL('http://localhost:5173/')
console.log('masuk:', await page.locator('h1').first().innerText())
await browser.close()
if (errors.length) { console.error(errors); process.exit(1) }
```
Expected: `masuk: Surat Tugas`, tanpa galat halaman.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add package-lock.json apps/web
git commit -m "feat(web): kerangka apps/web, komponen UI, klien API, dan login

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 3: DataTable dan halaman Pegawai

**Files:**
- Create: `apps/web/src/components/data-table.tsx`, `apps/web/src/pages/pegawai.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `usePegawai(aktif)`, `usePegawaiMutations()`, `PageHeader`, `Field`, `Dialog*`, `PegawaiPayloadSchema`, `STATUS_KODE`, `STATUS_LABEL`.
- Produces: `DataTable<T>({ kolom: Kolom<T>[], baris: T[], cari?, kosong?, maksBaris? })` dan `interface Kolom<T> { judul; sel(baris): ReactNode; teks?(baris): string; rataKanan? }` (dipakai tugas 4-6); rute `/pegawai` (tambah, ubah, nonaktifkan, aktifkan kembali; validasi NIP angka 8-30 digit; NIP kembar tampil "NIP sudah terdaftar.").

- [ ] **Step 1: Tulis DataTable**

`apps/web/src/components/data-table.tsx`:
```tsx
import { useMemo, useState, type ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Kolom<T> {
  judul: string
  sel: (baris: T) => ReactNode
  /** Teks yang dipakai pencarian; kosongkan agar kolom tidak ikut dicari. */
  teks?: (baris: T) => string
  rataKanan?: boolean
}

export function DataTable<T>({
  kolom,
  baris,
  cari = true,
  kosong = 'Tidak ada data.',
  maksBaris = 500,
}: {
  kolom: Kolom<T>[]
  baris: T[]
  cari?: boolean
  kosong?: string
  maksBaris?: number
}) {
  const [kata, setKata] = useState('')
  const tersaring = useMemo(() => {
    const q = kata.trim().toLowerCase()
    if (!q) return baris
    return baris.filter((b) => kolom.some((k) => k.teks?.(b).toLowerCase().includes(q)))
  }, [baris, kata, kolom])
  const tampil = tersaring.slice(0, maksBaris)

  return (
    <div className="grid gap-3">
      {cari ? (
        <div className="relative max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={kata} onChange={(e) => setKata(e.target.value)} placeholder="Cari..." className="pl-8" />
        </div>
      ) : null}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {kolom.map((k) => (
                <TableHead key={k.judul} className={cn(k.rataKanan && 'text-right')}>
                  {k.judul}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tampil.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={kolom.length} className="py-10 text-center text-muted-foreground">
                  {kosong}
                </TableCell>
              </TableRow>
            ) : (
              tampil.map((b, i) => (
                <TableRow key={i}>
                  {kolom.map((k) => (
                    <TableCell key={k.judul} className={cn(k.rataKanan && 'text-right tabular-nums')}>
                      {k.sel(b)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {tersaring.length > maksBaris ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan {maksBaris} dari {tersaring.length} baris. Persempit dengan kotak pencarian.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{tersaring.length} baris</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Tulis halaman Pegawai**

`apps/web/src/pages/pegawai.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, RotateCcwIcon, UserXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PegawaiPayloadSchema, STATUS_KODE, STATUS_LABEL, type PegawaiDto, type PegawaiPayload, type StatusKode } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { pesanGalat } from '@/lib/format'
import { usePegawai, usePegawaiMutations } from '@/lib/queries'

type Galat = Partial<Record<keyof PegawaiPayload, string>>

function FormPegawai({ awal, onSelesai }: { awal: PegawaiDto | null; onSelesai: () => void }) {
  const { buat, ubah } = usePegawaiMutations()
  const [nama, setNama] = useState(awal?.nama ?? '')
  const [nip, setNip] = useState(awal?.nip ?? '')
  const [jabatan, setJabatan] = useState(awal?.jabatan ?? '')
  const [status, setStatus] = useState<StatusKode | ''>(awal?.status ?? '')
  const [galat, setGalat] = useState<Galat>({})
  const [galatServer, setGalatServer] = useState<string | null>(null)
  const sibuk = buat.isPending || ubah.isPending

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setGalatServer(null)
    const data = { nama: nama.trim(), nip: nip.replace(/\s/g, ''), jabatan: jabatan.trim(), status: status || null }
    const hasil = PegawaiPayloadSchema.safeParse(data)
    if (!hasil.success) {
      const g: Galat = {}
      for (const isu of hasil.error.issues) {
        const kunci = isu.path[0] as keyof PegawaiPayload
        g[kunci] ??= isu.message
      }
      setGalat(g)
      return
    }
    setGalat({})
    try {
      if (awal) await ubah.mutateAsync({ id: awal.id, data: hasil.data })
      else await buat.mutateAsync(hasil.data)
      toast.success(awal ? 'Data pegawai diperbarui.' : 'Pegawai ditambahkan.')
      onSelesai()
    } catch (error) {
      setGalatServer(error instanceof ApiError && error.status === 409 ? 'NIP sudah terdaftar.' : pesanGalat(error))
    }
  }

  return (
    <form onSubmit={simpan} className="grid gap-4">
      {galatServer ? <Alert variant="destructive">{galatServer}</Alert> : null}
      <Field label="Nama (dengan gelar)" htmlFor="nama" error={galat.nama}>
        <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
      </Field>
      <Field label="NIP" htmlFor="nip" error={galat.nip} hint="Angka saja, tanpa spasi.">
        <Input id="nip" inputMode="numeric" value={nip} onChange={(e) => setNip(e.target.value)} />
      </Field>
      <Field label="Jabatan" htmlFor="jabatan" error={galat.jabatan}>
        <Input id="jabatan" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
      </Field>
      <Field label="Status / golongan" htmlFor="status" hint="Menentukan batas hotel, uang representasi, dan kelas tiket.">
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusKode | '')}>
          <option value="">- belum dipilih -</option>
          {STATUS_KODE.map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onSelesai}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function PegawaiPage() {
  const [tampilNonaktif, setTampilNonaktif] = useState(false)
  const daftar = usePegawai(!tampilNonaktif)
  const { ubah, nonaktifkan } = usePegawaiMutations()
  const [dialog, setDialog] = useState<{ pegawai: PegawaiDto | null } | null>(null)

  async function nonaktif(p: PegawaiDto) {
    try {
      await nonaktifkan.mutateAsync(p.id)
      toast.success(`${p.nama} dinonaktifkan.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }
  async function aktifkan(p: PegawaiDto) {
    try {
      await ubah.mutateAsync({ id: p.id, data: {} })
      toast.success(`${p.nama} diaktifkan kembali.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<PegawaiDto>[] = [
    { judul: 'Nama', teks: (p) => p.nama, sel: (p) => <span className="font-medium">{p.nama}</span> },
    { judul: 'NIP', teks: (p) => p.nip, sel: (p) => <span className="tabular-nums">{p.nip}</span> },
    { judul: 'Jabatan', teks: (p) => p.jabatan, sel: (p) => p.jabatan || '-' },
    {
      judul: 'Status',
      teks: (p) => (p.status ? STATUS_LABEL[p.status] : ''),
      sel: (p) => (p.status ? <Badge>{STATUS_LABEL[p.status]}</Badge> : <Badge variant="warning">Belum dipilih</Badge>),
    },
    {
      judul: '',
      sel: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Ubah ${p.nama}`} onClick={() => setDialog({ pegawai: p })}>
            <PencilIcon />
          </Button>
          {p.aktif ? (
            <Button variant="ghost" size="icon" aria-label={`Nonaktifkan ${p.nama}`} onClick={() => nonaktif(p)}>
              <UserXIcon className="text-destructive" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label={`Aktifkan ${p.nama}`} onClick={() => aktifkan(p)}>
              <RotateCcwIcon />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pegawai"
        description="Data pegawai disimpan permanen dan dipilih saat menyusun surat tugas."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
              Tampilkan nonaktif
            </label>
            <Button onClick={() => setDialog({ pegawai: null })}>
              <PlusIcon /> Tambah pegawai
            </Button>
          </>
        }
      />
      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat...' : tampilNonaktif ? 'Tidak ada pegawai nonaktif.' : 'Belum ada pegawai.'}
        />
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.pegawai ? 'Ubah pegawai' : 'Tambah pegawai'}</DialogTitle>
            <DialogDescription>NIP harus unik. Status dapat diubah kapan saja; surat tugas lama tidak ikut berubah.</DialogDescription>
          </DialogHeader>
          {dialog ? <FormPegawai awal={dialog.pegawai} onSelesai={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Daftarkan rute**

`apps/web/src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SegeraPage judul="Surat Tugas" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 4: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat.

- [ ] **Step 5: Periksa di peramban**

Buka `/pegawai`: tambahkan pegawai dengan NIP `12ab` (harus muncul "NIP berupa angka (8-30 digit)"), lalu NIP `197803101997031001` dengan status Eselon III (muncul toast "Pegawai ditambahkan." dan baris di tabel); coba tambah NIP yang sama lagi (muncul "NIP sudah terdaftar."); ubah jabatan; nonaktifkan, centang "Tampilkan nonaktif", lalu aktifkan kembali; kotak pencarian menyaring baris.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/components/data-table.tsx apps/web/src/pages/pegawai.tsx apps/web/src/App.tsx
git commit -m "feat(web): DataTable dan halaman Pegawai

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 4: Daftar Surat Tugas

**Files:**
- Create: `apps/web/src/pages/st-list.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `useDaftarSuratTugas()`, `useHapusSuratTugas()`, `DataTable`, `Dialog*`, `SuratTugasRingkasDto`, `tanggalPendek`, `waktuPendek`.
- Produces: rute `/` (daftar: nomor sebagai tautan ke `/st/:id`, tanggal, jumlah pelaksana, diperbarui, tombol Buka dan Hapus dengan dialog konfirmasi) dan tombol "Surat tugas baru" menuju `/st/baru`; rute `/st/baru` dan `/st/:id` tetap `SegeraPage` sampai rencana 1C-2.

- [ ] **Step 1: Tulis halaman**

`apps/web/src/pages/st-list.tsx`:
```tsx
import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pesanGalat, tanggalPendek, waktuPendek } from '@/lib/format'
import { useDaftarSuratTugas, useHapusSuratTugas } from '@/lib/queries'
import type { SuratTugasRingkasDto } from '@spjan/shared'

export default function SuratTugasListPage() {
  const daftar = useDaftarSuratTugas()
  const hapus = useHapusSuratTugas()
  const [target, setTarget] = useState<SuratTugasRingkasDto | null>(null)

  async function konfirmasiHapus() {
    if (!target) return
    try {
      await hapus.mutateAsync(target.id)
      toast.success('Surat tugas dihapus.')
      setTarget(null)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<SuratTugasRingkasDto>[] = [
    {
      judul: 'Nomor',
      teks: (b) => b.nomor,
      sel: (b) => (
        <Link to={`/st/${b.id}`} className="font-medium text-primary hover:underline">
          {b.nomor}
        </Link>
      ),
    },
    { judul: 'Tanggal', teks: (b) => tanggalPendek(b.tanggal), sel: (b) => tanggalPendek(b.tanggal) },
    { judul: 'Pelaksana', rataKanan: true, sel: (b) => b.jumlahPelaksana },
    { judul: 'Diperbarui', sel: (b) => <span className="text-muted-foreground">{waktuPendek(b.updatedAt)}</span> },
    {
      judul: '',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Link to={`/st/${b.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Buka
          </Link>
          <Button variant="ghost" size="icon" aria-label={`Hapus ${b.nomor}`} onClick={() => setTarget(b)}>
            <Trash2Icon className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Surat Tugas"
        description="Satu surat tugas berisi semua pelaksana; SPTB, Rincian, dan Kuitansi dibuat darinya."
        actions={
          <Link to="/st/baru" className={buttonVariants()}>
            <PlusIcon className="size-4" /> Surat tugas baru
          </Link>
        }
      />
      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat...' : 'Belum ada surat tugas. Mulai dengan "Surat tugas baru".'}
        />
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus surat tugas?</DialogTitle>
            <DialogDescription>
              {target?.nomor} beserta seluruh pelaksana, etape, dan biayanya akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={konfirmasiHapus} disabled={hapus.isPending}>
              {hapus.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Daftarkan rute**

`apps/web/src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<SegeraPage judul="Surat tugas baru" />} />
          <Route path="st/:id" element={<SegeraPage judul="Editor surat tugas" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 3: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat.

- [ ] **Step 4: Periksa di peramban**

Buka `/`: tampil "Belum ada surat tugas..." dan tombol "Surat tugas baru". Buat satu surat tugas lewat API (`curl` dengan cookie, `POST /api/surat-tugas` seperti di tes `stResa`), muat ulang: baris muncul; "Hapus" membuka dialog, "Batal" menutup, "Hapus" menghapus dan menampilkan toast.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/pages/st-list.tsx apps/web/src/App.tsx
git commit -m "feat(web): daftar surat tugas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 5: Halaman Pengaturan

**Files:**
- Create: `apps/web/src/pages/pengaturan.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `usePengaturan()`, `useSimpanPengaturan()`, `useVersiSbm()`, `useSbm(id)`, `PengaturanSchema`, `Field`, `Card*`.
- Produces: rute `/pengaturan` (satuan kerja, pejabat penandatangan, tempat kedudukan dengan pilihan provinsi dari SBM); validasi lewat `PengaturanSchema`; toast "Pengaturan disimpan."

- [ ] **Step 1: Tulis halaman**

`apps/web/src/pages/pengaturan.tsx`:
```tsx
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PengaturanSchema, type PengaturanPayload } from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { pesanGalat } from '@/lib/format'
import { usePengaturan, useSbm, useSimpanPengaturan, useVersiSbm } from '@/lib/queries'

type Galat = Partial<Record<keyof PengaturanPayload, string>>

function Bagian({ judul, deskripsi, children }: { judul: string; deskripsi?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{judul}</CardTitle>
        {deskripsi ? <CardDescription>{deskripsi}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid items-start gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

function FormPengaturan({ awal }: { awal: PengaturanPayload }) {
  const simpanMut = useSimpanPengaturan()
  const versi = useVersiSbm()
  const sbm = useSbm(versi.data?.[0]?.id)
  const provinsi = Object.keys(sbm.data?.data.uangHarian ?? {})
  const [form, setForm] = useState<PengaturanPayload>(awal)
  const [galat, setGalat] = useState<Galat>({})
  const [galatServer, setGalatServer] = useState<string | null>(null)

  const set = <K extends keyof PengaturanPayload>(k: K, v: PengaturanPayload[K]) => setForm((f) => ({ ...f, [k]: v }))
  const teks = (k: keyof PengaturanPayload, label: string, opsi?: { hint?: string; opsional?: boolean; kelas?: string }) => (
    <Field label={label} htmlFor={k} error={galat[k]} hint={opsi?.hint} className={opsi?.kelas}>
      <Input
        id={k}
        value={(form[k] as string | null | undefined) ?? ''}
        onChange={(e) => set(k, (opsi?.opsional && e.target.value === '' ? null : e.target.value) as never)}
      />
    </Field>
  )

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setGalatServer(null)
    const hasil = PengaturanSchema.safeParse(form)
    if (!hasil.success) {
      const g: Galat = {}
      for (const isu of hasil.error.issues) g[isu.path[0] as keyof PengaturanPayload] ??= isu.message
      setGalat(g)
      toast.error('Periksa isian yang bertanda merah.')
      return
    }
    setGalat({})
    try {
      await simpanMut.mutateAsync(hasil.data)
      toast.success('Pengaturan disimpan.')
    } catch (error) {
      setGalatServer(pesanGalat(error))
    }
  }

  return (
    <form onSubmit={simpan} className="grid max-w-4xl gap-5">
      {galatServer ? <Alert variant="destructive">{galatServer}</Alert> : null}
      <Bagian judul="Satuan kerja" deskripsi="Dipakai pada kepala SPTB dan Kuitansi.">
        {teks('kodeSatker', 'Kode satker')}
        <Field label="Tahun anggaran" htmlFor="tahunAnggaran" error={galat.tahunAnggaran}>
          <Input
            id="tahunAnggaran"
            type="number"
            inputMode="numeric"
            value={form.tahunAnggaran}
            onChange={(e) => set('tahunAnggaran', Number(e.target.value))}
          />
        </Field>
        {teks('namaSatker', 'Nama satker', { kelas: 'sm:col-span-2' })}
        {teks('dasarDipa', 'Tanggal dan nomor DIPA', { kelas: 'sm:col-span-2' })}
        {teks('kodeAkunDefault', 'Kode akun (mata anggaran) bawaan', { hint: 'Menjadi isian awal surat tugas baru.', kelas: 'sm:col-span-2' })}
      </Bagian>
      <Bagian judul="Pejabat penandatangan">
        {teks('ppkNama', 'Pejabat Pembuat Komitmen - nama')}
        {teks('ppkNip', 'Pejabat Pembuat Komitmen - NIP', { hint: 'Tulis seperti yang tercetak, mis. NIP. 19740218 200212 1 003' })}
        {teks('bendaharaNama', 'Bendahara Pengeluaran Pembantu - nama')}
        {teks('bendaharaNip', 'Bendahara Pengeluaran Pembantu - NIP')}
        {teks('pjNama', 'Pejabat yang bertanggung jawab - nama')}
        {teks('pjNip', 'Pejabat yang bertanggung jawab - NIP')}
        {teks('pjJabatan', 'Pejabat yang bertanggung jawab - jabatan', { kelas: 'sm:col-span-2' })}
        {teks('pembuatDaftarNama', 'Pembuat daftar - nama (opsional)', { opsional: true, hint: 'Kosong = pelaksana pertama pada surat tugas.' })}
        {teks('pembuatDaftarNip', 'Pembuat daftar - NIP (opsional)', { opsional: true })}
      </Bagian>
      <Bagian judul="Tempat kedudukan" deskripsi="Asal perjalanan: dipakai untuk uraian tiket dan pagu taksi/tiket.">
        {teks('kotaKedudukan', 'Kota tempat kedudukan')}
        <Field label="Provinsi tempat kedudukan" htmlFor="provinsiKedudukan" error={galat.provinsiKedudukan}>
          {provinsi.length > 0 ? (
            <Select id="provinsiKedudukan" value={form.provinsiKedudukan} onChange={(e) => set('provinsiKedudukan', e.target.value)}>
              {!provinsi.includes(form.provinsiKedudukan) ? <option value={form.provinsiKedudukan}>{form.provinsiKedudukan}</option> : null}
              {provinsi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="provinsiKedudukan" value={form.provinsiKedudukan} onChange={(e) => set('provinsiKedudukan', e.target.value)} />
          )}
        </Field>
      </Bagian>
      <div>
        <Button type="submit" disabled={simpanMut.isPending}>
          {simpanMut.isPending ? 'Menyimpan...' : 'Simpan pengaturan'}
        </Button>
      </div>
    </form>
  )
}

export default function PengaturanPage() {
  const data = usePengaturan()
  return (
    <div>
      <PageHeader title="Pengaturan" description="Data tetap yang dipakai di semua dokumen. Cukup diisi sekali." />
      {data.isError ? <Alert variant="destructive">{pesanGalat(data.error)}</Alert> : null}
      {data.isPending ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
      {data.data ? <FormPengaturan awal={data.data} /> : null}
    </div>
  )
}
```

- [ ] **Step 2: Daftarkan rute**

`apps/web/src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import PengaturanPage from '@/pages/pengaturan'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<SegeraPage judul="Surat tugas baru" />} />
          <Route path="st/:id" element={<SegeraPage judul="Editor surat tugas" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 3: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat.

- [ ] **Step 4: Periksa di peramban**

Buka `/pengaturan`: isi Kode satker `693712` dan nama PPK, klik "Simpan pengaturan" (toast "Pengaturan disimpan."), muat ulang: nilai tetap ada. Kosongkan "Kota tempat kedudukan" dan simpan: isian itu bertanda galat dan toast "Periksa isian yang bertanda merah." muncul.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/pages/pengaturan.tsx apps/web/src/App.tsx
git commit -m "feat(web): halaman Pengaturan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 6: Halaman Tabel SBM

**Files:**
- Create: `apps/web/src/pages/sbm.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `useVersiSbm()`, `useSbm(id)`, `useSimpanStatusSbm(id)`, `DataTable`, `StatusKonfigurasiMapSchema`, tipe `Sbm`.
- Produces: rute `/sbm` dengan tab Status pegawai (konfigurasi kolom hotel, hak representasi, kelas tiket; tersimpan lewat PATCH), Uang harian, Penginapan, Representasi, Taksi bandara, Tiket pesawat PP, Transport ibukota-kab, Jakarta-sekitar (+ transport kegiatan PP), Sewa kendaraan; pencarian pada tabel besar.

- [ ] **Step 1: Tulis halaman**

`apps/web/src/pages/sbm.tsx`:
```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import {
  STATUS_KODE,
  STATUS_LABEL,
  StatusKonfigurasiMapSchema,
  type KelasTiket,
  type Sbm,
  type StatusKode,
  type StatusKonfigurasi,
} from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { pesanGalat, rupiah } from '@/lib/format'
import { useSbm, useSimpanStatusSbm, useVersiSbm } from '@/lib/queries'
import { cn } from '@/lib/utils'

const KOLOM_HOTEL_LABEL = ['Pejabat Negara/Wamen/Eselon I', 'Pejabat Negara Lainnya/Eselon II', 'Eselon III/Gol. IV', 'Eselon IV/Gol. III/II/I']

const TAB = [
  ['status', 'Status pegawai'],
  ['uangHarian', 'Uang harian'],
  ['penginapan', 'Penginapan'],
  ['representasi', 'Representasi'],
  ['terminal', 'Taksi bandara'],
  ['tiket', 'Tiket pesawat PP'],
  ['ibukota', 'Transport ibukota-kab'],
  ['jakarta', 'Jakarta-sekitar'],
  ['sewa', 'Sewa kendaraan'],
] as const
type KodeTab = (typeof TAB)[number][0]

function Rp({ n }: { n: number }) {
  return <span>{rupiah(n)}</span>
}

function KonfigurasiStatus({ versiId, awal }: { versiId: number; awal: Record<StatusKode, StatusKonfigurasi> }) {
  const simpan = useSimpanStatusSbm(versiId)
  const [form, setForm] = useState(awal)
  const ubah = (k: StatusKode, patch: Partial<StatusKonfigurasi>) => setForm((f) => ({ ...f, [k]: { ...f[k], ...patch } }))

  async function kirim() {
    const hasil = StatusKonfigurasiMapSchema.safeParse(form)
    if (!hasil.success) return toast.error('Konfigurasi tidak valid.')
    try {
      await simpan.mutateAsync(hasil.data)
      toast.success('Konfigurasi status disimpan.')
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi status pegawai</CardTitle>
        <CardDescription>
          Menentukan kolom batas hotel, hak uang representasi, dan kelas tiket per status. Kelas tiket bawaan belum diverifikasi terhadap PMK
          Perjalanan Dinas; sesuaikan bila perlu.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Batas hotel</th>
                <th className="px-3 py-2">Uang representasi</th>
                <th className="px-3 py-2">Kelas tiket</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_KODE.map((k) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{STATUS_LABEL[k]}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={form[k].kolomHotel}
                      onChange={(e) => ubah(k, { kolomHotel: Number(e.target.value) as StatusKonfigurasi['kolomHotel'] })}
                    >
                      {KOLOM_HOTEL_LABEL.map((l, i) => (
                        <option key={l} value={i + 1}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={form[k].barisRepresentasi}
                      onChange={(e) => ubah(k, { barisRepresentasi: Number(e.target.value) as StatusKonfigurasi['barisRepresentasi'] })}
                    >
                      <option value={0}>Tidak berhak</option>
                      <option value={1}>Pejabat Negara/Wamen</option>
                      <option value={2}>Pejabat Eselon I</option>
                      <option value={3}>Pejabat Eselon II</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select value={form[k].kelasTiket} onChange={(e) => ubah(k, { kelasTiket: e.target.value as KelasTiket })}>
                      <option value="Bisnis">Bisnis</option>
                      <option value="Ekonomi">Ekonomi</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button onClick={kirim} disabled={simpan.isPending}>
            {simpan.isPending ? 'Menyimpan...' : 'Simpan konfigurasi'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Tabel({ kode, sbm }: { kode: KodeTab; sbm: Sbm }) {
  switch (kode) {
    case 'uangHarian': {
      const baris = Object.entries(sbm.uangHarian)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        { judul: 'Luar kota', rataKanan: true, sel: ([, v]) => <Rp n={v.luarKota} /> },
        { judul: 'Dalam kota > 8 jam', rataKanan: true, sel: ([, v]) => <Rp n={v.dalamKota8Jam} /> },
        { judul: 'Diklat', rataKanan: true, sel: ([, v]) => <Rp n={v.diklat} /> },
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    case 'penginapan': {
      const baris = Object.entries(sbm.penginapan)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        ...KOLOM_HOTEL_LABEL.map((judul, i) => ({ judul, rataKanan: true, sel: ([, v]: (typeof baris)[number]) => <Rp n={v[i] ?? 0} /> })),
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    case 'representasi': {
      const kolom: Kolom<Sbm['representasi'][number]>[] = [
        { judul: 'Uraian', sel: (r) => r.uraian },
        { judul: 'Luar kota', rataKanan: true, sel: (r) => <Rp n={r.luarKota} /> },
        { judul: 'Dalam kota > 8 jam', rataKanan: true, sel: (r) => <Rp n={r.dalamKota} /> },
      ]
      return <DataTable kolom={kolom} baris={sbm.representasi} cari={false} />
    }
    case 'terminal': {
      const baris = Object.entries(sbm.terminal)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        { judul: 'Besaran per kali', rataKanan: true, sel: ([, n]) => <Rp n={n} /> },
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    case 'tiket': {
      const kolom: Kolom<Sbm['tiketPp'][number]>[] = [
        { judul: 'Asal', teks: (r) => r.asal, sel: (r) => r.asal },
        { judul: 'Tujuan', teks: (r) => r.tujuan, sel: (r) => r.tujuan },
        { judul: 'Bisnis (PP)', rataKanan: true, sel: (r) => <Rp n={r.bisnis} /> },
        { judul: 'Ekonomi (PP)', rataKanan: true, sel: (r) => <Rp n={r.ekonomi} /> },
      ]
      return <DataTable kolom={kolom} baris={sbm.tiketPp} />
    }
    case 'ibukota': {
      const kolom: Kolom<Sbm['transportIbukota'][number]>[] = [
        { judul: 'Provinsi', teks: (r) => r.provinsi, sel: (r) => r.provinsi },
        { judul: 'Ibukota', teks: (r) => r.ibukota, sel: (r) => r.ibukota },
        { judul: 'Kabupaten/kota tujuan', teks: (r) => r.kabKota, sel: (r) => r.kabKota },
        { judul: 'Besaran (sekali jalan)', rataKanan: true, sel: (r) => <Rp n={r.besaran} /> },
      ]
      return <DataTable kolom={kolom} baris={sbm.transportIbukota} />
    }
    case 'jakarta': {
      const kolom: Kolom<Sbm['transportJakarta'][number]>[] = [
        { judul: 'Kabupaten/kota tujuan', teks: (r) => r.kabKota, sel: (r) => r.kabKota },
        { judul: 'Besaran (sekali jalan)', rataKanan: true, sel: (r) => <Rp n={r.besaran} /> },
      ]
      return (
        <div className="grid gap-4">
          <DataTable kolom={kolom} baris={sbm.transportJakarta} cari={false} />
          <p className="text-sm text-muted-foreground">
            Transport kegiatan dalam kabupaten/kota (PP): <strong className="text-foreground">{rupiah(sbm.transportKegiatanPp)}</strong> per orang per kali.
          </p>
        </div>
      )
    }
    case 'sewa': {
      const baris = Object.entries(sbm.sewaKendaraan)
      const kolom: Kolom<(typeof baris)[number]>[] = [
        { judul: 'Provinsi', teks: ([p]) => p, sel: ([p]) => p },
        { judul: 'Roda 4 / hari', rataKanan: true, sel: ([, v]) => <Rp n={v.roda4} /> },
        { judul: 'Roda 6 / bus sedang', rataKanan: true, sel: ([, v]) => <Rp n={v.roda6BusSedang} /> },
        { judul: 'Bus besar', rataKanan: true, sel: ([, v]) => <Rp n={v.busBesar} /> },
      ]
      return <DataTable kolom={kolom} baris={baris} />
    }
    default:
      return null
  }
}

export default function SbmPage() {
  const versi = useVersiSbm()
  const [dipilih, setDipilih] = useState<number | undefined>()
  const id = dipilih ?? versi.data?.[0]?.id
  const sbm = useSbm(id)
  const [tab, setTab] = useState<KodeTab>('status')

  return (
    <div>
      <PageHeader
        title="Tabel SBM"
        description="Standar Biaya Masukan yang dipakai mesin hitung. Data dari PMK 32 Tahun 2025; hanya konfigurasi status yang dapat diubah."
        actions={
          versi.data && versi.data.length > 1 ? (
            <Select value={id} onChange={(e) => setDipilih(Number(e.target.value))} className="w-56">
              {versi.data.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.tahunAnggaran} - {v.dasarHukum}
                </option>
              ))}
            </Select>
          ) : null
        }
      />
      {versi.isError || sbm.isError ? <Alert variant="destructive">{pesanGalat(versi.error ?? sbm.error)}</Alert> : null}
      {versi.data?.[0] && id !== undefined && versi.data.find((v) => v.id === id) ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {versi.data.find((v) => v.id === id)?.dasarHukum} - tahun anggaran {versi.data.find((v) => v.id === id)?.tahunAnggaran}
        </p>
      ) : null}
      <div className="mb-5 flex flex-wrap gap-1 border-b">
        {TAB.map(([kode, label]) => (
          <button
            key={kode}
            type="button"
            onClick={() => setTab(kode)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === kode ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {sbm.isPending && id !== undefined ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
      {sbm.data ? (
        tab === 'status' ? (
          <KonfigurasiStatus key={sbm.data.versi.id} versiId={sbm.data.versi.id} awal={sbm.data.data.statusKonfigurasi} />
        ) : (
          <Tabel kode={tab} sbm={sbm.data.data} />
        )
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Daftarkan rute**

`apps/web/src/App.tsx` (versi akhir):
```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import PengaturanPage from '@/pages/pengaturan'
import SbmPage from '@/pages/sbm'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<SegeraPage judul="Surat tugas baru" />} />
          <Route path="st/:id" element={<SegeraPage judul="Editor surat tugas" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="sbm" element={<SbmPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 3: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat.

- [ ] **Step 4: Periksa di peramban**

Buka `/sbm`: tab "Status pegawai" menampilkan lima status; ubah kelas tiket Eselon II ke Bisnis, "Simpan konfigurasi" (toast), muat ulang: nilai tetap. Tab "Tiket pesawat PP": cari `denpasar` menampilkan JAKARTA-DENPASAR Rp5.305.000 / Rp3.262.000. Tab "Penginapan" menampilkan 38 provinsi; tab "Jakarta-sekitar" menampilkan 9 tujuan dan "Rp170.000". Kembalikan kelas tiket Eselon II ke Ekonomi.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/pages/sbm.tsx apps/web/src/App.tsx
git commit -m "feat(web): halaman Tabel SBM dan konfigurasi status

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 7: Skrip root dan dokumentasi

**Files:**
- Modify: `package.json`, `CLAUDE.md`

**Interfaces:**
- Consumes: skrip `dev`, `build`, `lint` di `apps/web`.
- Produces: skrip root `npm run dev:web` dan `npm run build` yang juga membangun web; dokumentasi perintah dan pemetaan alias `@spjan/shared` di CLAUDE.md.

- [ ] **Step 1: Perbarui skrip root**

Ganti blok `scripts` di `package.json`:
```json
"scripts": {
  "build": "npm run build -w @spjan/shared && npm run build -w api && npm run build -w web",
  "test": "npm run test --workspaces --if-present",
  "lint": "npm run lint --workspaces --if-present",
  "dev:api": "npm run dev -w api",
  "dev:web": "npm run dev -w web",
  "db:up": "docker compose -f docker-compose.dev.yml up -d"
}
```

- [ ] **Step 2: Perbarui CLAUDE.md**

Ganti `CLAUDE.md` dengan:
```markdown
# SPJAN

Aplikasi web untuk menyusun SPJ perjalanan dinas (SPTB, Rincian Biaya Perjalanan Dinas, Kuitansi)
Direktorat Pengendalian Perhutanan Sosial. Satu pengguna. Domain produksi: spjan.ditpps.com.
Arsitektur dan aturan hitung: `docs/superpowers/specs/2026-10-04-spjan-design.md`.

## Struktur monorepo (npm workspaces)

```
apps/api/        Fastify 5 + TypeScript + PostgreSQL (pg, node-pg-migrate, zod)
apps/web/        React 19 + Vite + TypeScript, Tailwind 4, komponen gaya shadcn (ditulis tangan di components/ui), TanStack Query, react-router-dom 7
packages/shared/ Tipe dan mesin hitung SPJ (@spjan/shared)
scripts/         Skrip bantu (mis. pembuat fixture SBM)
docs/superpowers/{specs,plans}/
```

## Perintah

Dari root: `npm run build`, `npm run test`, `npm run lint`, `npm run db:up` (Postgres pengembangan), `npm run dev:api`, `npm run dev:web`.
Di `packages/shared`: `npm run test` (vitest), `npm run lint` (`tsc --noEmit`, termasuk file tes), `npm run build`.

Di `apps/api`: `npm run dev` (tsx watch), `npm run test` (vitest, memakai Postgres sungguhan), `npm run lint`, `npm run migrate:create`.

Di `apps/web`: `npm run dev` (Vite, port 5173, meneruskan `/api` ke `http://localhost:3001`; ubah dengan `API_PROXY_TARGET`), `npm run build` (`tsc -b && vite build`), `npm run lint` (eslint). Tidak ada tes frontend (konvensi proyek): verifikasi lewat tsc, eslint, build, dan pemeriksaan di peramban.
`apps/web` memetakan `@spjan/shared` langsung ke `packages/shared/src` (alias Vite + paths tsconfig), jadi tidak perlu build shared untuk pengembangan web.

## Database

- Pengembangan dan tes: container `spjan-dev-postgres` (`docker-compose.dev.yml`, port 127.0.0.1:55432), terpisah dari server SIPEKAPS.
  Buat sekali: `docker exec spjan-dev-postgres psql -U postgres -c "create database spjan_test"` (dan `spjan_dev` untuk menjalankan server lokal).
  Tes memakai `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:55432/spjan_test`) dan membuat ulang skema `public` setiap kali dijalankan.
- Produksi: database `spjan` di server PostgreSQL yang sama dengan SIPEKAPS (dibuat pengguna).
- Migrasi: `apps/api/migrations/*.sql` (node-pg-migrate), otomatis dijalankan saat server boot. Data SBM disimpan sebagai `jsonb` di `sbm_versi.data` dan diisi `seedSbm()` dari `SBM_2026`.

Setelah mengubah `packages/shared/src`, jalankan `npm run build` di `packages/shared` sebelum
mengetik/menguji workspace lain (api/web mengimpor dari `dist`).

## Konvensi

- TypeScript strict dengan `noUncheckedIndexedAccess`; impor relatif memakai akhiran `.js`.
- Mesin hitung (`hitungSpj`) adalah fungsi murni; tidak ada akses DB/jaringan di `packages/shared`.
- Semua angka rupiah bulat. Teks keluaran berbahasa Indonesia; format angka memakai titik (`Rp225.000`).
- Kunci provinsi/kota di SBM memakai huruf besar; cocokkan lewat `norm()`.
- `packages/shared/src/data/sbm-2026.ts` dihasilkan skrip `scripts/build-sbm-fixture.py`; jangan diedit manual.
  Sumber: tabel PMK 32 Tahun 2025 yang diekstrak ke `SPJ Otomatis.xlsx` (tidak disimpan di repo).
- Kelas tiket per status (`statusKonfigurasi`) adalah default yang belum diverifikasi terhadap PMK Perjalanan Dinas.

## Alur kerja

Jangan commit, push, atau deploy tanpa persetujuan eksplisit pengguna di setiap gerbang
(commit, push, deploy masing-masing terpisah). Pesan commit memakai Conventional Commits.
```

- [ ] **Step 3: Jalankan semua gerbang dari root**

Run: `npm run lint && npm run build && npm run test`
Expected: lint dan build tanpa galat; shared `Tests  52 passed (52)` dan api `Tests  21 passed (21)`.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add package.json CLAUDE.md docs
git commit -m "docs: skrip root dan CLAUDE.md untuk apps/web

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

## Self-Review

1. **Cakupan spec:** bagian 7 (login, daftar ST, pegawai, pengaturan, SBM, rute) = Task 2-6; editor `/st/:id` dan dokumen `/st/:id/dokumen` sengaja di 1C-2 dan 1C-3; bagian 3 (React + Vite, Tailwind, shadcn/Radix, TanStack Query, react-router 7) = Task 2; bagian 2 (sesi cookie, tidak ada akses tanpa login) = `RequireAuth` Task 2. Pegawai tersimpan permanen dan dapat ditambah (Task 3); penambahan langsung dari editor ST masuk 1C-2.
2. **Placeholder:** tidak ada; semua langkah memuat isi berkas lengkap dan keluaran yang diharapkan. `SegeraPage` adalah halaman nyata yang diganti rencana 1C-2.
3. **Konsistensi tipe:** nama hook, `Kolom<T>`, `DataTable`, DTO, dan fungsi format di blok Interfaces sama dengan berkas; `App.tsx` ditampilkan utuh pada tiap tugas yang mengubahnya.
