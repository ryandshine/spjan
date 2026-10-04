# SPJAN Tahap 1A: Fondasi dan @spjan/shared (mesin hitung) - Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat kerangka monorepo `spjan` dan paket `@spjan/shared` berisi tipe, utilitas teks Indonesia, data SBM PMK 32/2025, dan mesin hitung SPJ murni yang lulus kasus uji emas.

**Architecture:** Monorepo npm workspaces (pola SIPEKAPS). `packages/shared` adalah TypeScript ESM murni tanpa akses DB/jaringan; `hitungSpj(input, sbm)` dipakai api (validasi) dan web (pratinjau). Data SBM berupa berkas TS yang dihasilkan skrip Python dari tabel PMK yang sudah diekstrak.

**Tech Stack:** Node 24, npm 11, TypeScript ^6.0.2, vitest ^4.1.4, Python 3 + openpyxl (hanya untuk skrip fixture).

**Spec:** `docs/superpowers/specs/2026-10-04-spjan-design.md` (bagian 3, 5, 9, 11)

## Cakupan rencana ini dan rencana berikutnya

Spesifikasi mencakup beberapa subsistem independen, jadi dibagi menjadi empat rencana. Rencana ini (1A) menghasilkan paket `@spjan/shared` yang bisa diuji sendiri.
- 1B: `apps/api` (Fastify, PostgreSQL, migrasi, seed SBM, auth satu akun, CRUD pegawai/pengaturan/surat tugas, `GET /surat-tugas/:id/hasil`).
- 1C: `apps/web` (editor ST, pratinjau, PDF SPTB/Rincian/Kuitansi dengan @react-pdf/renderer).
- 1D: deploy (Dockerfile.combined, docker-compose.dokploy.yml, Traefik spjan.ditpps.com, webhook Dokploy).
Rencana 1B-1D ditulis setelah 1A selesai dan fungsi/tipe yang dihasilkannya sudah final.

## Global Constraints

- TypeScript `strict` + `noUncheckedIndexedAccess`; `module: ESNext`, `moduleResolution: Bundler`; impor relatif memakai akhiran `.js`.
- `typescript` ^6.0.2 dan `vitest` ^4.1.4 (sama dengan SIPEKAPS); tidak ada dependensi runtime di `@spjan/shared`.
- Semua angka rupiah bilangan bulat; format teks angka memakai titik (`Rp225.000`); semua teks keluaran berbahasa Indonesia.
- Kunci provinsi/kota SBM memakai huruf besar; pencocokan lewat `norm()` (spasi dirapikan, huruf besar).
- Pagu PMK hanya informasi/peringatan, tidak pernah memblokir.
- Jangan commit, push, atau deploy tanpa persetujuan eksplisit pengguna di setiap gerbang. Pesan commit Conventional Commits dengan trailer `Co-Authored-By` dan `Claude-Session`.
- Berkas `packages/shared/src/data/sbm-2026.ts` dihasilkan skrip; jangan diedit manual.

## Struktur berkas

```
package.json, tsconfig.base.json, .gitignore, CLAUDE.md          root
scripts/build-sbm-fixture.py                                      pembuat fixture SBM
packages/shared/package.json, tsconfig.json, tsconfig.lint.json, vitest.config.ts
packages/shared/src/types.ts            tipe domain, konstanta status/jenis biaya
packages/shared/src/teks.ts             norm, proper, format angka, tanggal, rentang, terbilang
packages/shared/src/data/sbm-2026.ts    data SBM (dihasilkan)
packages/shared/src/pagu.ts             pencarian pagu PMK dan catatan
packages/shared/src/hitung.ts           hitungSpj
packages/shared/src/index.ts            ekspor publik
```

---

### Task 1: Kerangka monorepo dan utilitas teks Indonesia

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/tsconfig.lint.json`, `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/types.ts`, `packages/shared/src/teks.ts`
- Test: `packages/shared/src/teks.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces (dipakai tugas 2-5): dari `types.ts`: `STATUS_KODE`, `StatusKode`, `STATUS_LABEL`, `JENIS_BIAYA`, `JenisBiaya`, `JENIS_LABEL`, `KelasTiket`, `StatusKonfigurasi`, `Sbm`, `EtapeInput`, `BiayaInput`, `PelaksanaInput`, `SpjInput`, `KodePeringatan`, `Peringatan`, `BarisBiaya`, `PelaksanaHasil`, `SpjHasil`. Dari `teks.ts`: `norm(s): string`, `proper(s): string`, `formatAngka(n): string`, `formatRp(n): string`, `parseTanggal(iso): Tanggal | null`, `selisihHari(a, b): number`, `tanggalIndonesia(iso): string`, `rentangRincian(a, b): string`, `rentangSptb(a, b): string`, `angkaKata(n): string`, `terbilangRupiah(n): string`, `BULAN`, `interface Tanggal { y; m; d }`.

- [ ] **Step 1: Buat berkas kerangka**

`package.json`:
```json
{
  "name": "spjan",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build -w @spjan/shared",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`.gitignore`:
```
node_modules
dist
coverage
.DS_Store
.env
.env.*
!.env.example
*.log
*.tmp
*.swp
apps/*/dist
apps/*/node_modules
packages/*/dist
packages/*/node_modules
```

`packages/shared/package.json`:
```json
{
  "name": "@spjan/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -w -p tsconfig.json",
    "lint": "tsc -p tsconfig.lint.json --noEmit",
    "test": "vitest run"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "devDependencies": {
    "typescript": "^6.0.2",
    "vitest": "^4.1.4"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/shared/tsconfig.lint.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Pasang dependensi**

Run: `npm install` (dari root `~/spjan`)
Expected: selesai tanpa galat; `node_modules/.bin/tsc` dan `vitest` ada.

- [ ] **Step 3: Tulis tes yang gagal**

`packages/shared/src/teks.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  angkaKata,
  formatAngka,
  formatRp,
  norm,
  parseTanggal,
  proper,
  rentangRincian,
  rentangSptb,
  selisihHari,
  tanggalIndonesia,
  terbilangRupiah,
} from "./teks.js";

const t = (iso: string) => {
  const r = parseTanggal(iso);
  if (!r) throw new Error(`tanggal tidak valid: ${iso}`);
  return r;
};

describe("terbilangRupiah", () => {
  it.each([
    [0, "Nol Rupiah"],
    [21, "Dua Puluh Satu Rupiah"],
    [100, "Seratus Rupiah"],
    [1000, "Seribu Rupiah"],
    [1_001_000, "Satu Juta Seribu Rupiah"],
    [15_000, "Lima Belas Ribu Rupiah"],
    [111_111_111, "Seratus Sebelas Juta Seratus Sebelas Ribu Seratus Sebelas Rupiah"],
    [2_020_000, "Dua Juta Dua Puluh Ribu Rupiah"],
    [4_715_000, "Empat Juta Tujuh Ratus Lima Belas Ribu Rupiah"],
    [6_965_979, "Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah"],
    [11_909_784, "Sebelas Juta Sembilan Ratus Sembilan Ribu Tujuh Ratus Delapan Puluh Empat Rupiah"],
    [12_345_678, "Dua Belas Juta Tiga Ratus Empat Puluh Lima Ribu Enam Ratus Tujuh Puluh Delapan Rupiah"],
  ])("%i -> %s", (n, expected) => {
    expect(terbilangRupiah(n)).toBe(expected);
  });

  it("menolak angka di luar jangkauan", () => {
    expect(() => angkaKata(-1)).toThrow(RangeError);
    expect(() => angkaKata(1_000_000_000_000)).toThrow(RangeError);
  });
});

describe("tanggal", () => {
  it("memvalidasi tanggal kalender", () => {
    expect(parseTanggal("2026-09-10")).toEqual({ y: 2026, m: 9, d: 10 });
    expect(parseTanggal("2026-02-30")).toBeNull();
    expect(parseTanggal("10/09/2026")).toBeNull();
    expect(parseTanggal("")).toBeNull();
    expect(parseTanggal(null)).toBeNull();
  });

  it("menghitung selisih hari termasuk lintas bulan", () => {
    expect(selisihHari(t("2026-09-10"), t("2026-09-13"))).toBe(3);
    expect(selisihHari(t("2026-09-30"), t("2026-10-02"))).toBe(2);
  });

  it("menulis tanggal Indonesia", () => {
    expect(tanggalIndonesia("2026-09-08")).toBe("8 September 2026");
    expect(tanggalIndonesia("bukan tanggal")).toBe("");
  });

  it("rentang Rincian: satu hari, satu bulan, lintas bulan, lintas tahun", () => {
    expect(rentangRincian(t("2026-09-10"), t("2026-09-10"))).toBe("10 September 2026");
    expect(rentangRincian(t("2026-09-10"), t("2026-09-13"))).toBe("10-13 September 2026");
    expect(rentangRincian(t("2026-09-30"), t("2026-10-02"))).toBe("30 September - 2 Oktober 2026");
    expect(rentangRincian(t("2026-12-30"), t("2027-01-02"))).toBe("30 Desember 2026 - 2 Januari 2027");
  });

  it("rentang SPTB: satu hari, satu bulan, lintas bulan, lintas tahun", () => {
    expect(rentangSptb(t("2026-09-10"), t("2026-09-10"))).toBe("10 September 2026");
    expect(rentangSptb(t("2026-09-10"), t("2026-09-13"))).toBe("10 s.d. 13 September 2026");
    expect(rentangSptb(t("2026-09-30"), t("2026-10-02"))).toBe("30 September s.d. 2 Oktober 2026");
    expect(rentangSptb(t("2026-12-30"), t("2027-01-02"))).toBe("30 Desember 2026 s.d. 2 Januari 2027");
  });
});

describe("teks umum", () => {
  it("norm dan proper", () => {
    expect(norm("  d.i.   yogyakarta ")).toBe("D.I. YOGYAKARTA");
    expect(proper("D.I. YOGYAKARTA")).toBe("D.I. Yogyakarta");
    expect(proper("NUSA TENGGARA BARAT")).toBe("Nusa Tenggara Barat");
  });

  it("format angka rupiah dengan titik", () => {
    expect(formatAngka(4_715_000)).toBe("4.715.000");
    expect(formatAngka(999)).toBe("999");
    expect(formatRp(225_000)).toBe("Rp225.000");
  });
});
```

- [ ] **Step 4: Jalankan tes, pastikan gagal**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL, `Failed to resolve import "./teks.js"`.

- [ ] **Step 5: Tulis tipe dan utilitas**

`packages/shared/src/types.ts`:
```ts
export const STATUS_KODE = [
  "PEJABAT_NEGARA_WAMEN",
  "ESELON_I",
  "ESELON_II",
  "ESELON_III_GOL_IV",
  "ESELON_IV_GOL_III_II_I",
] as const;
export type StatusKode = (typeof STATUS_KODE)[number];

export const STATUS_LABEL: Record<StatusKode, string> = {
  PEJABAT_NEGARA_WAMEN: "Pejabat Negara/Wakil Menteri",
  ESELON_I: "Pejabat Eselon I",
  ESELON_II: "Pejabat Eselon II",
  ESELON_III_GOL_IV: "Eselon III/Golongan IV",
  ESELON_IV_GOL_III_II_I: "Eselon IV/Golongan III/II/I",
};

export const JENIS_BIAYA = [
  "TIKET_PERGI",
  "TIKET_KEMBALI",
  "TAKSI_KEDUDUKAN",
  "TRANSPORT_DARAT",
  "TRANSPORT_JAKARTA_SEKITAR",
  "TRANSPORT_KEGIATAN_PP",
  "TAKSI_TERMINAL",
  "SEWA_RODA4",
  "SEWA_RODA6",
  "SEWA_BUS_BESAR",
  "AIRPORT_TAX_BAGASI",
  "KERETA_BUS_LAIN",
  "LAINNYA",
] as const;
export type JenisBiaya = (typeof JENIS_BIAYA)[number];

export const JENIS_LABEL: Record<JenisBiaya, string> = {
  TIKET_PERGI: "Tiket pesawat pergi",
  TIKET_KEMBALI: "Tiket pesawat kembali",
  TAKSI_KEDUDUKAN: "Taksi dari tempat kedudukan - bandara",
  TRANSPORT_DARAT: "Transport darat ibukota ke kab/kota",
  TRANSPORT_JAKARTA_SEKITAR: "Transport Jakarta ke kota sekitar",
  TRANSPORT_KEGIATAN_PP: "Transport kegiatan dalam kab/kota PP",
  TAKSI_TERMINAL: "Taksi/transport dari-ke bandara/terminal",
  SEWA_RODA4: "Sewa kendaraan roda 4 per hari",
  SEWA_RODA6: "Sewa kendaraan roda 6/bus sedang per hari",
  SEWA_BUS_BESAR: "Sewa kendaraan bus besar per hari",
  AIRPORT_TAX_BAGASI: "Airport tax / bagasi / retribusi",
  KERETA_BUS_LAIN: "Kereta api / bus / lainnya",
  LAINNYA: "Lainnya",
};

export type KelasTiket = "Bisnis" | "Ekonomi";

export interface StatusKonfigurasi {
  /** 1..4 = kolom tarif hotel pada tabel SBM Penginapan */
  kolomHotel: 1 | 2 | 3 | 4;
  /** 0 = tidak berhak; 1..3 = baris tabel SBM Uang Representasi */
  barisRepresentasi: 0 | 1 | 2 | 3;
  kelasTiket: KelasTiket;
}

/** Semua kunci provinsi/kota memakai huruf besar (lihat norm()). */
export interface Sbm {
  tahunAnggaran: number;
  uangHarian: Record<string, { luarKota: number; dalamKota8Jam: number; diklat: number }>;
  representasi: Array<{ uraian: string; luarKota: number; dalamKota: number }>;
  penginapan: Record<string, [number, number, number, number]>;
  terminal: Record<string, number>;
  tiketPp: Array<{ asal: string; tujuan: string; bisnis: number; ekonomi: number }>;
  transportIbukota: Array<{ provinsi: string; ibukota: string; kabKota: string; besaran: number }>;
  transportJakarta: Array<{ kabKota: string; besaran: number }>;
  transportKegiatanPp: number;
  sewaKendaraan: Record<string, { roda4: number; roda6BusSedang: number; busBesar: number }>;
  statusKonfigurasi: Record<StatusKode, StatusKonfigurasi>;
}

export interface EtapeInput {
  provinsi: string;
  kota: string;
  kegiatan: string;
  /** YYYY-MM-DD */
  berangkat: string;
  /** YYYY-MM-DD */
  pulang: string;
  malamOverride?: number | null;
  hotelNama?: string | null;
  hotelTarif?: number | null;
  dinasJabatan?: boolean;
}

export interface BiayaInput {
  jenis: JenisBiaya;
  /** Provinsi untuk pagu (transport darat, terminal, sewa kendaraan). */
  provinsi?: string | null;
  /** Kosong = uraian otomatis. Untuk TRANSPORT_DARAT/JAKARTA_SEKITAR berisi nama kab/kota persis seperti PMK. */
  uraian?: string | null;
  qty?: number | null;
  satuan?: string | null;
  tarif: number;
  keterangan?: string | null;
  /** Indeks etape (0-based) untuk TIKET_PERGI / TIKET_KEMBALI. Default: TIKET_PERGI = 0, TIKET_KEMBALI = etape terakhir. */
  etapeIndex?: number | null;
}

export interface PelaksanaInput {
  nama: string;
  nip: string;
  jabatan: string;
  status: StatusKode | null;
  noSpd?: string | null;
  etape: EtapeInput[];
  biaya: BiayaInput[];
}

export interface SpjInput {
  nomorSt: string;
  /** YYYY-MM-DD */
  tanggalSt: string;
  /** YYYY-MM-DD */
  tanggalSpj?: string | null;
  kotaKedudukan: string;
  /** Kunci provinsi tempat kedudukan, untuk pagu taksi dari kedudukan. */
  provinsiKedudukan: string;
  pelaksana: PelaksanaInput[];
}

export type KodePeringatan =
  | "DATA_BELUM_LENGKAP"
  | "TANGGAL_SALAH"
  | "STATUS_PEGAWAI_KOSONG"
  | "NIP_KOSONG"
  | "NO_SPD_KOSONG"
  | "TARIF_HOTEL_KOSONG"
  | "HOTEL_MELEBIHI_BATAS";

export interface Peringatan {
  kode: KodePeringatan;
  pesan: string;
  /** Indeks etape (0-based) bila peringatan terkait satu etape. */
  etape?: number;
}

export interface BarisBiaya {
  uraian: string;
  /** Hanya terisi bila qty > 1 (ditampilkan "n satuan @ tarif"). */
  qty: number | null;
  satuan: string | null;
  tarif: number | null;
  jumlah: number;
  keterangan: string;
  /** Catatan pagu PMK (informasi saja). */
  catatan?: string;
}

export interface PelaksanaHasil {
  nama: string;
  nip: string;
  jabatan: string;
  status: StatusKode | null;
  noSpd: string;
  transport: BarisBiaya[];
  uangHarian: BarisBiaya[];
  representasi: BarisBiaya[];
  penginapan: BarisBiaya[];
  totalTransport: number;
  totalUangHarian: number;
  totalRepresentasi: number;
  totalPenginapan: number;
  total: number;
  terbilang: string;
  uraianSptb: string;
  peringatan: Peringatan[];
  /** Catatan informatif tingkat pelaksana (kelas tiket, pagu tiket, hak representasi). */
  catatan: string[];
}

export interface SpjHasil {
  pelaksana: PelaksanaHasil[];
  total: number;
  terbilang: string;
  teksTanggalSt: string;
  teksTanggalSpj: string;
}
```

`packages/shared/src/teks.ts`:
```ts
export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** Kunci pencarian: spasi dirapikan dan huruf besar. */
export function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/** "D.I. YOGYAKARTA" -> "D.I. Yogyakarta". */
export function proper(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[^\p{L}])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
}

/** 1234567 -> "1.234.567" */
export function formatAngka(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(n)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatRp(n: number): string {
  return `Rp${formatAngka(n)}`;
}

export interface Tanggal {
  y: number;
  m: number;
  d: number;
}

export function parseTanggal(iso: string | null | undefined): Tanggal | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Selisih hari kalender b - a. */
export function selisihHari(a: Tanggal, b: Tanggal): number {
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

function namaBulan(m: number): string {
  return BULAN[m - 1] ?? "";
}

/** "8 September 2026"; string kosong bila tanggal tidak valid. */
export function tanggalIndonesia(iso: string | null | undefined): string {
  const t = parseTanggal(iso);
  return t ? `${t.d} ${namaBulan(t.m)} ${t.y}` : "";
}

/** Rentang untuk Rincian: "10-13 September 2026", "30 September - 2 Oktober 2026". */
export function rentangRincian(a: Tanggal, b: Tanggal): string {
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${namaBulan(a.m)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}-${b.d} ${namaBulan(b.m)} ${b.y}`;
  const tahunA = a.y === b.y ? "" : ` ${a.y}`;
  return `${a.d} ${namaBulan(a.m)}${tahunA} - ${b.d} ${namaBulan(b.m)} ${b.y}`;
}

/** Rentang untuk SPTB: "10 s.d. 13 September 2026", "30 September s.d. 2 Oktober 2026". */
export function rentangSptb(a: Tanggal, b: Tanggal): string {
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${namaBulan(a.m)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d} s.d. ${b.d} ${namaBulan(b.m)} ${b.y}`;
  const tahunA = a.y === b.y ? "" : ` ${a.y}`;
  return `${a.d} ${namaBulan(a.m)}${tahunA} s.d. ${b.d} ${namaBulan(b.m)} ${b.y}`;
}

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function tigaDigit(n: number): string {
  const parts: string[] = [];
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  if (ratus === 1) parts.push("seratus");
  else if (ratus > 1) parts.push(`${SATUAN[ratus]} ratus`);
  if (sisa > 0) {
    if (sisa < 12) parts.push(SATUAN[sisa] ?? "");
    else if (sisa < 20) parts.push(`${SATUAN[sisa - 10]} belas`);
    else {
      const puluh = Math.floor(sisa / 10);
      const satuan = sisa % 10;
      parts.push(`${SATUAN[puluh]} puluh`);
      if (satuan > 0) parts.push(SATUAN[satuan] ?? "");
    }
  }
  return parts.join(" ");
}

/** Angka bulat 0 .. < 10^12 dalam kata (huruf kecil): 1001000 -> "satu juta seribu". */
export function angkaKata(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000_000_000) {
    throw new RangeError(`angkaKata: di luar jangkauan (${n})`);
  }
  if (n === 0) return "nol";
  const grup: Array<[number, string]> = [
    [1_000_000_000, "miliar"],
    [1_000_000, "juta"],
    [1_000, "ribu"],
    [1, ""],
  ];
  const parts: string[] = [];
  let sisa = n;
  for (const [nilai, nama] of grup) {
    const jumlah = Math.floor(sisa / nilai);
    sisa -= jumlah * nilai;
    if (jumlah === 0) continue;
    if (nama === "ribu" && jumlah === 1) parts.push("seribu");
    else parts.push(nama ? `${tigaDigit(jumlah)} ${nama}` : tigaDigit(jumlah));
  }
  return parts.join(" ");
}

function judul(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** 4715000 -> "Empat Juta Tujuh Ratus Lima Belas Ribu Rupiah" */
export function terbilangRupiah(n: number): string {
  return `${judul(angkaKata(Math.round(n)))} Rupiah`;
}
```

- [ ] **Step 6: Jalankan tes dan lint**

Run: `cd packages/shared && npx vitest run && npx tsc -p tsconfig.lint.json --noEmit`
Expected: `Tests  20 passed (20)` dan tsc tanpa keluaran.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan daftar berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore packages/shared
git commit -m "feat(shared): kerangka monorepo dan utilitas teks Indonesia

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 2: Data SBM 2026 (fixture dari PMK 32/2025)

**Files:**
- Create: `scripts/build-sbm-fixture.py`
- Create (dihasilkan): `packages/shared/src/data/sbm-2026.ts`
- Test: `packages/shared/src/sbm.test.ts`

**Interfaces:**
- Consumes: tipe `Sbm`, `STATUS_KODE` dari Task 1.
- Produces: `export const SBM_2026: Sbm` (modul `./data/sbm-2026.js`) dengan 38 provinsi pada `uangHarian`/`penginapan`/`sewaKendaraan`, 34 pada `terminal`, 316 baris `tiketPp`, 361 `transportIbukota`, 9 `transportJakarta`, 3 `representasi`, `transportKegiatanPp = 170000`, dan `statusKonfigurasi` untuk kelima status.

**Prasyarat:** `python3` dengan `openpyxl`; berkas `/home/ryandshinevps/spj/2026/diy/SPJ Otomatis.xlsx` (memuat sheet tabel SBM hasil ekstraksi PMK).

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/src/sbm.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { STATUS_KODE } from "./types.js";

describe("SBM_2026 (PMK 32/2025)", () => {
  it("memuat jumlah baris yang diharapkan", () => {
    expect(Object.keys(SBM_2026.uangHarian)).toHaveLength(38);
    expect(Object.keys(SBM_2026.penginapan)).toHaveLength(38);
    expect(Object.keys(SBM_2026.terminal)).toHaveLength(34);
    expect(Object.keys(SBM_2026.sewaKendaraan)).toHaveLength(38);
    expect(SBM_2026.tiketPp).toHaveLength(316);
    expect(SBM_2026.transportIbukota).toHaveLength(361);
    expect(SBM_2026.transportJakarta).toHaveLength(9);
    expect(SBM_2026.representasi).toHaveLength(3);
  });

  it("nilai acuan cocok dengan teks PMK", () => {
    expect(SBM_2026.uangHarian["D.I. YOGYAKARTA"]?.luarKota).toBe(420_000);
    expect(SBM_2026.uangHarian["BALI"]?.luarKota).toBe(480_000);
    expect(SBM_2026.uangHarian["SULAWESI UTARA"]?.luarKota).toBe(370_000);
    expect(SBM_2026.penginapan["D.I. YOGYAKARTA"]).toEqual([5_100_000, 2_695_000, 1_600_000, 845_000]);
    expect(SBM_2026.penginapan["BALI"]?.[3]).toBe(1_138_000);
    expect(SBM_2026.representasi.map((r) => r.luarKota)).toEqual([250_000, 200_000, 150_000]);
    expect(SBM_2026.terminal["BALI"]).toBe(219_000);
    expect(SBM_2026.terminal["D.K.I. JAKARTA"]).toBe(250_000);
    expect(SBM_2026.sewaKendaraan["BALI"]?.roda4).toBe(1_275_000);
    expect(SBM_2026.transportKegiatanPp).toBe(170_000);
    const gianyar = SBM_2026.transportIbukota.find((r) => r.kabKota === "Kab. Gianyar");
    expect(gianyar).toMatchObject({ provinsi: "BALI", ibukota: "Denpasar", besaran: 225_000 });
    const jktDps = SBM_2026.tiketPp.find((r) => r.asal === "JAKARTA" && r.tujuan === "DENPASAR");
    expect(jktDps).toMatchObject({ bisnis: 5_305_000, ekonomi: 3_262_000 });
  });

  it("konfigurasi status lengkap untuk semua status", () => {
    for (const kode of STATUS_KODE) {
      expect(SBM_2026.statusKonfigurasi[kode]).toBeDefined();
    }
    expect(SBM_2026.statusKonfigurasi.ESELON_II.barisRepresentasi).toBe(3);
    expect(SBM_2026.statusKonfigurasi.ESELON_IV_GOL_III_II_I.kolomHotel).toBe(4);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd packages/shared && npx vitest run src/sbm.test.ts`
Expected: FAIL, `Failed to resolve import "./data/sbm-2026.js"`.

- [ ] **Step 3: Tulis skrip pembuat fixture**

`scripts/build-sbm-fixture.py`:
```python
#!/usr/bin/env python3
"""Membuat packages/shared/src/data/sbm-2026.ts dari berkas 'SPJ Otomatis.xlsx' (prototipe spreadsheet yang memuat
sheet tabel SBM: Uang Harian, Uang Representasi, Penginapan, Transport ..., Tiket Pesawat PP, Sewa Kendaraan).

Pemakaian: python3 scripts/build-sbm-fixture.py "<path ke xlsx>" [keluaran.ts]
Tabel-tabel itu diekstrak dari PMK 32 Tahun 2025 (Lampiran I dan II). Berkas xlsx tidak disimpan di repo.
"""
import json
import re
import sys

import openpyxl

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "packages/shared/src/data/sbm-2026.ts"
wb = openpyxl.load_workbook(SRC, data_only=True)


def norm(s):
    return re.sub(r"\s+", " ", str(s).strip()).upper()


def rows(sheet, first, last, ncols):
    ws = wb[sheet]
    for r in range(first, last + 1):
        yield [ws.cell(r, c).value for c in range(1, ncols + 1)]


uang_harian = {norm(r[1]): {"luarKota": r[3], "dalamKota8Jam": r[4], "diklat": r[5]} for r in rows("Uang Harian", 6, 43, 6)}
representasi = [{"uraian": r[1], "luarKota": r[3], "dalamKota": r[4]} for r in rows("Uang Representasi", 6, 8, 5)]
penginapan = {norm(r[1]): [r[3], r[4], r[5], r[6]] for r in rows("Penginapan", 6, 43, 7)}
terminal = {norm(r[1]): r[3] for r in rows("Transport Bandara-Terminal", 6, 39, 4)}
tiket = [{"asal": norm(r[1]), "tujuan": norm(r[2]), "bisnis": r[3], "ekonomi": r[4]} for r in rows("Tiket Pesawat PP", 6, 321, 5)]
ibukota = [
    {"provinsi": norm(r[1]), "ibukota": r[2], "kabKota": r[3], "besaran": r[5]}
    for r in rows("Transport Ibukota-Kab", 6, 366, 6)
]
jakarta = [{"kabKota": r[2], "besaran": r[4]} for r in rows("Transport Jakarta-Sekitar", 6, 14, 5)]
kegiatan_pp = wb["Transport Jakarta-Sekitar"].cell(19, 5).value
sewa = {norm(r[1]): {"roda4": r[3], "roda6BusSedang": r[4], "busBesar": r[5]} for r in rows("Sewa Kendaraan", 6, 43, 6)}

expected = {
    "uangHarian": (uang_harian, 38), "penginapan": (penginapan, 38), "terminal": (terminal, 34), "tiket": (tiket, 316),
    "ibukota": (ibukota, 361), "jakarta": (jakarta, 9), "sewa": (sewa, 38), "representasi": (representasi, 3),
}
for nama, (data, n) in expected.items():
    assert len(data) == n, f"{nama}: {len(data)} baris, seharusnya {n}"
assert kegiatan_pp == 170000, kegiatan_pp

sbm = {
    "tahunAnggaran": 2026,
    "uangHarian": uang_harian,
    "representasi": representasi,
    "penginapan": penginapan,
    "terminal": terminal,
    "tiketPp": tiket,
    "transportIbukota": ibukota,
    "transportJakarta": jakarta,
    "transportKegiatanPp": kegiatan_pp,
    "sewaKendaraan": sewa,
    "statusKonfigurasi": {
        "PEJABAT_NEGARA_WAMEN": {"kolomHotel": 1, "barisRepresentasi": 1, "kelasTiket": "Bisnis"},
        "ESELON_I": {"kolomHotel": 1, "barisRepresentasi": 2, "kelasTiket": "Bisnis"},
        "ESELON_II": {"kolomHotel": 2, "barisRepresentasi": 3, "kelasTiket": "Ekonomi"},
        "ESELON_III_GOL_IV": {"kolomHotel": 3, "barisRepresentasi": 0, "kelasTiket": "Ekonomi"},
        "ESELON_IV_GOL_III_II_I": {"kolomHotel": 4, "barisRepresentasi": 0, "kelasTiket": "Ekonomi"},
    },
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Dihasilkan oleh scripts/build-sbm-fixture.py dari PMK 32 Tahun 2025. Jangan diedit manual.\n")
    f.write('import type { Sbm } from "../types.js";\n\n')
    f.write("export const SBM_2026: Sbm = ")
    f.write(json.dumps(sbm, ensure_ascii=False, indent=1))
    f.write(";\n")
print("ditulis", OUT)
```

- [ ] **Step 4: Hasilkan fixture**

Run (dari root `~/spjan`): `mkdir -p packages/shared/src/data && python3 scripts/build-sbm-fixture.py "/home/ryandshinevps/spj/2026/diy/SPJ Otomatis.xlsx"`
Expected: `ditulis packages/shared/src/data/sbm-2026.ts`; skrip berhenti dengan AssertionError bila jumlah baris tabel tidak sesuai.

- [ ] **Step 5: Jalankan tes dan lint**

Run: `cd packages/shared && npx vitest run && npx tsc -p tsconfig.lint.json --noEmit`
Expected: `Tests  23 passed (23)`; tsc tanpa keluaran.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan daftar berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add scripts packages/shared/src/data packages/shared/src/sbm.test.ts
git commit -m "feat(shared): data SBM PMK 32/2025 dan skrip pembuatnya

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 3: Pencarian pagu PMK

**Files:**
- Create: `packages/shared/src/pagu.ts`
- Test: `packages/shared/src/pagu.test.ts`

**Interfaces:**
- Consumes: `Sbm`, `BiayaInput` (types.ts); `formatRp`, `norm` (teks.ts); `SBM_2026` (hanya di tes).
- Produces: `interface PaguBiaya { adaPagu: boolean; nilai: number | null }`; `paguBiaya(sbm: Sbm, biaya: BiayaInput, provinsiKedudukan: string): PaguBiaya`; `catatanBiaya(sbm: Sbm, biaya: BiayaInput, provinsiKedudukan: string): string | undefined`; `paguTiket(sbm: Sbm, asal: string, tujuan: string, kelas: "Bisnis" | "Ekonomi"): number | null`.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/src/pagu.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { catatanBiaya, paguBiaya, paguTiket } from "./pagu.js";

const KEDUDUKAN = "D.K.I. JAKARTA";

describe("paguBiaya", () => {
  it("mencari pagu transport darat berdasarkan provinsi dan kab/kota persis", () => {
    expect(paguBiaya(SBM_2026, { jenis: "TRANSPORT_DARAT", provinsi: "bali", uraian: "kab. gianyar", tarif: 1 }, KEDUDUKAN)).toEqual({
      adaPagu: true,
      nilai: 225_000,
    });
  });

  it("tujuan yang tidak ada: pagu ada tetapi nilai null", () => {
    expect(paguBiaya(SBM_2026, { jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian: "Kab. Tidak Ada", tarif: 1 }, KEDUDUKAN)).toEqual({
      adaPagu: true,
      nilai: null,
    });
  });

  it("Jakarta-sekitar, kegiatan PP, terminal, taksi kedudukan, dan sewa kendaraan", () => {
    const nilai = (b: Parameters<typeof paguBiaya>[1]) => paguBiaya(SBM_2026, b, KEDUDUKAN).nilai;
    expect(nilai({ jenis: "TRANSPORT_JAKARTA_SEKITAR", uraian: "Kota Bogor", tarif: 1 })).toBe(270_000);
    expect(nilai({ jenis: "TRANSPORT_KEGIATAN_PP", tarif: 1 })).toBe(170_000);
    expect(nilai({ jenis: "TAKSI_TERMINAL", provinsi: "BALI", tarif: 1 })).toBe(219_000);
    expect(nilai({ jenis: "TAKSI_KEDUDUKAN", tarif: 1 })).toBe(250_000);
    expect(nilai({ jenis: "SEWA_RODA4", provinsi: "BALI", tarif: 1 })).toBe(1_275_000);
    expect(nilai({ jenis: "SEWA_RODA6", provinsi: "D.I. YOGYAKARTA", tarif: 1 })).toBe(2_570_000);
    expect(nilai({ jenis: "SEWA_BUS_BESAR", provinsi: "D.I. YOGYAKARTA", tarif: 1 })).toBe(3_808_000);
  });

  it("jenis tanpa pagu", () => {
    for (const jenis of ["AIRPORT_TAX_BAGASI", "KERETA_BUS_LAIN", "LAINNYA", "TIKET_PERGI"] as const) {
      expect(paguBiaya(SBM_2026, { jenis, tarif: 1 }, KEDUDUKAN)).toEqual({ adaPagu: false, nilai: null });
    }
  });
});

describe("catatanBiaya", () => {
  it("tiket tidak diberi catatan di sini", () => {
    expect(catatanBiaya(SBM_2026, { jenis: "TIKET_KEMBALI", tarif: 1 }, KEDUDUKAN)).toBeUndefined();
  });

  it("dalam pagu, melebihi pagu, tidak ditemukan, dan tanpa pagu", () => {
    const c = (tarif: number, uraian = "Kab. Gianyar") =>
      catatanBiaya(SBM_2026, { jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian, tarif }, KEDUDUKAN);
    expect(c(225_000)).toBe("Tarif dalam pagu PMK Rp225.000.");
    expect(c(226_000)).toBe("Tarif Rp226.000 melebihi pagu PMK Rp225.000 per satuan (dapat dilampaui bila riil; lampirkan bukti).");
    expect(c(1, "Kab. X")).toBe("Tujuan/provinsi tidak ditemukan di tabel PMK (harga pasar/at cost).");
    expect(catatanBiaya(SBM_2026, { jenis: "KERETA_BUS_LAIN", tarif: 1 }, KEDUDUKAN)).toBe(
      "Tidak ada pagu di PMK: biaya riil, lampirkan bukti.",
    );
  });
});

describe("paguTiket", () => {
  it("rute Jakarta-Denpasar menurut kelas", () => {
    expect(paguTiket(SBM_2026, "Jakarta", "Denpasar", "Ekonomi")).toBe(3_262_000);
    expect(paguTiket(SBM_2026, "jakarta", "denpasar", "Bisnis")).toBe(5_305_000);
  });

  it("rute yang tidak ada mengembalikan null", () => {
    expect(paguTiket(SBM_2026, "Jakarta", "Tidak Ada", "Ekonomi")).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd packages/shared && npx vitest run src/pagu.test.ts`
Expected: FAIL, `Failed to resolve import "./pagu.js"`.

- [ ] **Step 3: Tulis implementasi**

`packages/shared/src/pagu.ts`:
```ts
import { formatRp, norm } from "./teks.js";
import type { BiayaInput, Sbm } from "./types.js";

export interface PaguBiaya {
  /** false = jenis ini memang tidak punya pagu di PMK (biaya riil). */
  adaPagu: boolean;
  /** null = pagu ada tetapi tujuan/provinsi tidak ditemukan di tabel PMK. */
  nilai: number | null;
}

const TANPA_PAGU: PaguBiaya = { adaPagu: false, nilai: null };

function ada(nilai: number | null | undefined): PaguBiaya {
  return { adaPagu: true, nilai: nilai === undefined || nilai === 0 ? null : nilai };
}

/** Pagu PMK per satuan untuk satu biaya; tiket pesawat ditangani terpisah (lihat paguTiket). */
export function paguBiaya(sbm: Sbm, biaya: BiayaInput, provinsiKedudukan: string): PaguBiaya {
  const prov = norm(biaya.provinsi ?? "");
  const uraian = norm(biaya.uraian ?? "");
  switch (biaya.jenis) {
    case "TRANSPORT_DARAT":
      return ada(sbm.transportIbukota.find((r) => r.provinsi === prov && norm(r.kabKota) === uraian)?.besaran);
    case "TRANSPORT_JAKARTA_SEKITAR":
      return ada(sbm.transportJakarta.find((r) => norm(r.kabKota) === uraian)?.besaran);
    case "TRANSPORT_KEGIATAN_PP":
      return ada(sbm.transportKegiatanPp);
    case "TAKSI_KEDUDUKAN":
      return ada(sbm.terminal[norm(provinsiKedudukan)]);
    case "TAKSI_TERMINAL":
      return ada(sbm.terminal[prov]);
    case "SEWA_RODA4":
      return ada(sbm.sewaKendaraan[prov]?.roda4);
    case "SEWA_RODA6":
      return ada(sbm.sewaKendaraan[prov]?.roda6BusSedang);
    case "SEWA_BUS_BESAR":
      return ada(sbm.sewaKendaraan[prov]?.busBesar);
    default:
      return TANPA_PAGU;
  }
}

/** Catatan informatif; undefined bila tidak perlu (tiket ditangani terpisah). */
export function catatanBiaya(sbm: Sbm, biaya: BiayaInput, provinsiKedudukan: string): string | undefined {
  if (biaya.jenis === "TIKET_PERGI" || biaya.jenis === "TIKET_KEMBALI") return undefined;
  const pagu = paguBiaya(sbm, biaya, provinsiKedudukan);
  if (!pagu.adaPagu) return "Tidak ada pagu di PMK: biaya riil, lampirkan bukti.";
  if (pagu.nilai === null) return "Tujuan/provinsi tidak ditemukan di tabel PMK (harga pasar/at cost).";
  if (biaya.tarif > pagu.nilai) {
    return `Tarif ${formatRp(biaya.tarif)} melebihi pagu PMK ${formatRp(pagu.nilai)} per satuan (dapat dilampaui bila riil; lampirkan bukti).`;
  }
  return `Tarif dalam pagu PMK ${formatRp(pagu.nilai)}.`;
}

/** Pagu tiket PP (Jakarta/kedudukan ke kota tujuan) menurut kelas; null bila rute tidak ada di tabel. */
export function paguTiket(sbm: Sbm, asal: string, tujuan: string, kelas: "Bisnis" | "Ekonomi"): number | null {
  const baris = sbm.tiketPp.find((r) => r.asal === norm(asal) && r.tujuan === norm(tujuan));
  if (!baris) return null;
  return kelas === "Bisnis" ? baris.bisnis : baris.ekonomi;
}
```

- [ ] **Step 4: Jalankan tes dan lint**

Run: `cd packages/shared && npx vitest run && npx tsc -p tsconfig.lint.json --noEmit`
Expected: `Tests  31 passed (31)`; tsc tanpa keluaran.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan daftar berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add packages/shared/src/pagu.ts packages/shared/src/pagu.test.ts
git commit -m "feat(shared): pencarian pagu PMK dan catatan biaya

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 4: Mesin hitung hitungSpj dan kasus uji emas

**Files:**
- Create: `packages/shared/src/hitung.ts`
- Test: `packages/shared/src/hitung.test.ts`

**Interfaces:**
- Consumes: semua tipe domain, `catatanBiaya`, `paguTiket` (pagu.ts), utilitas teks (teks.ts), `SBM_2026` (hanya di tes).
- Produces: `hitungSpj(input: SpjInput, sbm: Sbm): SpjHasil`. Aturan: hari = pulang - berangkat + 1; malam = max(hari - 1, 0) kecuali `malamOverride`; uang harian = hari x tarif luar kota provinsi; representasi hanya bila `barisRepresentasi > 0` dan `dinasJabatan`; hotel = malam x tarif riil dan peringatan `HOTEL_MELEBIHI_BATAS` bila tarif > batas SBM menurut `kolomHotel`; biaya bertarif <= 0 dibuang; baris transport mengikuti urutan `biaya`; catatan tiket PP hanya untuk pelaksana satu etape.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/src/hitung.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { hitungSpj } from "./hitung.js";
import type { BiayaInput, EtapeInput, PelaksanaInput, SpjInput } from "./types.js";

const NOMOR_ST = "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026";
const KEG_BALI =
  "Pendampingan Audiensi terkait Rencana Pembongkaran Homestay pada areal kerja Persetujuan Pengelolaan Perhutanan Sosial di Kota Denpasar Provinsi Bali";
const KEG_YOGYA = "Rapat Koordinasi Teknis Pengelolaan Perhutanan Sosial di KHDPK di Provinsi D.I. Yogyakarta";

function spj(pelaksana: PelaksanaInput[], over: Partial<SpjInput> = {}): SpjInput {
  return {
    nomorSt: NOMOR_ST,
    tanggalSt: "2026-09-08",
    tanggalSpj: null,
    kotaKedudukan: "Jakarta",
    provinsiKedudukan: "D.K.I. JAKARTA",
    pelaksana,
    ...over,
  };
}

const etapeBali = (over: Partial<EtapeInput> = {}): EtapeInput => ({
  provinsi: "BALI",
  kota: "Denpasar",
  kegiatan: KEG_BALI,
  berangkat: "2026-09-10",
  pulang: "2026-09-11",
  ...over,
});
const etapeYogya = (over: Partial<EtapeInput> = {}): EtapeInput => ({
  provinsi: "D.I. YOGYAKARTA",
  kota: "Yogyakarta",
  kegiatan: KEG_YOGYA,
  berangkat: "2026-09-10",
  pulang: "2026-09-13",
  ...over,
});

const resa: PelaksanaInput = {
  nama: "R Resa Adam Gunawan, S.T.",
  nip: "199508222023211008",
  jabatan: "Surveyor Pemetaan Ahli Pertama",
  status: "ESELON_IV_GOL_III_II_I",
  noSpd: "403/SPD/PPS/2026",
  etape: [etapeBali({ hotelNama: "Kuto Paradiso Hotel", hotelTarif: 1_021_948 })],
  biaya: [
    { jenis: "TIKET_PERGI", tarif: 2_260_940 },
    { jenis: "TIKET_KEMBALI", tarif: 2_223_091 },
    { jenis: "TAKSI_KEDUDUKAN", qty: 2, tarif: 250_000 },
  ],
};

describe("hitungSpj - kasus emas", () => {
  it("Resa: Bali 10-11 September, total 6.965.979", () => {
    const h = hitungSpj(spj([resa]), SBM_2026).pelaksana[0]!;
    expect(h.totalTransport).toBe(4_984_031);
    expect(h.totalUangHarian).toBe(960_000);
    expect(h.totalPenginapan).toBe(1_021_948);
    expect(h.total).toBe(6_965_979);
    expect(h.terbilang).toBe("Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah");
    expect(h.peringatan).toEqual([]);
    expect(h.transport.map((r) => r.uraian)).toEqual([
      "Tiket Pesawat Jakarta ke Denpasar",
      "Tiket Pesawat Denpasar ke Jakarta",
      "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)",
    ]);
    expect(h.transport[2]).toMatchObject({ qty: 2, satuan: "kali", tarif: 250_000, jumlah: 500_000 });
    expect(h.transport[0]).toMatchObject({ qty: null, satuan: null, tarif: null, keterangan: "Bukti terlampir" });
    expect(h.uangHarian[0]).toMatchObject({
      qty: 2,
      tarif: 480_000,
      keterangan: "Lumpsum/Prov. Bali Tanggal 10-11 September 2026",
    });
    expect(h.penginapan[0]).toMatchObject({ qty: 1, satuan: "malam", keterangan: "Tanggal 10-11 September 2026, Bukti terlampir" });
    expect(h.uraianSptb).toBe(
      `Biaya Perjalanan dinas dalam rangka ${KEG_BALI} selama 2 (dua) hari pada tanggal 10 s.d. 11 September 2026 sesuai Surat Tugas Nomor: ${NOMOR_ST} tanggal 8 September 2026 dan SPD terlampir.`,
    );
  });

  it("Resa: catatan tiket melebihi pagu SBM ekonomi Rp3.262.000", () => {
    const h = hitungSpj(spj([resa]), SBM_2026).pelaksana[0]!;
    expect(h.catatan).toContain("Kelas tiket: Ekonomi.");
    expect(h.catatan).toContain("Tiket PP Rp4.484.031 melebihi pagu SBM Rp3.262.000 (biaya riil, lampirkan bukti).");
    expect(h.transport[2]?.catatan).toBe("Tarif dalam pagu PMK Rp250.000.");
  });

  it("Riandi: Yogyakarta 10-13 September, hotel 3 malam sesuai batas, belum ada transport", () => {
    const riandi: PelaksanaInput = {
      nama: "Riandi Eko Priantoro, S.Kom.",
      nip: "198404212023211020",
      jabatan: "Pranata Komputer Ahli Pertama",
      status: "ESELON_IV_GOL_III_II_I",
      noSpd: "404/SPD/PPS/2026",
      etape: [etapeYogya({ hotelNama: "The Royal Alana Yogyakarta Hotel & Convention Center", hotelTarif: 845_000 })],
      biaya: [],
    };
    const h = hitungSpj(spj([riandi]), SBM_2026).pelaksana[0]!;
    expect(h.totalUangHarian).toBe(1_680_000);
    expect(h.totalPenginapan).toBe(2_535_000);
    expect(h.total).toBe(4_215_000);
    expect(h.peringatan).toEqual([]);
    expect(h.uangHarian[0]?.keterangan).toBe("Lumpsum/Prov. D.I. Yogyakarta Tanggal 10-13 September 2026");
  });

  it("Riandi: tarif hotel di atas batas SBM memberi peringatan", () => {
    const p: PelaksanaInput = { ...resa, etape: [etapeYogya({ hotelNama: "H", hotelTarif: 900_000 })] };
    const h = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!;
    expect(h.peringatan).toEqual([
      {
        kode: "HOTEL_MELEBIHI_BATAS",
        pesan: "Etape 1: tarif hotel Rp900.000 melebihi batas SBM Rp845.000.",
        etape: 0,
      },
    ]);
  });

  it("Direktur Manado: Eselon II dinas jabatan, total 11.909.784", () => {
    const direktur: PelaksanaInput = {
      nama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
      nip: "196810191998031001",
      jabatan: "Direktur",
      status: "ESELON_II",
      noSpd: "45/SPD/PPS/2026",
      etape: [
        {
          provinsi: "SULAWESI UTARA",
          kota: "Manado",
          kegiatan: "Pelaksanaan Pemantauan Izin Perhutanan Sosial",
          berangkat: "2026-04-07",
          pulang: "2026-04-10",
          hotelNama: "Manado Quality Hotel",
          hotelTarif: 650_000,
          dinasJabatan: true,
        },
      ],
      biaya: [
        { jenis: "TIKET_PERGI", tarif: 3_689_972 },
        { jenis: "TIKET_KEMBALI", tarif: 4_189_812 },
      ],
    };
    const h = hitungSpj(spj([direktur]), SBM_2026).pelaksana[0]!;
    expect(h.totalUangHarian).toBe(1_480_000);
    expect(h.totalRepresentasi).toBe(600_000);
    expect(h.representasi[0]).toMatchObject({ qty: 4, tarif: 150_000 });
    expect(h.totalPenginapan).toBe(1_950_000);
    expect(h.totalTransport).toBe(7_879_784);
    expect(h.total).toBe(11_909_784);
    expect(h.terbilang).toBe("Sebelas Juta Sembilan Ratus Sembilan Ribu Tujuh Ratus Delapan Puluh Empat Rupiah");
  });

  it("Eselon II tanpa tanda dinas jabatan: tidak ada representasi, ada catatan hak", () => {
    const p: PelaksanaInput = {
      nama: "X",
      nip: "1",
      jabatan: "Direktur",
      status: "ESELON_II",
      noSpd: "1",
      etape: [{ provinsi: "SULAWESI UTARA", kota: "Manado", kegiatan: "K", berangkat: "2026-04-07", pulang: "2026-04-10" }],
      biaya: [],
    };
    const h = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!;
    expect(h.representasi).toEqual([]);
    expect(h.catatan).toContain("Berhak uang representasi: tandai dinas jabatan bila perjalanan dinas jabatan.");
  });

  it("Gunadi: dua etape, tiga tiket, uraian SPTB dua kegiatan", () => {
    const gunadi: PelaksanaInput = {
      nama: "Gunadi Firdaus, S.Hut., M.Si.",
      nip: "197803101997031001",
      jabatan: "Kasubdit Pemantauan Perhutanan Sosial",
      status: "ESELON_III_GOL_IV",
      noSpd: "401/SPD/PPS/2026",
      etape: [
        etapeBali({ hotelNama: "Hotel Bali", hotelTarif: 1_500_000 }),
        etapeYogya({ berangkat: "2026-09-12", pulang: "2026-09-13", hotelNama: "Hotel Yogya", hotelTarif: 1_000_000 }),
      ],
      biaya: [
        { jenis: "TIKET_PERGI", etapeIndex: 0, tarif: 1_500_000 },
        { jenis: "TAKSI_KEDUDUKAN", tarif: 250_000 },
        { jenis: "TIKET_PERGI", etapeIndex: 1, tarif: 1_200_000 },
        { jenis: "TIKET_KEMBALI", tarif: 1_900_000 },
      ],
    };
    const h = hitungSpj(spj([gunadi]), SBM_2026).pelaksana[0]!;
    expect(h.transport.map((r) => r.uraian)).toEqual([
      "Tiket Pesawat Jakarta ke Denpasar",
      "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)",
      "Tiket Pesawat Denpasar ke Yogyakarta",
      "Tiket Pesawat Yogyakarta ke Jakarta",
    ]);
    expect(h.totalUangHarian).toBe(1_800_000);
    expect(h.totalPenginapan).toBe(2_500_000);
    expect(h.total).toBe(9_150_000);
    expect(h.uraianSptb).toBe(
      `Biaya Perjalanan dinas dalam rangka ${KEG_BALI} selama 2 (dua) hari pada tanggal 10 s.d. 11 September 2026 dan ${KEG_YOGYA} selama 2 (dua) hari pada tanggal 12 s.d. 13 September 2026 sesuai Surat Tugas Nomor: ${NOMOR_ST} tanggal 8 September 2026 dan SPD terlampir.`,
    );
    expect(h.catatan.some((c) => c.startsWith("Tiket PP"))).toBe(false);
  });

  it("total SPTB menjumlahkan semua pelaksana", () => {
    const hasil = hitungSpj(spj([resa, resa]), SBM_2026);
    expect(hasil.total).toBe(13_931_958);
    expect(hasil.terbilang).toBe("Tiga Belas Juta Sembilan Ratus Tiga Puluh Satu Ribu Sembilan Ratus Lima Puluh Delapan Rupiah");
    expect(hasil.teksTanggalSt).toBe("8 September 2026");
    expect(hasil.teksTanggalSpj).toBe("");
  });
});

describe("hitungSpj - pagu biaya tambahan", () => {
  const dasar: PelaksanaInput = { ...resa, etape: [etapeBali()], biaya: [] };
  const dengan = (b: BiayaInput) => hitungSpj(spj([{ ...dasar, biaya: [b] }]), SBM_2026).pelaksana[0]!.transport[0]!;

  it("transport darat: Kab. Gianyar pagu Rp225.000", () => {
    const r = dengan({ jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian: "Kab. Gianyar", qty: 2, tarif: 200_000 });
    expect(r.uraian).toBe("Transport darat ibukota ke kab/kota - Kab. Gianyar");
    expect(r.jumlah).toBe(400_000);
    expect(r.catatan).toBe("Tarif dalam pagu PMK Rp225.000.");
  });

  it("sewa kendaraan roda 4 Bali di atas pagu Rp1.275.000", () => {
    const r = dengan({ jenis: "SEWA_RODA4", provinsi: "BALI", uraian: "Sewa mobil di Bali", qty: 2, tarif: 1_500_000 });
    expect(r).toMatchObject({ satuan: "hari", jumlah: 3_000_000 });
    expect(r.catatan).toBe(
      "Tarif Rp1.500.000 melebihi pagu PMK Rp1.275.000 per satuan (dapat dilampaui bila riil; lampirkan bukti).",
    );
  });

  it("taksi terminal Bali di atas pagu Rp219.000", () => {
    expect(dengan({ jenis: "TAKSI_TERMINAL", provinsi: "BALI", qty: 2, tarif: 300_000 }).catatan).toBe(
      "Tarif Rp300.000 melebihi pagu PMK Rp219.000 per satuan (dapat dilampaui bila riil; lampirkan bukti).",
    );
  });

  it("transport kegiatan dalam kab/kota PP Rp170.000", () => {
    expect(dengan({ jenis: "TRANSPORT_KEGIATAN_PP", tarif: 170_000 }).catatan).toBe("Tarif dalam pagu PMK Rp170.000.");
  });

  it("jenis tanpa pagu dan tujuan tidak ditemukan", () => {
    expect(dengan({ jenis: "AIRPORT_TAX_BAGASI", uraian: "Bagasi pesawat", tarif: 250_000 }).catatan).toBe(
      "Tidak ada pagu di PMK: biaya riil, lampirkan bukti.",
    );
    expect(dengan({ jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian: "Kab. Tidak Ada", tarif: 100_000 }).catatan).toBe(
      "Tujuan/provinsi tidak ditemukan di tabel PMK (harga pasar/at cost).",
    );
  });

  it("uraian LAINNYA memakai teks bebas dan baris tarif nol dibuang", () => {
    const h = hitungSpj(spj([{ ...dasar, biaya: [{ jenis: "LAINNYA", uraian: "Parkir bandara", tarif: 20_000 }, { jenis: "LAINNYA", uraian: "Kosong", tarif: 0 }] }]), SBM_2026).pelaksana[0]!;
    expect(h.transport.map((r) => r.uraian)).toEqual(["Parkir bandara"]);
  });
});

describe("hitungSpj - peringatan data", () => {
  it("data kosong menghasilkan peringatan lengkap", () => {
    const p: PelaksanaInput = {
      nama: "Baru",
      nip: "",
      jabatan: "",
      status: null,
      etape: [
        { provinsi: "", kota: "", kegiatan: "", berangkat: "", pulang: "" },
        etapeBali({ berangkat: "2026-09-12", pulang: "2026-09-10" }),
        etapeBali({ hotelTarif: null }),
      ],
      biaya: [],
    };
    const kode = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!.peringatan.map((x) => x.kode);
    expect(kode).toEqual([
      "STATUS_PEGAWAI_KOSONG",
      "NIP_KOSONG",
      "NO_SPD_KOSONG",
      "DATA_BELUM_LENGKAP",
      "TANGGAL_SALAH",
      "TARIF_HOTEL_KOSONG",
    ]);
  });

  it("lintas bulan dan override malam", () => {
    const p: PelaksanaInput = {
      ...resa,
      etape: [etapeBali({ berangkat: "2026-09-30", pulang: "2026-10-02", malamOverride: 1, hotelNama: "H", hotelTarif: 1_000_000 })],
      biaya: [],
    };
    const h = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!;
    expect(h.uangHarian[0]?.keterangan).toBe("Lumpsum/Prov. Bali Tanggal 30 September - 2 Oktober 2026");
    expect(h.uangHarian[0]?.qty).toBe(3);
    expect(h.penginapan[0]?.qty).toBe(1);
    expect(h.uraianSptb).toContain("selama 3 (tiga) hari pada tanggal 30 September s.d. 2 Oktober 2026");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd packages/shared && npx vitest run src/hitung.test.ts`
Expected: FAIL, `Failed to resolve import "./hitung.js"`.

- [ ] **Step 3: Tulis implementasi**

`packages/shared/src/hitung.ts`:
```ts
import { catatanBiaya, paguTiket } from "./pagu.js";
import {
  angkaKata,
  formatRp,
  norm,
  parseTanggal,
  proper,
  rentangRincian,
  rentangSptb,
  selisihHari,
  tanggalIndonesia,
  terbilangRupiah,
} from "./teks.js";
import type {
  BarisBiaya,
  BiayaInput,
  EtapeInput,
  JenisBiaya,
  PelaksanaHasil,
  PelaksanaInput,
  Peringatan,
  Sbm,
  SpjHasil,
  SpjInput,
} from "./types.js";

const KETERANGAN_DEFAULT = "Bukti terlampir";
const URAIAN_TAKSI_KEDUDUKAN = "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)";

const SEWA = new Set<JenisBiaya>(["SEWA_RODA4", "SEWA_RODA6", "SEWA_BUS_BESAR"]);

const LABEL_URAIAN: Partial<Record<JenisBiaya, string>> = {
  TRANSPORT_DARAT: "Transport darat ibukota ke kab/kota",
  TRANSPORT_JAKARTA_SEKITAR: "Transport Jakarta ke kota sekitar",
  TRANSPORT_KEGIATAN_PP: "Transport kegiatan dalam kab/kota PP",
  TAKSI_TERMINAL: "Taksi/transport dari-ke bandara/terminal",
  SEWA_RODA4: "Sewa kendaraan roda 4 per hari",
  SEWA_RODA6: "Sewa kendaraan roda 6/bus sedang per hari",
  SEWA_BUS_BESAR: "Sewa kendaraan bus besar per hari",
  AIRPORT_TAX_BAGASI: "Airport tax / bagasi / retribusi",
  KERETA_BUS_LAIN: "Kereta api / bus / lainnya",
};

function ada(s: string | null | undefined): boolean {
  return !!s && s.trim() !== "";
}

function uraianBiaya(b: BiayaInput, input: SpjInput, etape: EtapeInput[]): string {
  const uraian = (b.uraian ?? "").trim();
  const kedudukan = input.kotaKedudukan;
  switch (b.jenis) {
    case "TIKET_PERGI": {
      if (uraian) return uraian;
      const i = b.etapeIndex ?? 0;
      const tujuan = etape[i]?.kota ?? "";
      const asal = i > 0 ? (etape[i - 1]?.kota ?? kedudukan) : kedudukan;
      return `Tiket Pesawat ${asal} ke ${tujuan}`;
    }
    case "TIKET_KEMBALI": {
      if (uraian) return uraian;
      const i = b.etapeIndex ?? etape.length - 1;
      return `Tiket Pesawat ${etape[i]?.kota ?? ""} ke ${kedudukan}`;
    }
    case "TAKSI_KEDUDUKAN":
      return uraian || URAIAN_TAKSI_KEDUDUKAN;
    case "LAINNYA":
      return uraian || "Biaya lainnya";
    default: {
      const label = LABEL_URAIAN[b.jenis] ?? b.jenis;
      return uraian ? `${label} - ${uraian}` : label;
    }
  }
}

function barisTransport(b: BiayaInput, input: SpjInput, etape: EtapeInput[], sbm: Sbm): BarisBiaya | null {
  if (!(b.tarif > 0)) return null;
  const qty = b.qty && b.qty > 0 ? b.qty : 1;
  const tampil = qty > 1;
  const satuanDefault = SEWA.has(b.jenis) ? "hari" : "kali";
  const catatan = catatanBiaya(sbm, b, input.provinsiKedudukan);
  return {
    uraian: uraianBiaya(b, input, etape),
    qty: tampil ? qty : null,
    satuan: tampil ? ada(b.satuan) ? (b.satuan as string) : satuanDefault : null,
    tarif: tampil ? b.tarif : null,
    jumlah: Math.round(qty * b.tarif),
    keterangan: ada(b.keterangan) ? (b.keterangan as string) : KETERANGAN_DEFAULT,
    ...(catatan ? { catatan } : {}),
  };
}

interface HasilEtape {
  uangHarian?: BarisBiaya;
  representasi?: BarisBiaya;
  penginapan?: BarisBiaya;
  peringatan: Peringatan[];
  uraianSptb?: string;
}

function hitungEtape(e: EtapeInput, i: number, p: PelaksanaInput, sbm: Sbm): HasilEtape {
  const peringatan: Peringatan[] = [];
  const nomor = `Etape ${i + 1}`;
  const a = parseTanggal(e.berangkat);
  const b = parseTanggal(e.pulang);
  if (!ada(e.provinsi) || !ada(e.kota) || !a || !b) {
    peringatan.push({ kode: "DATA_BELUM_LENGKAP", pesan: `${nomor}: provinsi, kota, dan tanggal wajib diisi.`, etape: i });
    return { peringatan };
  }
  const hari = selisihHari(a, b) + 1;
  if (hari < 1) {
    peringatan.push({ kode: "TANGGAL_SALAH", pesan: `${nomor}: tanggal pulang lebih awal dari berangkat.`, etape: i });
    return { peringatan };
  }
  const prov = norm(e.provinsi);
  const tarifHarian = sbm.uangHarian[prov]?.luarKota;
  if (tarifHarian === undefined) {
    peringatan.push({ kode: "DATA_BELUM_LENGKAP", pesan: `${nomor}: provinsi "${e.provinsi}" tidak ada di tabel SBM.`, etape: i });
    return { peringatan };
  }
  const malam = e.malamOverride != null ? e.malamOverride : Math.max(hari - 1, 0);
  const rincian = rentangRincian(a, b);
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined;
  const hasil: HasilEtape = { peringatan };

  hasil.uangHarian = {
    uraian: "selama :",
    qty: hari,
    satuan: "hari",
    tarif: tarifHarian,
    jumlah: hari * tarifHarian,
    keterangan: `Lumpsum/Prov. ${proper(e.provinsi)} Tanggal ${rincian}`,
  };

  if (cfg && cfg.barisRepresentasi > 0 && e.dinasJabatan) {
    const tarifRep = sbm.representasi[cfg.barisRepresentasi - 1]?.luarKota;
    if (tarifRep !== undefined) {
      hasil.representasi = {
        uraian: "Representasi selama :",
        qty: hari,
        satuan: "hari",
        tarif: tarifRep,
        jumlah: hari * tarifRep,
        keterangan: `Uang representasi, Tanggal ${rincian}`,
      };
    }
  }

  const tarifHotel = e.hotelTarif ?? 0;
  if (malam > 0) {
    if (!(tarifHotel > 0)) {
      peringatan.push({ kode: "TARIF_HOTEL_KOSONG", pesan: `${nomor}: tarif hotel belum diisi (${malam} malam).`, etape: i });
    } else {
      hasil.penginapan = {
        uraian: (e.hotelNama ?? "").trim(),
        qty: malam,
        satuan: "malam",
        tarif: tarifHotel,
        jumlah: malam * tarifHotel,
        keterangan: `Tanggal ${rincian}, Bukti terlampir`,
      };
      const batas = cfg ? sbm.penginapan[prov]?.[cfg.kolomHotel - 1] : undefined;
      if (batas !== undefined && tarifHotel > batas) {
        peringatan.push({
          kode: "HOTEL_MELEBIHI_BATAS",
          pesan: `${nomor}: tarif hotel ${formatRp(tarifHotel)} melebihi batas SBM ${formatRp(batas)}.`,
          etape: i,
        });
      }
    }
  }

  const kata = hari <= 99 ? ` (${angkaKata(hari)})` : "";
  hasil.uraianSptb = `${e.kegiatan.trim()} selama ${hari}${kata} hari pada tanggal ${rentangSptb(a, b)}`;
  return hasil;
}

function jumlah(baris: BarisBiaya[]): number {
  return baris.reduce((s, r) => s + r.jumlah, 0);
}

function hitungPelaksana(p: PelaksanaInput, input: SpjInput, sbm: Sbm): PelaksanaHasil {
  const peringatan: Peringatan[] = [];
  const catatan: string[] = [];
  if (!p.status) peringatan.push({ kode: "STATUS_PEGAWAI_KOSONG", pesan: "Status/golongan pegawai belum dipilih." });
  if (!ada(p.nip)) peringatan.push({ kode: "NIP_KOSONG", pesan: "NIP belum diisi." });
  if (!ada(p.noSpd)) peringatan.push({ kode: "NO_SPD_KOSONG", pesan: "Nomor SPD belum diisi." });

  const uangHarian: BarisBiaya[] = [];
  const representasi: BarisBiaya[] = [];
  const penginapan: BarisBiaya[] = [];
  const segmen: string[] = [];
  p.etape.forEach((e, i) => {
    const h = hitungEtape(e, i, p, sbm);
    peringatan.push(...h.peringatan);
    if (h.uangHarian) uangHarian.push(h.uangHarian);
    if (h.representasi) representasi.push(h.representasi);
    if (h.penginapan) penginapan.push(h.penginapan);
    if (h.uraianSptb) segmen.push(h.uraianSptb);
  });

  const transport = p.biaya
    .map((b) => barisTransport(b, input, p.etape, sbm))
    .filter((r): r is BarisBiaya => r !== null);

  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined;
  if (cfg) {
    catatan.push(`Kelas tiket: ${cfg.kelasTiket}.`);
    if (cfg.barisRepresentasi > 0 && !p.etape.some((e) => e.dinasJabatan)) {
      catatan.push("Berhak uang representasi: tandai dinas jabatan bila perjalanan dinas jabatan.");
    }
    if (p.etape.length === 1 && p.etape[0]) {
      const tiket = p.biaya
        .filter((b) => b.jenis === "TIKET_PERGI" || b.jenis === "TIKET_KEMBALI")
        .reduce((s, b) => s + Math.round((b.qty && b.qty > 0 ? b.qty : 1) * b.tarif), 0);
      if (tiket > 0) {
        const pagu = paguTiket(sbm, input.kotaKedudukan, p.etape[0].kota, cfg.kelasTiket);
        if (pagu === null) catatan.push("Rute tiket tidak ada di tabel SBM (biaya riil).");
        else if (tiket > pagu) {
          catatan.push(`Tiket PP ${formatRp(tiket)} melebihi pagu SBM ${formatRp(pagu)} (biaya riil, lampirkan bukti).`);
        } else catatan.push(`Tiket PP dalam pagu SBM ${formatRp(pagu)}.`);
      }
    }
  }

  const totalTransport = jumlah(transport);
  const totalUangHarian = jumlah(uangHarian);
  const totalRepresentasi = jumlah(representasi);
  const totalPenginapan = jumlah(penginapan);
  const total = totalTransport + totalUangHarian + totalRepresentasi + totalPenginapan;
  const uraianSptb =
    segmen.length > 0
      ? `Biaya Perjalanan dinas dalam rangka ${segmen.join(" dan ")} sesuai Surat Tugas Nomor: ${input.nomorSt} tanggal ${tanggalIndonesia(input.tanggalSt)} dan SPD terlampir.`
      : "";

  return {
    nama: p.nama,
    nip: p.nip,
    jabatan: p.jabatan,
    status: p.status,
    noSpd: (p.noSpd ?? "").trim(),
    transport,
    uangHarian,
    representasi,
    penginapan,
    totalTransport,
    totalUangHarian,
    totalRepresentasi,
    totalPenginapan,
    total,
    terbilang: terbilangRupiah(total),
    uraianSptb,
    peringatan,
    catatan,
  };
}

export function hitungSpj(input: SpjInput, sbm: Sbm): SpjHasil {
  const pelaksana = input.pelaksana.map((p) => hitungPelaksana(p, input, sbm));
  const total = pelaksana.reduce((s, p) => s + p.total, 0);
  return {
    pelaksana,
    total,
    terbilang: terbilangRupiah(total),
    teksTanggalSt: tanggalIndonesia(input.tanggalSt),
    teksTanggalSpj: tanggalIndonesia(input.tanggalSpj),
  };
}
```

- [ ] **Step 4: Jalankan seluruh tes dan lint**

Run: `cd packages/shared && npx vitest run && npx tsc -p tsconfig.lint.json --noEmit`
Expected: `Tests  47 passed (47)`; tsc tanpa keluaran.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan daftar berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add packages/shared/src/hitung.ts packages/shared/src/hitung.test.ts
git commit -m "feat(shared): mesin hitung SPJ dengan kasus uji emas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 5: Permukaan publik paket, build, dan dokumentasi repo

**Files:**
- Create: `packages/shared/src/index.ts`, `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-04-spjan-design.md` (bagian 11 sudah memuat penyesuaian; pastikan ada)

**Interfaces:**
- Consumes: semua modul Task 1-4.
- Produces: paket `@spjan/shared` yang dapat diimpor dari workspace lain (`import { hitungSpj, SBM_2026 } from "@spjan/shared"`) lewat `dist/index.js` dan `dist/index.d.ts`. Ini kontrak yang dipakai rencana 1B dan 1C.

- [ ] **Step 1: Tulis index.ts**

`packages/shared/src/index.ts`:
```ts
export * from "./types.js";
export * from "./teks.js";
export * from "./pagu.js";
export * from "./hitung.js";
export { SBM_2026 } from "./data/sbm-2026.js";
```

- [ ] **Step 2: Build**

Run (dari root): `npm run build`
Expected: `tsc -p tsconfig.json` selesai tanpa galat; `packages/shared/dist/` berisi `index.js`, `index.d.ts`, `hitung.js`, `pagu.js`, `teks.js`, `types.js`, `data/`; tidak ada berkas `*.test.*`.

- [ ] **Step 3: Uji impor dari workspace**

Run (dari root):
```bash
node -e "import('@spjan/shared').then(m=>{const r=m.hitungSpj({nomorSt:'X',tanggalSt:'2026-09-08',kotaKedudukan:'Jakarta',provinsiKedudukan:'D.K.I. JAKARTA',pelaksana:[]},m.SBM_2026);console.log(JSON.stringify(r))})"
```
Expected: `{"pelaksana":[],"total":0,"terbilang":"Nol Rupiah","teksTanggalSt":"8 September 2026","teksTanggalSpj":""}`

- [ ] **Step 4: Tulis CLAUDE.md**

`CLAUDE.md`:
```markdown
# SPJAN

Aplikasi web untuk menyusun SPJ perjalanan dinas (SPTB, Rincian Biaya Perjalanan Dinas, Kuitansi)
Direktorat Pengendalian Perhutanan Sosial. Satu pengguna. Domain produksi: spjan.ditpps.com.
Arsitektur dan aturan hitung: `docs/superpowers/specs/2026-10-04-spjan-design.md`.

## Struktur monorepo (npm workspaces)

```
apps/api/        Fastify + TypeScript + PostgreSQL            (belum ada; rencana tahap berikutnya)
apps/web/        React + Vite + TypeScript                     (belum ada)
packages/shared/ Tipe dan mesin hitung SPJ (@spjan/shared)
scripts/         Skrip bantu (mis. pembuat fixture SBM)
docs/superpowers/{specs,plans}/
```

## Perintah

Dari root: `npm run build`, `npm run test`, `npm run lint`.
Di `packages/shared`: `npm run test` (vitest), `npm run lint` (`tsc --noEmit`, termasuk file tes), `npm run build`.

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

- [ ] **Step 5: Jalankan semua gerbang dari root**

Run: `npm run lint && npm run test && npm run build`
Expected: lint dan build tanpa galat; `Tests  47 passed (47)`.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan daftar berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add CLAUDE.md packages/shared/src/index.ts docs
git commit -m "docs: CLAUDE.md repo dan ekspor publik @spjan/shared

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

## Self-Review

1. **Cakupan spec:** bagian 3 (monorepo, shared, mesin hitung murni) = Task 1, 5; bagian 5 (aturan hitung: hari/malam, uang harian, hotel dan batas, representasi, biaya dan pagu, terbilang, teks tanggal, uraian SPTB, peringatan) = Task 1, 3, 4; bagian 4 (data SBM) sebagai fixture = Task 2; bagian 9 (kasus uji emas: Resa, Riandi, Manado, Gunadi, terbilang, rentang tanggal, pagu) = Task 1-4; bagian 11 (provinsiKedudukan, etapeIndex) = types.ts dan Task 4. Bagian API, web, deploy, auth sengaja di rencana 1B-1D.
2. **Placeholder:** tidak ada; semua langkah memuat isi berkas lengkap dan perintah dengan keluaran yang diharapkan.
3. **Konsistensi tipe:** nama dan tanda tangan di blok Interfaces sama dengan berkas yang disalin (`hitungSpj`, `paguBiaya`, `catatanBiaya`, `paguTiket`, `terbilangRupiah`, `rentangRincian`, `rentangSptb`).
