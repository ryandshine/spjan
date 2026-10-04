# SPJAN Tahap 2A (Fondasi Ekstraksi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pondasi pembacaan dokumen: unggah dan simpan berkas, antrean + worker ekstraksi, klien Ollama, pengaturan Model AI (dengan Uji model), dan klasifikasi jenis berkas, siap dipakai oleh 2B (ST jadi draf), 2C (invoice hotel), 2D (tiket dan transport).

**Architecture:** Semua di `apps/api` (tanpa container baru). Berkas disimpan lewat antarmuka `BerkasStore` (implementasi sistem berkas pada Docker volume), metadata dan antrean di Postgres (`FOR UPDATE SKIP LOCKED`), model dipanggil lewat antarmuka `KlienAi` (implementasi Ollama `/api/chat`, dapat diganti pembaca palsu pada tes). Hasil ekstraksi 2A hanya klasifikasi jenis berkas; ekstraktor per jenis ditambahkan 2B-2D tanpa mengubah worker.

**Tech Stack:** Fastify 5 + `@fastify/multipart`, pg, node-pg-migrate (SQL), zod 4 (`z.toJSONSchema`), poppler-utils (`pdftotext`, `pdftoppm`), vitest dengan Postgres nyata `spjan_test`, React 19 + TanStack Query untuk kartu Pengaturan.

**Spec:** `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md`

## Global Constraints

- Bahasa antarmuka dan pesan galat: Indonesia. Identifier kode mengikuti gaya yang ada (`tambahBerkas`, `konfigurasiAi`, dll).
- Tipe id memakai `bigserial` seperti tabel lain (deviasi dari spec yang menyebut uuid; spec diperbarui di Task 11). Id dikirim ke klien sebagai `number`.
- Batas unggah: jpg/png/webp/pdf, 10 MB per berkas, 30 berkas per ST (`BATAS_BERKAS` di shared). Jenis diperiksa dari isi (magic bytes), bukan ekstensi.
- Model AI tidak dikodekan keras: URL/model dari tabel `model_ai`, URL bawaan dari env `OLLAMA_URL` (default `http://172.17.0.1:11434`).
- Log tidak boleh memuat isi dokumen atau nama orang; hanya id, model, durasi, status.
- Semua rute baru di bawah `/api/` otomatis berada di belakang sesi login dan pemeriksaan Origin (hook `onRequest` di `app.ts`).
- Tes API memakai Postgres nyata (`spjan_test`, `docker compose -f docker-compose.dev.yml up -d`), bukan mock DB. Pemanggilan model selalu lewat `KlienAi` palsu; tidak ada tes yang memanggil jaringan luar.
- Setelah mengubah `packages/shared`, jalankan `npm run build -w @spjan/shared` sebelum tes/lint API (API mengimpor dari `dist`).
- Frontend tanpa tes otomatis (konvensi proyek); verifikasi dengan `npm run lint -w web` dan `npm run build -w web`.
- Commit per tugas (disetujui). **Push dan deploy butuh persetujuan pengguna terpisah** (Task 11). Akhiri pesan commit dengan:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM
  ```

## Peta Berkas

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/berkas.ts` (baru) | Konstanta, DTO, skema zod `ModelAiPayloadSchema`, `HasilKlasifikasiSchema`, tipe hasil uji |
| `apps/api/migrations/1791126000001_berkas.sql` (baru) | Tabel `berkas`, `ekstraksi`, `model_ai` |
| `apps/api/src/berkas/store.ts` (baru) | `BerkasStore`, `FileBerkasStore` |
| `apps/api/src/berkas/deteksi.ts` (baru) | `deteksiMime` dari magic bytes |
| `apps/api/src/repositories/berkas.ts` (baru) | CRUD berkas, dedupe, batas, pembersihan file yatim |
| `apps/api/src/routes/berkas.ts` (baru) | Unggah (multipart), daftar, isi, hapus, ulang |
| `apps/api/src/ai/klien.ts` (baru) | `KlienAi`, `PermintaanAi`, `AiGalat`, `KonfigurasiAi` |
| `apps/api/src/ai/ollama.ts` (baru) | `klienOllama` (HTTP ke `/api/chat`) |
| `apps/api/src/ai/skema.ts` (baru) | `skemaJson` (zod ke JSON Schema untuk Ollama) |
| `apps/api/src/ai/uji.ts` (baru) | `ujiModel` |
| `apps/api/src/repositories/model-ai.ts` (baru) | Baca/simpan `model_ai`, `konfigurasiAi` |
| `apps/api/src/routes/model-ai.ts` (baru) | GET/PUT `/api/model-ai`, POST `/api/model-ai/uji` |
| `apps/api/src/ekstraksi/baca-berkas.ts` (baru) | PDF/gambar menjadi `IsiBerkas` (teks atau gambar) |
| `apps/api/src/ekstraksi/klasifikasi.ts` (baru) | Prompt + validasi klasifikasi jenis |
| `apps/api/src/ekstraksi/worker.ts` (baru) | Antrean, klaim, proses, retry, pemulihan |
| `apps/api/src/app.ts`, `config.ts`, `server.ts`, `routes/surat-tugas.ts` (ubah) | Pengkabelan |
| `apps/api/src/test-support/helpers.ts` (ubah) | Helper tes (multipart, PNG, PDF, klien palsu) |
| `apps/api/scripts/probe-llm.ts` (baru) | Uji manual model terhadap dokumen asli |
| `Dockerfile.combined`, `docker-compose.dokploy.yml`, `apps/web/nginx.conf.template`, `docs/deploy.md` (ubah) | poppler, volume, env, batas unggah |
| `apps/web/src/lib/api.ts`, `lib/queries.ts`, `components/model-ai-card.tsx` (baru), `pages/pengaturan.tsx` (ubah) | Kartu Model AI |

---

### Task 1: Tipe dan skema bersama

**Files:**
- Create: `packages/shared/src/berkas.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/berkas.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces: `JENIS_BERKAS`, `JenisBerkas`, `STATUS_EKSTRAKSI`, `StatusEkstraksi`, `STATUS_USULAN`, `StatusUsulan`, `KODE_GALAT_AI`, `KodeGalatAi`, `BATAS_BERKAS`, `MIME_BERKAS`, `MimeBerkas`, `EkstraksiDto`, `BerkasDto`, `ModelAiPayloadSchema`, `ModelAiPayload`, `ModelAiDto`, `UjiModelHasil`, `HasilKlasifikasiSchema`, `HasilKlasifikasi`.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/src/berkas.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { BATAS_BERKAS, HasilKlasifikasiSchema, JENIS_BERKAS, ModelAiPayloadSchema } from "./berkas.js";

describe("ModelAiPayloadSchema", () => {
  it("menerima nilai null (pakai bawaan) dan nilai terisi", () => {
    expect(ModelAiPayloadSchema.parse({ llmUrl: null, modelTeks: null, modelGambar: null })).toEqual({
      llmUrl: null,
      modelTeks: null,
      modelGambar: null,
    });
    expect(
      ModelAiPayloadSchema.parse({ llmUrl: "http://172.17.0.1:11434", modelTeks: " gpt-oss:120b-cloud ", modelGambar: "kimi-k3:cloud" }),
    ).toEqual({ llmUrl: "http://172.17.0.1:11434", modelTeks: "gpt-oss:120b-cloud", modelGambar: "kimi-k3:cloud" });
  });

  it("menolak URL tidak valid dan nama model kosong", () => {
    expect(ModelAiPayloadSchema.safeParse({ llmUrl: "bukan url", modelTeks: null, modelGambar: null }).success).toBe(false);
    expect(ModelAiPayloadSchema.safeParse({ llmUrl: null, modelTeks: "   ", modelGambar: null }).success).toBe(false);
  });
});

describe("HasilKlasifikasiSchema", () => {
  it("hanya menerima jenis dokumen yang dikenal (bukan 'belum')", () => {
    expect(HasilKlasifikasiSchema.parse({ jenis: "hotel", ringkasan: "Invoice hotel" }).jenis).toBe("hotel");
    expect(HasilKlasifikasiSchema.safeParse({ jenis: "belum", ringkasan: "" }).success).toBe(false);
    expect(HasilKlasifikasiSchema.safeParse({ jenis: "pesawat", ringkasan: "" }).success).toBe(false);
  });
});

describe("konstanta", () => {
  it("batas berkas sesuai spec", () => {
    expect(BATAS_BERKAS).toEqual({ maksUkuranMb: 10, maksPerSt: 30 });
    expect(JENIS_BERKAS).toEqual(["belum", "st", "hotel", "tiket", "transport", "lainnya"]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd ~/spjan/packages/shared && npx vitest run src/berkas.test.ts`
Expected: FAIL, modul `./berkas.js` tidak ditemukan.

- [ ] **Step 3: Implementasi**

`packages/shared/src/berkas.ts`:
```ts
import { z } from "zod";

export const JENIS_BERKAS = ["belum", "st", "hotel", "tiket", "transport", "lainnya"] as const;
export type JenisBerkas = (typeof JENIS_BERKAS)[number];

export const JENIS_BERKAS_LABEL: Record<JenisBerkas, string> = {
  belum: "Belum dikenali",
  st: "Surat tugas",
  hotel: "Invoice hotel",
  tiket: "Tiket",
  transport: "Bukti transport",
  lainnya: "Lainnya",
};

export const STATUS_EKSTRAKSI = ["antre", "berjalan", "selesai", "gagal"] as const;
export type StatusEkstraksi = (typeof STATUS_EKSTRAKSI)[number];

export const STATUS_USULAN = ["menunggu", "diterapkan", "diabaikan"] as const;
export type StatusUsulan = (typeof STATUS_USULAN)[number];

export const KODE_GALAT_AI = [
  "MODEL_PENSIUN",
  "MODEL_TIDAK_TERSEDIA",
  "MODEL_BELUM_DIATUR",
  "HASIL_TIDAK_VALID",
  "WAKTU_HABIS",
  "BERKAS_TIDAK_TERBACA",
  "GALAT_INTERNAL",
] as const;
export type KodeGalatAi = (typeof KODE_GALAT_AI)[number];

export const BATAS_BERKAS = { maksUkuranMb: 10, maksPerSt: 30 } as const;

export const MIME_BERKAS = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type MimeBerkas = (typeof MIME_BERKAS)[number];

export interface EkstraksiDto {
  id: number;
  berkasId: number;
  status: StatusEkstraksi;
  model: string | null;
  hasil: unknown;
  kodeGalat: KodeGalatAi | null;
  galat: string | null;
  usulanStatus: StatusUsulan;
  createdAt: string;
  selesaiAt: string | null;
}

export interface BerkasDto {
  id: number;
  /** null = belum terkait surat tugas (mis. ST yang baru diunggah untuk dijadikan draf). */
  stId: number | null;
  namaAsli: string;
  mime: MimeBerkas;
  ukuran: number;
  sha256: string;
  jenis: JenisBerkas;
  createdAt: string;
  /** Ekstraksi terbaru; null bila belum pernah dijadwalkan. */
  ekstraksi: EkstraksiDto | null;
}

export const ModelAiPayloadSchema = z.object({
  llmUrl: z.url().max(200).nullable(),
  modelTeks: z.string().trim().min(1).max(100).nullable(),
  modelGambar: z.string().trim().min(1).max(100).nullable(),
});
export type ModelAiPayload = z.infer<typeof ModelAiPayloadSchema>;

export interface ModelAiDto extends ModelAiPayload {
  /** URL yang dipakai bila `llmUrl` null (dari env OLLAMA_URL). */
  bawaanUrl: string;
}

export interface UjiModelHasil {
  ok: boolean;
  model: string | null;
  durasiMs: number;
  balasan?: string;
  kode?: KodeGalatAi;
  pesan?: string;
}

export const HasilKlasifikasiSchema = z.object({
  jenis: z.enum(["st", "hotel", "tiket", "transport", "lainnya"]),
  ringkasan: z.string().max(300),
});
export type HasilKlasifikasi = z.infer<typeof HasilKlasifikasiSchema>;
```
Tambahkan ke `packages/shared/src/index.ts` baris: `export * from "./berkas.js";`

- [ ] **Step 4: Jalankan tes, pastikan lulus, lalu build**

Run: `cd ~/spjan && npm test -w @spjan/shared && npm run build -w @spjan/shared`
Expected: semua tes shared lulus (60 lama + baru), build tanpa galat.

- [ ] **Step 5: Commit**
```bash
git add packages/shared/src/berkas.ts packages/shared/src/berkas.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): tipe dan skema berkas, ekstraksi, dan model AI"
```

---

### Task 2: Migrasi basis data

**Files:**
- Create: `apps/api/migrations/1791126000001_berkas.sql`
- Modify: `apps/api/src/schema.test.ts`, `apps/api/src/test-support/helpers.ts`

**Interfaces:**
- Produces tabel: `berkas(id, st_id, nama_asli, mime, ukuran, sha256, jenis, created_at)`, `ekstraksi(id, berkas_id, status, model, hasil, kode_galat, galat, usulan_status, percobaan, created_at, mulai_at, selesai_at)`, `model_ai(id=1, llm_url, model_teks, model_gambar, updated_at)`.

- [ ] **Step 1: Perbarui tes skema (gagal dulu)**

Di `apps/api/src/schema.test.ts`, ubah daftar tabel menjadi:
```ts
for (const tabel of ["berkas", "biaya", "ekstraksi", "etape", "model_ai", "pegawai", "pelaksana", "pengaturan", "pgmigrations", "sbm_versi", "sessions", "surat_tugas", "users"]) {
```
dan tambahkan tes:
```ts
  it("baris model_ai tunggal berisi model teks bawaan dan URL kosong", async () => {
    const { rows } = await pool.query("select llm_url, model_teks, model_gambar from model_ai");
    expect(rows).toEqual([{ llm_url: null, model_teks: "gpt-oss:120b-cloud", model_gambar: null }]);
  });

  it("berkas unik per ST+sha256, termasuk saat st_id kosong", async () => {
    await pool.query("insert into berkas (nama_asli, mime, ukuran, sha256) values ('a.png','image/png',1,'aa')");
    await expect(
      pool.query("insert into berkas (nama_asli, mime, ukuran, sha256) values ('b.png','image/png',1,'aa')"),
    ).rejects.toMatchObject({ code: "23505" });
    await pool.query("delete from berkas");
  });
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd ~/spjan/apps/api && npx vitest run src/schema.test.ts`
Expected: FAIL (tabel `berkas`, `ekstraksi`, `model_ai` belum ada).

- [ ] **Step 3: Tulis migrasi**

`apps/api/migrations/1791126000001_berkas.sql`:
```sql
-- Up Migration
create table berkas (
  id bigserial primary key,
  st_id bigint references surat_tugas (id) on delete cascade,
  nama_asli text not null,
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  ukuran integer not null check (ukuran > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]+$'),
  jenis text not null default 'belum' check (jenis in ('belum', 'st', 'hotel', 'tiket', 'transport', 'lainnya')),
  created_at timestamptz not null default now()
);
-- coalesce: dua berkas tanpa ST dengan isi sama juga dianggap ganda
create unique index berkas_st_sha_idx on berkas ((coalesce(st_id, 0)), sha256);
create index berkas_st_idx on berkas (st_id);

create table ekstraksi (
  id bigserial primary key,
  berkas_id bigint not null references berkas (id) on delete cascade,
  status text not null default 'antre' check (status in ('antre', 'berjalan', 'selesai', 'gagal')),
  model text,
  hasil jsonb,
  kode_galat text,
  galat text,
  usulan_status text not null default 'menunggu' check (usulan_status in ('menunggu', 'diterapkan', 'diabaikan')),
  percobaan integer not null default 0,
  created_at timestamptz not null default now(),
  mulai_at timestamptz,
  selesai_at timestamptz
);
create index ekstraksi_antre_idx on ekstraksi (id) where status = 'antre';
create index ekstraksi_berkas_idx on ekstraksi (berkas_id, id desc);

create table model_ai (
  id smallint primary key default 1 check (id = 1),
  llm_url text,
  model_teks text,
  model_gambar text,
  updated_at timestamptz not null default now()
);
insert into model_ai (id, model_teks) values (1, 'gpt-oss:120b-cloud');

-- Down Migration
drop table model_ai;
drop table ekstraksi;
drop table berkas;
```

- [ ] **Step 4: Perbarui `bersihkanData` di helper tes**

Di `apps/api/src/test-support/helpers.ts`, setelah baris `truncate surat_tugas, pegawai ...`, tambahkan:
```ts
  await pool.query("truncate berkas, ekstraksi restart identity cascade");
  await pool.query("update model_ai set llm_url = null, model_teks = 'gpt-oss:120b-cloud', model_gambar = null where id = 1");
```

- [ ] **Step 5: Jalankan seluruh tes API**

Run: `cd ~/spjan/apps/api && npm test`
Expected: semua lulus (23 lama + 2 baru).

- [ ] **Step 6: Commit**
```bash
git add apps/api/migrations/1791126000001_berkas.sql apps/api/src/schema.test.ts apps/api/src/test-support/helpers.ts
git commit -m "feat(api): migrasi tabel berkas, ekstraksi, dan model_ai"
```

---

### Task 3: Konfigurasi, BerkasStore, dan deteksi jenis berkas

**Files:**
- Modify: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`
- Create: `apps/api/src/berkas/store.ts`, `apps/api/src/berkas/deteksi.ts`
- Test: `apps/api/src/berkas/store.test.ts`, `apps/api/src/berkas/deteksi.test.ts`

**Interfaces:**
- Produces: `config.BERKAS_DIR: string`, `config.OLLAMA_URL: string`; `interface BerkasStore { put(sha256, data): Promise<void>; get(sha256): Promise<Buffer>; delete(sha256): Promise<void>; has(sha256): Promise<boolean> }`; `class FileBerkasStore(root: string)`; `deteksiMime(data: Buffer): MimeBerkas | null`.

- [ ] **Step 1: Tes yang gagal**

Tambahkan di `apps/api/src/config.test.ts` (dalam `describe`):
```ts
  it("BERKAS_DIR dan OLLAMA_URL punya nilai bawaan dan dapat diganti", async () => {
    let config = await muatConfig();
    expect(config.BERKAS_DIR).toBe("./data/berkas");
    expect(config.OLLAMA_URL).toBe("http://172.17.0.1:11434");
    vi.stubEnv("BERKAS_DIR", "/data/berkas");
    vi.stubEnv("OLLAMA_URL", "http://ollama:11434");
    config = await muatConfig();
    expect(config.BERKAS_DIR).toBe("/data/berkas");
    expect(config.OLLAMA_URL).toBe("http://ollama:11434");
  });
```
`apps/api/src/berkas/deteksi.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { deteksiMime } from "./deteksi.js";

const b = (...byte: number[]) => Buffer.from(byte);

describe("deteksiMime", () => {
  it("mengenali PDF, JPEG, PNG, dan WEBP dari isi", () => {
    expect(deteksiMime(Buffer.from("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(deteksiMime(Buffer.concat([b(0xff, 0xd8, 0xff, 0xe0), Buffer.alloc(20)]))).toBe("image/jpeg");
    expect(deteksiMime(Buffer.concat([b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), Buffer.alloc(20)]))).toBe("image/png");
    expect(deteksiMime(Buffer.concat([Buffer.from("RIFF"), b(0, 0, 0, 0), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]))).toBe("image/webp");
  });

  it("menolak jenis lain dan berkas terlalu pendek", () => {
    expect(deteksiMime(Buffer.from("halo dunia ini teks biasa"))).toBeNull();
    expect(deteksiMime(Buffer.from("MZ\x90\x00"))).toBeNull();
    expect(deteksiMime(Buffer.alloc(0))).toBeNull();
    expect(deteksiMime(Buffer.from("RIFF1234WAVEfmt "))).toBeNull();
  });
});
```
`apps/api/src/berkas/store.test.ts`:
```ts
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileBerkasStore } from "./store.js";

const SHA = "ab".repeat(32);
let dir: string;
let store: FileBerkasStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "spjan-store-"));
  store = new FileBerkasStore(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("FileBerkasStore", () => {
  it("menyimpan, membaca, dan menghapus isi berdasarkan sha256", async () => {
    expect(await store.has(SHA)).toBe(false);
    await store.put(SHA, Buffer.from("isi berkas"));
    expect(await store.has(SHA)).toBe(true);
    expect((await store.get(SHA)).toString()).toBe("isi berkas");
    await store.delete(SHA);
    expect(await store.has(SHA)).toBe(false);
    await store.delete(SHA); // idempoten
  });

  it("menaruh berkas di subfolder dua heks pertama dan tidak meninggalkan berkas sementara", async () => {
    await store.put(SHA, Buffer.from("x"));
    expect(await readdir(path.join(dir, "ab"))).toEqual([SHA]);
  });

  it("put kedua dengan sha sama tidak menimpa", async () => {
    await store.put(SHA, Buffer.from("pertama"));
    await store.put(SHA, Buffer.from("kedua"));
    expect((await store.get(SHA)).toString()).toBe("pertama");
  });

  it("menolak kunci yang bukan sha256 heks (mencegah path traversal)", async () => {
    await expect(store.put("../../etc/passwd", Buffer.from("x"))).rejects.toThrow("sha256 tidak valid");
    await expect(store.get("abc")).rejects.toThrow("sha256 tidak valid");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd ~/spjan/apps/api && npx vitest run src/config.test.ts src/berkas`
Expected: FAIL (modul belum ada; `BERKAS_DIR` undefined).

- [ ] **Step 3: Implementasi**

Di `apps/api/src/config.ts`, tambahkan di `envSchema` setelah `SESSION_TTL_DAYS`:
```ts
  BERKAS_DIR: z.string().min(1).default("./data/berkas"),
  OLLAMA_URL: z.string().min(1).default("http://172.17.0.1:11434"),
```
`apps/api/src/berkas/deteksi.ts`:
```ts
import type { MimeBerkas } from "@spjan/shared";

/** Jenis berkas dari byte awal; ekstensi dan Content-Type kiriman klien tidak dipercaya. */
export function deteksiMime(data: Buffer): MimeBerkas | null {
  if (data.length >= 5 && data.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (data.length >= 12 && data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}
```
`apps/api/src/berkas/store.ts`:
```ts
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SHA256 = /^[0-9a-f]{64}$/;

/** Penyimpanan berkas beralamat isi (sha256). Implementasi S3/MinIO dapat ditambahkan tanpa mengubah pemakai. */
export interface BerkasStore {
  put(sha256: string, data: Buffer): Promise<void>;
  get(sha256: string): Promise<Buffer>;
  delete(sha256: string): Promise<void>;
  has(sha256: string): Promise<boolean>;
}

export class FileBerkasStore implements BerkasStore {
  constructor(private readonly root: string) {}

  private lokasi(sha256: string): string {
    if (!SHA256.test(sha256)) throw new Error("sha256 tidak valid");
    return path.join(this.root, sha256.slice(0, 2), sha256);
  }

  async put(sha256: string, data: Buffer): Promise<void> {
    const tujuan = this.lokasi(sha256);
    if (await this.has(sha256)) return;
    await mkdir(path.dirname(tujuan), { recursive: true });
    const sementara = `${tujuan}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(sementara, data);
    await rename(sementara, tujuan);
  }

  async get(sha256: string): Promise<Buffer> {
    return readFile(this.lokasi(sha256));
  }

  async delete(sha256: string): Promise<void> {
    await rm(this.lokasi(sha256), { force: true });
  }

  async has(sha256: string): Promise<boolean> {
    try {
      await stat(this.lokasi(sha256));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
}
```
Catatan: `has("abc")` melempar karena `lokasi` memvalidasi; itu disengaja (kunci tidak valid adalah bug pemanggil).

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd ~/spjan/apps/api && npx vitest run src/config.test.ts src/berkas && npm run lint`
Expected: lulus, lint bersih.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/src/berkas
git commit -m "feat(api): konfigurasi berkas/Ollama, BerkasStore, dan deteksi jenis dari isi"
```

---

### Task 4: Repositori dan rute berkas

**Files:**
- Create: `apps/api/src/repositories/berkas.ts`, `apps/api/src/routes/berkas.ts`
- Modify: `apps/api/package.json` (dependensi), `apps/api/src/app.ts`, `apps/api/src/routes/surat-tugas.ts`, `apps/api/src/test-support/helpers.ts`, `apps/web/nginx.conf.template`
- Test: `apps/api/src/berkas.test.ts`

**Interfaces:**
- Consumes: `BerkasStore`, `deteksiMime`, `BATAS_BERKAS`, `BerkasDto`.
- Produces (repositori): `tambahBerkas(db, store, { stId: number | null, namaAsli: string, data: Buffer }): Promise<{ dto: BerkasDto; duplikat: boolean }>`; `listBerkas(db, stId: number | null): Promise<BerkasDto[]>`; `getBerkas(db, id): Promise<BerkasDto | null>`; `metaBerkas(db, id): Promise<{ id: number; namaAsli: string; mime: MimeBerkas; sha256: string } | null>`; `hapusBerkas(db, store, id): Promise<boolean>`; `shaBerkasSt(db, stId): Promise<string[]>`; `hapusFileYatim(db, store, shas: string[]): Promise<void>`; `ulangiEkstraksi(db, berkasId): Promise<boolean>`; `stAda(db, stId): Promise<boolean>`.
- Produces (rute) di prefix `/api/berkas`: `POST /?stId=` (multipart field apa saja, satu berkas) membalas `{ berkas, duplikat }` 201/200; `GET /?stId=` (tanpa stId = berkas tanpa ST); `GET /:id/isi`; `DELETE /:id` 204; `POST /:id/ulang` 200 dengan `BerkasDto`.
- Produces (pengkabelan): `buildApp(db, opts: { logger?: boolean; store?: BerkasStore; klien?: KlienAi })` (`klien` dipakai Task 5); `siapkanApp(opts?)` di helper; `suratTugasRoutes` menerima `store` dan menghapus file yatim saat ST dihapus.
- Helper tes baru: `PNG_1X1: Buffer`, `pngUnik(n: number): Buffer`, `bodyMultipart(nama, isi): { payload: Buffer; headers: { "content-type": string } }`, `pdfSederhana(teks: string): Buffer`.

- [ ] **Step 1: Tambah dependensi dan helper tes**

Run: `cd ~/spjan && npm install @fastify/multipart@^10 -w api`

Di `apps/api/src/test-support/helpers.ts`:
- Ubah impor dan `siapkanApp`:
```ts
import type { BerkasStore } from "../berkas/store.js";
import type { KlienAi } from "../ai/klien.js";

export async function siapkanApp(opts: { store?: BerkasStore; klien?: KlienAi } = {}): Promise<FastifyInstance> {
  await seedSbm(pool);
  await ensureAdmin(pool);
  return buildApp(pool, { logger: false, ...opts });
}
```
(Impor `KlienAi` baru valid setelah Task 5; sementara buat `apps/api/src/ai/klien.ts` hanya dengan antarmuka di Step 3 Task 4 agar `tsc` lulus; isi lengkapnya ditulis di Task 5. Lihat Step 3.)
- Tambahkan di akhir berkas:
```ts
/** PNG 1x1 yang sah. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

/** PNG sah dengan isi berbeda untuk setiap n (byte tambahan setelah IEND diabaikan pembaca gambar). */
export const pngUnik = (n: number): Buffer => Buffer.concat([PNG_1X1, Buffer.from([n % 256, Math.floor(n / 256)])]);

export function bodyMultipart(nama: string, isi: Buffer): { payload: Buffer; headers: { "content-type": string } } {
  const batas = `----spjantest${Math.random().toString(16).slice(2)}`;
  const kepala = Buffer.from(
    `--${batas}\r\nContent-Disposition: form-data; name="berkas"; filename="${nama}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const ekor = Buffer.from(`\r\n--${batas}--\r\n`);
  return { payload: Buffer.concat([kepala, isi, ekor]), headers: { "content-type": `multipart/form-data; boundary=${batas}` } };
}

/** PDF satu halaman. Teks kosong menghasilkan halaman tanpa lapisan teks (meniru hasil pindai). Teks hanya ASCII. */
export function pdfSederhana(teks: string): Buffer {
  const isi = teks ? `BT /F1 12 Tf 50 750 Td (${teks.replace(/[()\\]/g, "")}) Tj ET` : "";
  const objek = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${isi.length} >>\nstream\n${isi}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offset: number[] = [];
  objek.forEach((o, i) => {
    offset.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
  out += offset.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`apps/api/src/berkas.test.ts`:
```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { FileBerkasStore } from "./berkas/store.js";
import { closePool, pool } from "./db.js";
import { bersihkanData, bodyMultipart, loginCookie, PNG_1X1, pngUnik, siapkanApp, stResa } from "./test-support/helpers.js";

let app: FastifyInstance;
let cookie: string;
let dir: string;
let store: FileBerkasStore;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "spjan-berkas-"));
  store = new FileBerkasStore(dir);
  app = await siapkanApp({ store });
  cookie = await loginCookie(app);
});
afterAll(async () => {
  await app.close();
  await closePool();
  await rm(dir, { recursive: true, force: true });
});
beforeEach(bersihkanData);

const unggah = (nama: string, isi: Buffer, query = "") => {
  const { payload, headers } = bodyMultipart(nama, isi);
  return app.inject({ method: "POST", url: `/api/berkas${query}`, headers: { cookie, ...headers }, payload });
};
const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const buatSt = async () => (await call("POST", "/api/surat-tugas", stResa)).json().id as number;

describe("unggah berkas", () => {
  it("menyimpan berkas, jenis 'belum', dan menjadwalkan ekstraksi", async () => {
    const res = await unggah("invoice.png", pngUnik(1));
    expect(res.statusCode).toBe(201);
    const { berkas, duplikat } = res.json();
    expect(duplikat).toBe(false);
    expect(berkas).toMatchObject({
      stId: null,
      namaAsli: "invoice.png",
      mime: "image/png",
      jenis: "belum",
      ekstraksi: { status: "antre", usulanStatus: "menunggu", hasil: null },
    });
    expect(await store.has(berkas.sha256)).toBe(true);
  });

  it("menerima berkas lebih besar dari bodyLimit JSON (3 MB)", async () => {
    const res = await unggah("besar.png", Buffer.concat([PNG_1X1, Buffer.alloc(3 * 1024 * 1024, 7)]));
    expect(res.statusCode).toBe(201);
  });

  it("mengabaikan berkas yang sama (sha256) pada ST yang sama", async () => {
    const pertama = await unggah("a.png", pngUnik(2));
    const kedua = await unggah("salinan.png", pngUnik(2));
    expect(kedua.statusCode).toBe(200);
    expect(kedua.json().duplikat).toBe(true);
    expect(kedua.json().berkas.id).toBe(pertama.json().berkas.id);
    expect((await call("GET", "/api/berkas")).json()).toHaveLength(1);
    const { rows } = await pool.query("select count(*)::int as n from ekstraksi");
    expect(rows[0].n).toBe(1);
  });

  it("memisahkan daftar berkas per ST dan berkas tanpa ST", async () => {
    const stId = await buatSt();
    await unggah("lepas.png", pngUnik(3));
    await unggah("untuk-st.png", pngUnik(4), `?stId=${stId}`);
    const lepas = (await call("GET", "/api/berkas")).json();
    const milikSt = (await call("GET", `/api/berkas?stId=${stId}`)).json();
    expect(lepas.map((b: { namaAsli: string }) => b.namaAsli)).toEqual(["lepas.png"]);
    expect(milikSt.map((b: { namaAsli: string; stId: number }) => [b.namaAsli, b.stId])).toEqual([["untuk-st.png", stId]]);
  });

  it("berkas yang sama boleh ada di ST berbeda", async () => {
    const a = await buatSt();
    const b = await buatSt();
    expect((await unggah("x.png", pngUnik(5), `?stId=${a}`)).statusCode).toBe(201);
    expect((await unggah("x.png", pngUnik(5), `?stId=${b}`)).statusCode).toBe(201);
  });

  it("404 bila ST tidak ada, 415 bila bukan pdf/gambar, 413 bila lebih dari 10 MB", async () => {
    expect((await unggah("x.png", pngUnik(6), "?stId=999999")).statusCode).toBe(404);
    const salahJenis = await unggah("catatan.png", Buffer.from("ini teks biasa, bukan gambar"));
    expect(salahJenis.statusCode).toBe(415);
    expect(salahJenis.json().error).toBe("JENIS_TIDAK_DIDUKUNG");
    const besar = await unggah("raksasa.png", Buffer.concat([PNG_1X1, Buffer.alloc(10 * 1024 * 1024)]));
    expect(besar.statusCode).toBe(413);
    expect(besar.json().error).toBe("BERKAS_TERLALU_BESAR");
  });

  it("menolak berkas ke-31 pada satu ST (409 BATAS_BERKAS)", async () => {
    const stId = await buatSt();
    for (let i = 0; i < 30; i += 1) {
      expect((await unggah(`b${i}.png`, pngUnik(100 + i), `?stId=${stId}`)).statusCode).toBe(201);
    }
    const res = await unggah("b30.png", pngUnik(200), `?stId=${stId}`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("BATAS_BERKAS");
  });

  it("permintaan tanpa berkas ditolak (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/berkas",
      headers: { cookie, "content-type": "multipart/form-data; boundary=x" },
      payload: "--x--\r\n",
    });
    expect(res.statusCode).toBe(400);
  });

  it("menolak tanpa login (401)", async () => {
    const { payload, headers } = bodyMultipart("x.png", pngUnik(7));
    const res = await app.inject({ method: "POST", url: "/api/berkas", headers, payload });
    expect(res.statusCode).toBe(401);
  });
});

describe("isi, hapus, dan ulang", () => {
  it("GET /:id/isi mengembalikan byte asli dengan tipe dan nama berkas", async () => {
    const isi = pngUnik(8);
    const { berkas } = (await unggah("bukti hotel.png", isi)).json();
    const res = await call("GET", `/api/berkas/${berkas.id}/isi`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toContain("bukti%20hotel.png");
    expect(res.rawPayload.equals(isi)).toBe(true);
    expect((await call("GET", "/api/berkas/999999/isi")).statusCode).toBe(404);
  });

  it("DELETE menghapus baris dan file, tetapi file dipertahankan selama masih dipakai berkas lain", async () => {
    const a = await buatSt();
    const b = await buatSt();
    const satu = (await unggah("x.png", pngUnik(9), `?stId=${a}`)).json().berkas;
    const dua = (await unggah("x.png", pngUnik(9), `?stId=${b}`)).json().berkas;
    expect(satu.sha256).toBe(dua.sha256);
    expect((await call("DELETE", `/api/berkas/${satu.id}`)).statusCode).toBe(204);
    expect(await store.has(satu.sha256)).toBe(true);
    expect((await call("DELETE", `/api/berkas/${dua.id}`)).statusCode).toBe(204);
    expect(await store.has(satu.sha256)).toBe(false);
    expect((await call("DELETE", `/api/berkas/${dua.id}`)).statusCode).toBe(404);
  });

  it("menghapus ST ikut menghapus berkas dan filenya", async () => {
    const stId = await buatSt();
    const { berkas } = (await unggah("x.png", pngUnik(10), `?stId=${stId}`)).json();
    expect((await call("DELETE", `/api/surat-tugas/${stId}`)).statusCode).toBe(204);
    const { rows } = await pool.query("select count(*)::int as n from berkas");
    expect(rows[0].n).toBe(0);
    expect(await store.has(berkas.sha256)).toBe(false);
  });

  it("POST /:id/ulang menambah ekstraksi baru berstatus antre", async () => {
    const { berkas } = (await unggah("x.png", pngUnik(11))).json();
    await pool.query("update ekstraksi set status = 'gagal', kode_galat = 'MODEL_PENSIUN', galat = 'x' where berkas_id = $1", [berkas.id]);
    const res = await call("POST", `/api/berkas/${berkas.id}/ulang`);
    expect(res.statusCode).toBe(200);
    expect(res.json().ekstraksi).toMatchObject({ status: "antre", kodeGalat: null });
    const { rows } = await pool.query("select count(*)::int as n from ekstraksi where berkas_id = $1", [berkas.id]);
    expect(rows[0].n).toBe(2);
    expect((await call("POST", "/api/berkas/999999/ulang")).statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd ~/spjan/apps/api && npx vitest run src/berkas.test.ts`
Expected: FAIL (rute `/api/berkas` belum ada; juga impor `../ai/klien.js` belum ada).

Buat dulu `apps/api/src/ai/klien.ts` minimal agar kompilasi (diperluas di Task 5):
```ts
import type { KodeGalatAi } from "@spjan/shared";

export interface PermintaanAi {
  baseUrl: string;
  model: string;
  prompt: string;
  /** Gambar base64 (tanpa prefiks data:). */
  gambar?: string[];
  /** JSON Schema untuk keluaran terstruktur. */
  skema?: object;
  timeoutMs?: number;
}

export interface KlienAi {
  chat(permintaan: PermintaanAi): Promise<string>;
}

export interface KonfigurasiAi {
  llmUrl: string;
  modelTeks: string | null;
  modelGambar: string | null;
}

export class AiGalat extends Error {
  constructor(
    readonly kode: KodeGalatAi,
    message: string,
  ) {
    super(message);
  }
}
```

- [ ] **Step 4: Implementasi repositori**

`apps/api/src/repositories/berkas.ts`:
```ts
import { createHash } from "node:crypto";
import { BATAS_BERKAS, type BerkasDto, type JenisBerkas, type KodeGalatAi, type MimeBerkas, type StatusEkstraksi, type StatusUsulan } from "@spjan/shared";

import { deteksiMime } from "../berkas/deteksi.js";
import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

interface Row {
  id: number;
  st_id: number | null;
  nama_asli: string;
  mime: MimeBerkas;
  ukuran: number;
  sha256: string;
  jenis: JenisBerkas;
  created_at: Date;
  e_id: number | null;
  e_status: StatusEkstraksi | null;
  e_model: string | null;
  e_hasil: unknown;
  e_kode_galat: KodeGalatAi | null;
  e_galat: string | null;
  e_usulan_status: StatusUsulan | null;
  e_created_at: Date | null;
  e_selesai_at: Date | null;
}

const SELECT_BERKAS = `
  select b.id, b.st_id, b.nama_asli, b.mime, b.ukuran, b.sha256, b.jenis, b.created_at,
         e.id as e_id, e.status as e_status, e.model as e_model, e.hasil as e_hasil,
         e.kode_galat as e_kode_galat, e.galat as e_galat, e.usulan_status as e_usulan_status,
         e.created_at as e_created_at, e.selesai_at as e_selesai_at
    from berkas b
    left join lateral (select * from ekstraksi where berkas_id = b.id order by id desc limit 1) e on true`;

function map(r: Row): BerkasDto {
  return {
    id: r.id,
    stId: r.st_id,
    namaAsli: r.nama_asli,
    mime: r.mime,
    ukuran: r.ukuran,
    sha256: r.sha256,
    jenis: r.jenis,
    createdAt: r.created_at.toISOString(),
    ekstraksi:
      r.e_id === null || r.e_status === null || r.e_usulan_status === null || r.e_created_at === null
        ? null
        : {
            id: r.e_id,
            berkasId: r.id,
            status: r.e_status,
            model: r.e_model,
            hasil: r.e_hasil ?? null,
            kodeGalat: r.e_kode_galat,
            galat: r.e_galat,
            usulanStatus: r.e_usulan_status,
            createdAt: r.e_created_at.toISOString(),
            selesaiAt: r.e_selesai_at ? r.e_selesai_at.toISOString() : null,
          },
  };
}

export async function stAda(db: Db, stId: number): Promise<boolean> {
  const { rows } = await db.query("select 1 from surat_tugas where id = $1", [stId]);
  return rows.length > 0;
}

export async function getBerkas(db: Db, id: number): Promise<BerkasDto | null> {
  const { rows } = await db.query<Row>(`${SELECT_BERKAS} where b.id = $1`, [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function listBerkas(db: Db, stId: number | null): Promise<BerkasDto[]> {
  const { rows } = await db.query<Row>(`${SELECT_BERKAS} where b.st_id is not distinct from $1 order by b.id`, [stId]);
  return rows.map(map);
}

export async function metaBerkas(
  db: Db,
  id: number,
): Promise<{ id: number; namaAsli: string; mime: MimeBerkas; sha256: string } | null> {
  const { rows } = await db.query<{ id: number; nama_asli: string; mime: MimeBerkas; sha256: string }>(
    "select id, nama_asli, mime, sha256 from berkas where id = $1",
    [id],
  );
  const r = rows[0];
  return r ? { id: r.id, namaAsli: r.nama_asli, mime: r.mime, sha256: r.sha256 } : null;
}

function bersihkanNama(nama: string): string {
  const bersih = nama.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 200);
  return bersih === "" ? "berkas" : bersih;
}

export async function tambahBerkas(
  db: Db,
  store: BerkasStore,
  input: { stId: number | null; namaAsli: string; data: Buffer },
): Promise<{ dto: BerkasDto; duplikat: boolean }> {
  const mime = deteksiMime(input.data);
  if (!mime) {
    throw new HttpError(415, "JENIS_TIDAK_DIDUKUNG", "Hanya PDF, JPG, PNG, atau WEBP yang dapat diunggah.");
  }
  const { rows: hitung } = await db.query<{ n: number }>(
    "select count(*)::int as n from berkas where st_id is not distinct from $1",
    [input.stId],
  );
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const { rows: ada } = await db.query<{ id: number }>(
    "select id from berkas where st_id is not distinct from $1 and sha256 = $2",
    [input.stId, sha256],
  );
  if (ada[0]) {
    const dto = await getBerkas(db, ada[0].id);
    return { dto: dto as BerkasDto, duplikat: true };
  }
  if ((hitung[0]?.n ?? 0) >= BATAS_BERKAS.maksPerSt) {
    throw new HttpError(409, "BATAS_BERKAS", `Satu surat tugas maksimal ${BATAS_BERKAS.maksPerSt} berkas.`);
  }
  await store.put(sha256, input.data);
  const { rows } = await db.query<{ id: number }>(
    `with b as (
       insert into berkas (st_id, nama_asli, mime, ukuran, sha256) values ($1, $2, $3, $4, $5) returning id
     ), e as (
       insert into ekstraksi (berkas_id) select id from b returning id
     )
     select id from b`,
    [input.stId, bersihkanNama(input.namaAsli), mime, input.data.length, sha256],
  );
  const dto = await getBerkas(db, (rows[0] as { id: number }).id);
  return { dto: dto as BerkasDto, duplikat: false };
}

/** Hapus file dari penyimpanan bila sha256 sudah tidak dipakai berkas mana pun. */
export async function hapusFileYatim(db: Db, store: BerkasStore, shas: string[]): Promise<void> {
  for (const sha of new Set(shas)) {
    const { rows } = await db.query("select 1 from berkas where sha256 = $1 limit 1", [sha]);
    if (rows.length === 0) await store.delete(sha);
  }
}

export async function hapusBerkas(db: Db, store: BerkasStore, id: number): Promise<boolean> {
  const { rows } = await db.query<{ sha256: string }>("delete from berkas where id = $1 returning sha256", [id]);
  if (!rows[0]) return false;
  await hapusFileYatim(db, store, [rows[0].sha256]);
  return true;
}

export async function shaBerkasSt(db: Db, stId: number): Promise<string[]> {
  const { rows } = await db.query<{ sha256: string }>("select distinct sha256 from berkas where st_id = $1", [stId]);
  return rows.map((r) => r.sha256);
}

export async function ulangiEkstraksi(db: Db, berkasId: number): Promise<boolean> {
  const { rowCount } = await db.query("insert into ekstraksi (berkas_id) select id from berkas where id = $1", [berkasId]);
  return (rowCount ?? 0) > 0;
}
```

- [ ] **Step 5: Implementasi rute dan pengkabelan**

`apps/api/src/routes/berkas.ts`:
```ts
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { BATAS_BERKAS } from "@spjan/shared";
import { z } from "zod";

import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { HttpError, notFound } from "../errors.js";
import { getBerkas, hapusBerkas, listBerkas, metaBerkas, stAda, tambahBerkas, ulangiEkstraksi } from "../repositories/berkas.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });
const StQuerySchema = z.object({ stId: z.coerce.number().int().positive().optional() });

export async function berkasRoutes(app: FastifyInstance, opts: { db: Db; store: BerkasStore }): Promise<void> {
  // multipart dibaca sebagai aliran sehingga tidak terkena bodyLimit JSON (1 MB) di app.ts.
  await app.register(multipart, { limits: { fileSize: BATAS_BERKAS.maksUkuranMb * 1024 * 1024, files: 1, fields: 0 } });

  app.post("/", async (req, reply) => {
    const { stId } = StQuerySchema.parse(req.query);
    if (stId !== undefined && !(await stAda(opts.db, stId))) throw notFound("Surat tugas");
    const file = await req.file();
    if (!file) throw new HttpError(400, "BERKAS_KOSONG", "Tidak ada berkas pada permintaan.");
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        throw new HttpError(413, "BERKAS_TERLALU_BESAR", `Berkas melebihi ${BATAS_BERKAS.maksUkuranMb} MB.`);
      }
      throw error;
    }
    const { dto, duplikat } = await tambahBerkas(opts.db, opts.store, { stId: stId ?? null, namaAsli: file.filename, data });
    return reply.code(duplikat ? 200 : 201).send({ berkas: dto, duplikat });
  });

  app.get("/", async (req) => {
    const { stId } = StQuerySchema.parse(req.query);
    return listBerkas(opts.db, stId ?? null);
  });

  app.get("/:id/isi", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const meta = await metaBerkas(opts.db, id);
    if (!meta) throw notFound("Berkas");
    let data: Buffer;
    try {
      data = await opts.store.get(meta.sha256);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new HttpError(404, "BERKAS_HILANG", "Isi berkas tidak ada di penyimpanan.");
      }
      throw error;
    }
    return reply
      .header("content-type", meta.mime)
      .header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(meta.namaAsli)}`)
      .header("cache-control", "private, max-age=3600")
      .send(data);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await hapusBerkas(opts.db, opts.store, id))) throw notFound("Berkas");
    return reply.code(204).send();
  });

  app.post("/:id/ulang", async (req) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await ulangiEkstraksi(opts.db, id))) throw notFound("Berkas");
    return getBerkas(opts.db, id);
  });
}
```
`apps/api/src/app.ts`:
- impor: `import { FileBerkasStore, type BerkasStore } from "./berkas/store.js";`, `import type { KlienAi } from "./ai/klien.js";`, `import { berkasRoutes } from "./routes/berkas.js";`
- signature: `export async function buildApp(db: Db, opts: { logger?: boolean; store?: BerkasStore; klien?: KlienAi } = {})`
- di awal fungsi (setelah `const app = Fastify(...)`): `const store = opts.store ?? new FileBerkasStore(config.BERKAS_DIR);`
- ganti pendaftaran ST: `await app.register(suratTugasRoutes, { prefix: "/api/surat-tugas", db, store });`
- tambah: `await app.register(berkasRoutes, { prefix: "/api/berkas", db, store });`

`apps/api/src/routes/surat-tugas.ts`:
- impor: `import type { BerkasStore } from "../berkas/store.js";` dan `import { hapusFileYatim, shaBerkasSt } from "../repositories/berkas.js";`
- signature: `opts: { db: Db; store: BerkasStore }`
- handler hapus menjadi:
```ts
  app.delete("/:id", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const shas = await shaBerkasSt(opts.db, id);
    if (!(await deleteSuratTugas(opts.db, id))) throw notFound("Surat tugas");
    await hapusFileYatim(opts.db, opts.store, shas);
    return reply.code(204).send();
  });
```
`apps/web/nginx.conf.template`: pada blok `location /api/` ganti `client_max_body_size 2m;` menjadi `client_max_body_size 12m;` (API menegakkan batasnya sendiri: JSON 1 MB, berkas 10 MB).

- [ ] **Step 6: Jalankan tes API penuh dan lint**

Run: `cd ~/spjan/apps/api && npm test && npm run lint`
Expected: semua lulus, termasuk `berkas.test.ts` (12 tes baru) dan `surat-tugas.test.ts` yang sudah ada.

- [ ] **Step 7: Commit**
```bash
git add apps/api apps/web/nginx.conf.template package-lock.json
git commit -m "feat(api): unggah, daftar, unduh, hapus, dan ulang ekstraksi berkas"
```

---

### Task 5: Klien Ollama, Model AI, dan Uji model

**Files:**
- Modify: `apps/api/src/ai/klien.ts` (sudah ada dari Task 4, tidak berubah), `apps/api/src/app.ts`
- Create: `apps/api/src/ai/ollama.ts`, `apps/api/src/ai/skema.ts`, `apps/api/src/ai/uji.ts`, `apps/api/src/repositories/model-ai.ts`, `apps/api/src/routes/model-ai.ts`
- Modify: `apps/api/src/test-support/helpers.ts` (klien palsu)
- Test: `apps/api/src/ai/ollama.test.ts`, `apps/api/src/model-ai.test.ts`

**Interfaces:**
- Consumes: `KlienAi`, `PermintaanAi`, `AiGalat`, `KonfigurasiAi`, `ModelAiPayloadSchema`, `UjiModelHasil`.
- Produces: `klienOllama: KlienAi`; `skemaJson(skema: z.ZodType): object`; `ujiModel(klien, konf, jenis: "teks" | "gambar"): Promise<UjiModelHasil>`; `getModelAi(db): Promise<ModelAiPayload>`; `saveModelAi(db, p): Promise<ModelAiPayload>`; `konfigurasiAi(db): Promise<KonfigurasiAi>` (URL = DB ?? `config.OLLAMA_URL`); rute `GET/PUT /api/model-ai`, `POST /api/model-ai/uji` body `{ jenis: "teks" | "gambar" }`; helper tes `klienPalsu(balas): KlienAi & { panggilan: PermintaanAi[] }`.

- [ ] **Step 1: Helper klien palsu**

Tambahkan di `apps/api/src/test-support/helpers.ts`:
```ts
import { AiGalat, type KlienAi, type PermintaanAi } from "../ai/klien.js";
```
(gabungkan dengan impor `KlienAi` yang sudah ada), dan di akhir berkas:
```ts
/** Klien palsu: `balas` menerima permintaan dan mengembalikan teks balasan, atau melempar AiGalat. */
export function klienPalsu(balas: (p: PermintaanAi, panggilanKe: number) => string | Promise<string>): KlienAi & { panggilan: PermintaanAi[] } {
  const panggilan: PermintaanAi[] = [];
  return {
    panggilan,
    async chat(p) {
      panggilan.push(p);
      return balas(p, panggilan.length);
    },
  };
}
export { AiGalat };
```

- [ ] **Step 2: Tes yang gagal**

`apps/api/src/ai/ollama.test.ts`:
```ts
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { AiGalat } from "./klien.js";
import { klienOllama } from "./ollama.js";

let server: http.Server | null = null;
afterEach(() => new Promise<void>((selesai) => (server ? server.close(() => selesai()) : selesai())));

async function mulai(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((ok) => server?.listen(0, "127.0.0.1", ok));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("klienOllama", () => {
  it("mengirim model, skema, suhu 0, dan gambar; mengembalikan isi pesan", async () => {
    let diterima: Record<string, unknown> = {};
    const baseUrl = await mulai((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        diterima = { url: req.url, ...JSON.parse(body) };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: { content: '{"jenis":"hotel"}' } }));
      });
    });
    const skema = { type: "object", properties: { jenis: { type: "string" } } };
    const balasan = await klienOllama.chat({ baseUrl: `${baseUrl}/`, model: "m1", prompt: "baca", gambar: ["QUJD"], skema });
    expect(balasan).toBe('{"jenis":"hotel"}');
    expect(diterima).toMatchObject({
      url: "/api/chat",
      model: "m1",
      stream: false,
      format: skema,
      options: { temperature: 0 },
      messages: [{ role: "user", content: "baca", images: ["QUJD"] }],
    });
  });

  it("tanpa skema dan gambar, kedua kunci itu tidak dikirim", async () => {
    let diterima: Record<string, unknown> = {};
    const baseUrl = await mulai((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        diterima = JSON.parse(body);
        res.end(JSON.stringify({ message: { content: "ok" } }));
      });
    });
    await klienOllama.chat({ baseUrl, model: "m", prompt: "p" });
    expect(diterima).not.toHaveProperty("format");
    expect((diterima.messages as Array<Record<string, unknown>>)[0]).not.toHaveProperty("images");
  });

  it("410 menjadi MODEL_PENSIUN dengan nama model", async () => {
    const baseUrl = await mulai((_req, res) => {
      res.statusCode = 410;
      res.end(JSON.stringify({ error: "kimi-k2.5 was retired" }));
    });
    const galat = await klienOllama.chat({ baseUrl, model: "kimi-k2.5:cloud", prompt: "p" }).catch((e) => e);
    expect(galat).toBeInstanceOf(AiGalat);
    expect(galat).toMatchObject({ kode: "MODEL_PENSIUN" });
    expect(galat.message).toContain("kimi-k2.5:cloud");
  });

  it("status galat lain dan server tidak terjangkau menjadi MODEL_TIDAK_TERSEDIA", async () => {
    const baseUrl = await mulai((_req, res) => {
      res.statusCode = 500;
      res.end("boom");
    });
    expect(await klienOllama.chat({ baseUrl, model: "m", prompt: "p" }).catch((e) => e)).toMatchObject({ kode: "MODEL_TIDAK_TERSEDIA" });
    await new Promise<void>((selesai) => server?.close(() => selesai()));
    server = null;
    expect(await klienOllama.chat({ baseUrl, model: "m", prompt: "p" }).catch((e) => e)).toMatchObject({ kode: "MODEL_TIDAK_TERSEDIA" });
  });

  it("tidak menjawab dalam batas waktu menjadi WAKTU_HABIS", async () => {
    const baseUrl = await mulai(() => {
      /* sengaja tidak menjawab */
    });
    const galat = await klienOllama.chat({ baseUrl, model: "m", prompt: "p", timeoutMs: 150 }).catch((e) => e);
    expect(galat).toMatchObject({ kode: "WAKTU_HABIS" });
  });

  it("balasan tanpa message.content menjadi HASIL_TIDAK_VALID", async () => {
    const baseUrl = await mulai((_req, res) => res.end(JSON.stringify({ lain: 1 })));
    expect(await klienOllama.chat({ baseUrl, model: "m", prompt: "p" }).catch((e) => e)).toMatchObject({ kode: "HASIL_TIDAK_VALID" });
  });
});
```
`apps/api/src/model-ai.test.ts`:
```ts
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AiGalat } from "./ai/klien.js";
import { closePool } from "./db.js";
import { bersihkanData, klienPalsu, loginCookie, siapkanApp } from "./test-support/helpers.js";

let app: FastifyInstance;
let cookie: string;
let balas: (model: string) => string = () => "ok";
const klien = klienPalsu((p) => {
  if (p.model === "pensiun") throw new AiGalat("MODEL_PENSIUN", 'Model "pensiun" sudah dipensiunkan.');
  return balas(p.model);
});
beforeAll(async () => {
  app = await siapkanApp({ klien });
  cookie = await loginCookie(app);
});
afterAll(async () => {
  await app.close();
  await closePool();
});
beforeEach(async () => {
  await bersihkanData();
  klien.panggilan.length = 0;
  balas = () => "ok";
});

const call = (method: "GET" | "PUT" | "POST", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe("model AI", () => {
  it("GET: nilai awal model teks bawaan, URL kosong, dan URL bawaan dari env", async () => {
    const res = await call("GET", "/api/model-ai");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      llmUrl: null,
      modelTeks: "gpt-oss:120b-cloud",
      modelGambar: null,
      bawaanUrl: "http://172.17.0.1:11434",
    });
  });

  it("PUT menyimpan, GET membaca kembali; nilai tidak valid ditolak 400", async () => {
    const baru = { llmUrl: "http://ollama:11434", modelTeks: "gpt-oss:20b-cloud", modelGambar: "kimi-k3:cloud" };
    expect((await call("PUT", "/api/model-ai", baru)).statusCode).toBe(200);
    expect((await call("GET", "/api/model-ai")).json()).toMatchObject(baru);
    expect((await call("PUT", "/api/model-ai", { ...baru, llmUrl: "bukan url" })).statusCode).toBe(400);
    expect((await call("PUT", "/api/model-ai", { ...baru, modelTeks: "" })).statusCode).toBe(400);
  });

  it("uji model teks: memakai model teks dan URL efektif, melaporkan durasi", async () => {
    await call("PUT", "/api/model-ai", { llmUrl: null, modelTeks: "m-teks", modelGambar: null });
    balas = () => "ok";
    const res = await call("POST", "/api/model-ai/uji", { jenis: "teks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, model: "m-teks", balasan: "ok" });
    expect(res.json().durasiMs).toBeGreaterThanOrEqual(0);
    expect(klien.panggilan[0]).toMatchObject({ baseUrl: "http://172.17.0.1:11434", model: "m-teks" });
    expect(klien.panggilan[0]?.gambar).toBeUndefined();
  });

  it("uji model gambar mengirim gambar kecil; model gambar belum diatur dilaporkan jelas", async () => {
    const belum = await call("POST", "/api/model-ai/uji", { jenis: "gambar" });
    expect(belum.json()).toMatchObject({ ok: false, kode: "MODEL_BELUM_DIATUR", model: null });
    expect(klien.panggilan).toHaveLength(0);

    await call("PUT", "/api/model-ai", { llmUrl: "http://x:1", modelTeks: null, modelGambar: "m-gambar" });
    const res = await call("POST", "/api/model-ai/uji", { jenis: "gambar" });
    expect(res.json()).toMatchObject({ ok: true, model: "m-gambar" });
    expect(klien.panggilan[0]?.baseUrl).toBe("http://x:1");
    expect(klien.panggilan[0]?.gambar?.length).toBe(1);
  });

  it("galat model (pensiun) dilaporkan sebagai ok:false dengan kode dan pesan, bukan 500", async () => {
    await call("PUT", "/api/model-ai", { llmUrl: null, modelTeks: "pensiun", modelGambar: null });
    const res = await call("POST", "/api/model-ai/uji", { jenis: "teks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false, kode: "MODEL_PENSIUN", model: "pensiun" });
    expect(res.json().pesan).toContain("dipensiunkan");
  });

  it("jenis uji tidak dikenal ditolak 400", async () => {
    expect((await call("POST", "/api/model-ai/uji", { jenis: "suara" })).statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd ~/spjan/apps/api && npx vitest run src/ai src/model-ai.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 4: Implementasi**

`apps/api/src/ai/ollama.ts`:
```ts
import { AiGalat, type KlienAi, type PermintaanAi } from "./klien.js";

const ringkas = (teks: string) => teks.replace(/\s+/g, " ").slice(0, 200);

export const klienOllama: KlienAi = {
  async chat(p: PermintaanAi): Promise<string> {
    const body = {
      model: p.model,
      stream: false,
      ...(p.skema ? { format: p.skema } : {}),
      options: { temperature: 0 },
      messages: [{ role: "user", content: p.prompt, ...(p.gambar && p.gambar.length > 0 ? { images: p.gambar } : {}) }],
    };
    let status: number;
    let teks: string;
    try {
      const res = await fetch(`${p.baseUrl.replace(/\/+$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(p.timeoutMs ?? 120_000),
      });
      status = res.status;
      teks = await res.text();
    } catch (error) {
      const nama = (error as Error).name;
      if (nama === "TimeoutError" || nama === "AbortError") {
        throw new AiGalat("WAKTU_HABIS", "Model tidak menjawab dalam batas waktu.");
      }
      throw new AiGalat("MODEL_TIDAK_TERSEDIA", `Ollama tidak terjangkau di ${p.baseUrl}.`);
    }
    if (status === 410) {
      throw new AiGalat("MODEL_PENSIUN", `Model "${p.model}" sudah dipensiunkan. Ganti di Pengaturan > Model AI.`);
    }
    if (status < 200 || status >= 300) {
      throw new AiGalat("MODEL_TIDAK_TERSEDIA", `Ollama menjawab ${status}: ${ringkas(teks)}`);
    }
    try {
      const isi = (JSON.parse(teks) as { message?: { content?: unknown } }).message?.content;
      if (typeof isi !== "string") throw new Error("tanpa isi");
      return isi;
    } catch {
      throw new AiGalat("HASIL_TIDAK_VALID", "Balasan Ollama tidak dapat dibaca.");
    }
  },
};
```
`apps/api/src/ai/skema.ts`:
```ts
import { z } from "zod";

/** JSON Schema untuk parameter `format` Ollama (tanpa kunci `$schema`). */
export function skemaJson(skema: z.ZodType): object {
  const hasil = { ...(z.toJSONSchema(skema) as Record<string, unknown>) };
  delete hasil.$schema;
  return hasil;
}
```
`apps/api/src/ai/uji.ts`:
```ts
import type { UjiModelHasil } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "./klien.js";

/** PNG 1x1 sah untuk menguji jalur gambar. */
const PNG_UJI =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

export async function ujiModel(klien: KlienAi, konf: KonfigurasiAi, jenis: "teks" | "gambar"): Promise<UjiModelHasil> {
  const model = jenis === "teks" ? konf.modelTeks : konf.modelGambar;
  if (!model) {
    return {
      ok: false,
      model: null,
      durasiMs: 0,
      kode: "MODEL_BELUM_DIATUR",
      pesan: `Model ${jenis} belum diatur.`,
    };
  }
  const mulai = Date.now();
  try {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt: jenis === "teks" ? "Balas dengan satu kata saja: ok" : "Gambar kecil ini berwarna apa? Jawab satu kata.",
      ...(jenis === "gambar" ? { gambar: [PNG_UJI] } : {}),
      timeoutMs: 60_000,
    });
    return { ok: true, model, durasiMs: Date.now() - mulai, balasan: balasan.trim().slice(0, 200) };
  } catch (error) {
    const galat = error instanceof AiGalat ? error : new AiGalat("GALAT_INTERNAL", "Terjadi kesalahan saat menguji model.");
    return { ok: false, model, durasiMs: Date.now() - mulai, kode: galat.kode, pesan: galat.message };
  }
}
```
`apps/api/src/repositories/model-ai.ts`:
```ts
import type { ModelAiPayload } from "@spjan/shared";

import type { KonfigurasiAi } from "../ai/klien.js";
import { config } from "../config.js";
import type { Db } from "../db.js";

interface Row {
  llm_url: string | null;
  model_teks: string | null;
  model_gambar: string | null;
}

const map = (r: Row): ModelAiPayload => ({ llmUrl: r.llm_url, modelTeks: r.model_teks, modelGambar: r.model_gambar });

export async function getModelAi(db: Db): Promise<ModelAiPayload> {
  const { rows } = await db.query<Row>("select llm_url, model_teks, model_gambar from model_ai where id = 1");
  const row = rows[0];
  if (!row) throw new Error("Baris model_ai tidak ada (migrasi belum dijalankan?)");
  return map(row);
}

export async function saveModelAi(db: Db, p: ModelAiPayload): Promise<ModelAiPayload> {
  const { rows } = await db.query<Row>(
    `update model_ai set llm_url = $1, model_teks = $2, model_gambar = $3, updated_at = now()
      where id = 1 returning llm_url, model_teks, model_gambar`,
    [p.llmUrl, p.modelTeks, p.modelGambar],
  );
  return map(rows[0] as Row);
}

/** Konfigurasi yang benar-benar dipakai: URL dari DB, jika kosong dari env OLLAMA_URL. */
export async function konfigurasiAi(db: Db): Promise<KonfigurasiAi> {
  const p = await getModelAi(db);
  return { llmUrl: p.llmUrl ?? config.OLLAMA_URL, modelTeks: p.modelTeks, modelGambar: p.modelGambar };
}
```
`apps/api/src/routes/model-ai.ts`:
```ts
import type { FastifyInstance } from "fastify";
import { ModelAiPayloadSchema, type ModelAiDto } from "@spjan/shared";
import { z } from "zod";

import type { KlienAi } from "../ai/klien.js";
import { ujiModel } from "../ai/uji.js";
import { config } from "../config.js";
import type { Db } from "../db.js";
import { getModelAi, konfigurasiAi, saveModelAi } from "../repositories/model-ai.js";

const UjiSchema = z.object({ jenis: z.enum(["teks", "gambar"]) });

export async function modelAiRoutes(app: FastifyInstance, opts: { db: Db; klien: KlienAi }): Promise<void> {
  const dto = async (): Promise<ModelAiDto> => ({ ...(await getModelAi(opts.db)), bawaanUrl: config.OLLAMA_URL });

  app.get("/", async () => dto());

  app.put("/", async (req) => {
    await saveModelAi(opts.db, ModelAiPayloadSchema.parse(req.body));
    return dto();
  });

  app.post("/uji", async (req) => {
    const { jenis } = UjiSchema.parse(req.body);
    return ujiModel(opts.klien, await konfigurasiAi(opts.db), jenis);
  });
}
```
`apps/api/src/app.ts`: impor `klienOllama` dan `modelAiRoutes`; di awal fungsi `const klien = opts.klien ?? klienOllama;`; daftarkan `await app.register(modelAiRoutes, { prefix: "/api/model-ai", db, klien });`.

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `cd ~/spjan/apps/api && npm test && npm run lint`
Expected: semua lulus.

- [ ] **Step 6: Commit**
```bash
git add apps/api
git commit -m "feat(api): klien Ollama, pengaturan Model AI, dan uji model"
```

---

### Task 6: Pembaca berkas (PDF dan gambar)

**Files:**
- Create: `apps/api/src/ekstraksi/baca-berkas.ts`
- Test: `apps/api/src/ekstraksi/baca-berkas.test.ts`

**Interfaces:**
- Consumes: `AiGalat`, `pdfSederhana`, `PNG_1X1` (helper tes). Membutuhkan `pdftotext` dan `pdftoppm` (poppler) di PATH; di server dev: `which pdftotext`.
- Produces: `interface IsiBerkas { teks: string; gambar: string[] }` (gambar = base64 tanpa prefiks); `bacaIsi(mime: MimeBerkas, data: Buffer): Promise<IsiBerkas>`. PDF ber-teks (>= 50 karakter): `{ teks (maks 12.000 karakter), gambar: [] }`. PDF tanpa teks: tiga halaman pertama dirender 110 dpi menjadi PNG. PDF rusak: `AiGalat("BERKAS_TIDAK_TERBACA")`.

- [ ] **Step 1: Tes yang gagal**

`apps/api/src/ekstraksi/baca-berkas.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { AiGalat } from "../ai/klien.js";
import { PNG_1X1, pdfSederhana } from "../test-support/helpers.js";
import { bacaIsi } from "./baca-berkas.js";

describe("bacaIsi", () => {
  it("gambar: diteruskan sebagai base64 tanpa teks", async () => {
    const isi = await bacaIsi("image/png", PNG_1X1);
    expect(isi.teks).toBe("");
    expect(isi.gambar).toEqual([PNG_1X1.toString("base64")]);
  });

  it("PDF berteks: teks terbaca, tanpa gambar", async () => {
    const teks = "SURAT TUGAS Nomor ST.226/PPS/PEMPS/PSL.04.02/B/09/2026 Direktur Pengendalian Perhutanan Sosial";
    const isi = await bacaIsi("application/pdf", pdfSederhana(teks));
    expect(isi.gambar).toEqual([]);
    expect(isi.teks).toContain("ST.226/PPS/PEMPS/PSL.04.02/B/09/2026");
  });

  it("PDF tanpa lapisan teks (pindaian): halaman dirender menjadi PNG", async () => {
    const isi = await bacaIsi("application/pdf", pdfSederhana(""));
    expect(isi.gambar).toHaveLength(1);
    const png = Buffer.from(isi.gambar[0] as string, "base64");
    expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  });

  it("teks dipotong maksimal 12.000 karakter", async () => {
    const panjang = `${"kata ".repeat(5000)}`.trim();
    const isi = await bacaIsi("application/pdf", pdfSederhana(panjang));
    expect(isi.teks.length).toBeLessThanOrEqual(12_000);
    expect(isi.teks.length).toBeGreaterThan(1000);
  });

  it("PDF rusak menjadi BERKAS_TIDAK_TERBACA", async () => {
    const galat = await bacaIsi("application/pdf", Buffer.from("%PDF-1.4\nini bukan pdf yang sah sama sekali")).catch((e) => e);
    expect(galat).toBeInstanceOf(AiGalat);
    expect(galat).toMatchObject({ kode: "BERKAS_TIDAK_TERBACA" });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd ~/spjan/apps/api && npx vitest run src/ekstraksi/baca-berkas.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi**

`apps/api/src/ekstraksi/baca-berkas.ts`:
```ts
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { MimeBerkas } from "@spjan/shared";

import { AiGalat } from "../ai/klien.js";

const jalankan = promisify(execFile);

export interface IsiBerkas {
  teks: string;
  /** Gambar base64 (tanpa prefiks data:). */
  gambar: string[];
}

const BATAS_TEKS = 12_000;
const MIN_TEKS_PDF = 50;
const MAKS_HALAMAN_GAMBAR = 3;

export async function bacaIsi(mime: MimeBerkas, data: Buffer): Promise<IsiBerkas> {
  if (mime !== "application/pdf") return { teks: "", gambar: [data.toString("base64")] };

  const dir = await mkdtemp(path.join(os.tmpdir(), "spjan-pdf-"));
  try {
    const pdf = path.join(dir, "masuk.pdf");
    await writeFile(pdf, data);
    let teks: string;
    try {
      const { stdout } = await jalankan("pdftotext", ["-layout", "-enc", "UTF-8", pdf, "-"], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30_000,
      });
      teks = stdout.trim();
    } catch {
      throw new AiGalat("BERKAS_TIDAK_TERBACA", "PDF tidak dapat dibaca (rusak atau terkunci).");
    }
    if (teks.length >= MIN_TEKS_PDF) return { teks: teks.slice(0, BATAS_TEKS), gambar: [] };

    try {
      await jalankan("pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", String(MAKS_HALAMAN_GAMBAR), pdf, path.join(dir, "hal")], {
        timeout: 60_000,
      });
    } catch {
      throw new AiGalat("BERKAS_TIDAK_TERBACA", "Halaman PDF tidak dapat dirender menjadi gambar.");
    }
    const png = (await readdir(dir)).filter((n) => n.startsWith("hal") && n.endsWith(".png")).sort();
    const gambar = await Promise.all(png.map(async (n) => (await readFile(path.join(dir, n))).toString("base64")));
    return { teks, gambar };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd ~/spjan/apps/api && npx vitest run src/ekstraksi/baca-berkas.test.ts && npm run lint`
Expected: lulus. (Bila `pdftotext` tidak ada: `sudo apt install poppler-utils` di mesin dev; di image Docker dipasang pada Task 8.)

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/ekstraksi
git commit -m "feat(api): pembaca berkas PDF (teks atau render halaman) dan gambar"
```

---

### Task 7: Klasifikasi dan worker antrean

**Files:**
- Create: `apps/api/src/ekstraksi/klasifikasi.ts`, `apps/api/src/ekstraksi/worker.ts`
- Test: `apps/api/src/ekstraksi/klasifikasi.test.ts`, `apps/api/src/ekstraksi/worker.test.ts`

**Interfaces:**
- Consumes: `KlienAi`, `AiGalat`, `KonfigurasiAi`, `IsiBerkas`, `bacaIsi`, `konfigurasiAi`, `BerkasStore`, `skemaJson`, `HasilKlasifikasiSchema`, `tambahBerkas`.
- Produces:
  - `klasifikasiBerkas(klien, konf, isi): Promise<{ model: string; hasil: HasilKlasifikasi }>`: model gambar bila `isi.gambar` tidak kosong, selain itu model teks; model belum diatur melempar `MODEL_BELUM_DIATUR`; hasil tidak valid dicoba ulang sekali dengan pesan galat, lalu `HASIL_TIDAK_VALID`.
  - `type Ekstraktor = (ctx: { berkas: { id: number; mime: MimeBerkas; sha256: string }; isi: IsiBerkas; konf: KonfigurasiAi; klien: KlienAi }) => Promise<{ model: string; hasil: unknown; jenis?: JenisBerkas }>`; `ekstraktorKlasifikasi: Ekstraktor`.
  - `bikinWorker({ db, store, klien, ekstrak?, paralel? = 2, jedaMs? = 2000 })` mengembalikan `{ jalankanSekali(): Promise<number>; pulihkan(): Promise<void>; mulai(): void; henti(): Promise<void> }`. `jalankanSekali` mengklaim sampai `paralel` pekerjaan dan memprosesnya; mengembalikan jumlah yang diproses. Galat `WAKTU_HABIS`/`MODEL_TIDAK_TERSEDIA` dijadwalkan ulang satu kali (`percobaan < 2`); selain itu `gagal`.

- [ ] **Step 1: Tes klasifikasi yang gagal**

`apps/api/src/ekstraksi/klasifikasi.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import type { KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { klasifikasiBerkas } from "./klasifikasi.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };
const valid = '{"jenis":"hotel","ringkasan":"Invoice The Royal Alana"}';

describe("klasifikasiBerkas", () => {
  it("dokumen berteks memakai model teks dan menyertakan isi teks pada prompt", async () => {
    const klien = klienPalsu(() => valid);
    const { model, hasil } = await klasifikasiBerkas(klien, konf, { teks: "INVOICE Royal Alana room charges", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil).toEqual({ jenis: "hotel", ringkasan: "Invoice The Royal Alana" });
    expect(klien.panggilan[0]?.prompt).toContain("INVOICE Royal Alana room charges");
    expect(klien.panggilan[0]?.gambar).toBeUndefined();
    expect(klien.panggilan[0]?.skema).toMatchObject({ type: "object", required: ["jenis", "ringkasan"] });
    expect(klien.panggilan[0]?.skema).not.toHaveProperty("$schema");
  });

  it("dokumen bergambar memakai model gambar dan mengirim gambarnya", async () => {
    const klien = klienPalsu(() => valid);
    const { model } = await klasifikasiBerkas(klien, konf, { teks: "", gambar: ["QUJD"] });
    expect(model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual(["QUJD"]);
  });

  it("model yang dibutuhkan belum diatur melempar MODEL_BELUM_DIATUR tanpa memanggil model", async () => {
    const klien = klienPalsu(() => valid);
    await expect(klasifikasiBerkas(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["QUJD"] })).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
    await expect(klasifikasiBerkas(klien, { ...konf, modelTeks: null }, { teks: "abc", gambar: [] })).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
    expect(klien.panggilan).toHaveLength(0);
  });

  it("balasan tidak valid dicoba ulang sekali dengan pesan galat, lalu berhasil", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? "bukan json" : valid));
    const { hasil } = await klasifikasiBerkas(klien, konf, { teks: "abc", gambar: [] });
    expect(hasil.jenis).toBe("hotel");
    expect(klien.panggilan).toHaveLength(2);
    expect(klien.panggilan[1]?.prompt).toContain("tidak valid");
  });

  it("dua kali tidak valid (termasuk jenis di luar daftar) melempar HASIL_TIDAK_VALID", async () => {
    const klien = klienPalsu(() => '{"jenis":"pesawat","ringkasan":""}');
    await expect(klasifikasiBerkas(klien, konf, { teks: "abc", gambar: [] })).rejects.toMatchObject({ kode: "HASIL_TIDAK_VALID" });
    expect(klien.panggilan).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Tes worker yang gagal**

`apps/api/src/ekstraksi/worker.test.ts`:
```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AiGalat } from "../ai/klien.js";
import { FileBerkasStore } from "../berkas/store.js";
import { closePool, pool } from "../db.js";
import { saveModelAi } from "../repositories/model-ai.js";
import { tambahBerkas } from "../repositories/berkas.js";
import { bersihkanData, klienPalsu, pdfSederhana, pngUnik } from "../test-support/helpers.js";
import { bikinWorker } from "./worker.js";

let dir: string;
let store: FileBerkasStore;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "spjan-worker-"));
  store = new FileBerkasStore(dir);
});
afterAll(async () => {
  await closePool();
  await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await bersihkanData();
  await saveModelAi(pool, { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" });
});

const hotel = '{"jenis":"hotel","ringkasan":"Invoice hotel"}';
const tambah = (data: Buffer, nama = "x") => tambahBerkas(pool, store, { stId: null, namaAsli: nama, data }).then((r) => r.dto);
const ekstraksiTerakhir = async (berkasId: number) =>
  (await pool.query("select * from ekstraksi where berkas_id = $1 order by id desc limit 1", [berkasId])).rows[0];

describe("worker ekstraksi", () => {
  it("gambar: memakai model gambar, menyimpan hasil, dan mengisi jenis berkas", async () => {
    const klien = klienPalsu(() => hotel);
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pngUnik(1));
    expect(await worker.jalankanSekali()).toBe(1);
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e).toMatchObject({ status: "selesai", model: "m-gambar", kode_galat: null, percobaan: 1 });
    expect(e.hasil).toEqual({ jenis: "hotel", ringkasan: "Invoice hotel" });
    expect(e.selesai_at).not.toBeNull();
    expect((await pool.query("select jenis from berkas where id = $1", [berkas.id])).rows[0].jenis).toBe("hotel");
    expect(await worker.jalankanSekali()).toBe(0);
  });

  it("PDF berteks: memakai model teks dan teks dokumen masuk ke prompt", async () => {
    const klien = klienPalsu(() => '{"jenis":"st","ringkasan":"Surat tugas"}');
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pdfSederhana("SURAT TUGAS Nomor ST.226 Direktur Pengendalian Perhutanan Sosial memberi tugas"));
    await worker.jalankanSekali();
    expect((await ekstraksiTerakhir(berkas.id)).model).toBe("m-teks");
    expect(klien.panggilan[0]?.prompt).toContain("ST.226");
  });

  it("model gambar belum diatur: gagal MODEL_BELUM_DIATUR tanpa ulang", async () => {
    await saveModelAi(pool, { llmUrl: null, modelTeks: "m-teks", modelGambar: null });
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel) });
    const berkas = await tambah(pngUnik(2));
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "gagal", kode_galat: "MODEL_BELUM_DIATUR", percobaan: 1 });
  });

  it("MODEL_TIDAK_TERSEDIA dijadwalkan ulang sekali, lalu gagal", async () => {
    const klien = klienPalsu(() => {
      throw new AiGalat("MODEL_TIDAK_TERSEDIA", "Ollama tidak terjangkau.");
    });
    const worker = bikinWorker({ db: pool, store, klien, paralel: 1 });
    const berkas = await tambah(pngUnik(3));
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "antre", percobaan: 1 });
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "gagal", kode_galat: "MODEL_TIDAK_TERSEDIA", percobaan: 2 });
  });

  it("galat tak terduga menjadi GALAT_INTERNAL dengan pesan umum (tanpa membocorkan detail)", async () => {
    const klien = klienPalsu(() => {
      throw new Error("rahasia internal jangan bocor");
    });
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pngUnik(4));
    await worker.jalankanSekali();
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e).toMatchObject({ status: "gagal", kode_galat: "GALAT_INTERNAL" });
    expect(e.galat).not.toContain("rahasia");
  });

  it("isi berkas hilang dari penyimpanan menjadi BERKAS_TIDAK_TERBACA", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel) });
    const berkas = await tambah(pngUnik(5));
    await store.delete(berkas.sha256);
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "gagal", kode_galat: "BERKAS_TIDAK_TERBACA" });
  });

  it("memproses sampai `paralel` pekerjaan per putaran", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel), paralel: 2 });
    for (const n of [6, 7, 8]) await tambah(pngUnik(n));
    expect(await worker.jalankanSekali()).toBe(2);
    expect(await worker.jalankanSekali()).toBe(1);
    expect(await worker.jalankanSekali()).toBe(0);
  });

  it("pulihkan mengembalikan pekerjaan 'berjalan' yang macet ke antrean", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel) });
    const berkas = await tambah(pngUnik(9));
    await pool.query("update ekstraksi set status = 'berjalan' where berkas_id = $1", [berkas.id]);
    expect(await worker.jalankanSekali()).toBe(0);
    await worker.pulihkan();
    expect((await ekstraksiTerakhir(berkas.id)).status).toBe("antre");
    expect(await worker.jalankanSekali()).toBe(1);
  });

  it("dua worker tidak memproses pekerjaan yang sama (SKIP LOCKED)", async () => {
    const klien = klienPalsu(() => hotel);
    const a = bikinWorker({ db: pool, store, klien, paralel: 1 });
    const b = bikinWorker({ db: pool, store, klien, paralel: 1 });
    await tambah(pngUnik(10));
    const [x, y] = await Promise.all([a.jalankanSekali(), b.jalankanSekali()]);
    expect(x + y).toBe(1);
    expect(klien.panggilan).toHaveLength(1);
  });

  it("mulai/henti menjalankan putaran latar dan berhenti bersih", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel), jedaMs: 20 });
    const berkas = await tambah(pngUnik(11));
    worker.mulai();
    for (let i = 0; i < 100 && (await ekstraksiTerakhir(berkas.id)).status !== "selesai"; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    await worker.henti();
    expect((await ekstraksiTerakhir(berkas.id)).status).toBe("selesai");
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd ~/spjan/apps/api && npx vitest run src/ekstraksi`
Expected: FAIL (modul `klasifikasi.js`, `worker.js` belum ada).

- [ ] **Step 4: Implementasi klasifikasi**

`apps/api/src/ekstraksi/klasifikasi.ts`:
```ts
import { HasilKlasifikasiSchema, type HasilKlasifikasi } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_KLASIFIKASI = skemaJson(HasilKlasifikasiSchema);

const PROMPT = `Anda membaca satu dokumen pendukung perjalanan dinas pemerintah Indonesia (bahasa Indonesia atau Inggris).
Tentukan jenis dokumen:
- st: surat tugas
- hotel: invoice atau folio hotel (penginapan)
- tiket: tiket atau boarding pass pesawat, kereta, atau bus
- transport: bukti taksi, ojek online, bensin, tol, parkir, sewa kendaraan, atau transport darat lainnya
- lainnya: selain di atas
Balas HANYA JSON {"jenis": ..., "ringkasan": ...}. "ringkasan" satu kalimat singkat tentang isi dokumen (maksimal 200 karakter).`;

export async function klasifikasiBerkas(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilKlasifikasi }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;
  if (!model) {
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${pakaiGambar ? "gambar" : "teks"} belum diatur di Pengaturan > Model AI.`);
  }
  const dasar = isi.teks ? `${PROMPT}\n\nIsi dokumen:\n${isi.teks}` : PROMPT;
  let prompt = dasar;
  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      skema: SKEMA_KLASIFIKASI,
      ...(pakaiGambar ? { gambar: isi.gambar } : {}),
    });
    try {
      return { model, hasil: HasilKlasifikasiSchema.parse(JSON.parse(balasan)) };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${dasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan hasil yang valid.");
}
```

- [ ] **Step 5: Implementasi worker**

`apps/api/src/ekstraksi/worker.ts`:
```ts
import type { JenisBerkas, MimeBerkas } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { konfigurasiAi } from "../repositories/model-ai.js";
import { bacaIsi, type IsiBerkas } from "./baca-berkas.js";
import { klasifikasiBerkas } from "./klasifikasi.js";

export type Ekstraktor = (ctx: {
  berkas: { id: number; mime: MimeBerkas; sha256: string };
  isi: IsiBerkas;
  konf: KonfigurasiAi;
  klien: KlienAi;
}) => Promise<{ model: string; hasil: unknown; jenis?: JenisBerkas }>;

/** 2A: hanya klasifikasi jenis. 2B-2D menggantinya dengan pemilih ekstraktor per jenis. */
export const ekstraktorKlasifikasi: Ekstraktor = async ({ klien, konf, isi }) => {
  const { model, hasil } = await klasifikasiBerkas(klien, konf, isi);
  return { model, hasil, jenis: hasil.jenis };
};

export interface WorkerOpsi {
  db: Db;
  store: BerkasStore;
  klien: KlienAi;
  ekstrak?: Ekstraktor;
  paralel?: number;
  jedaMs?: number;
}

interface Klaim {
  id: number;
  berkasId: number;
  percobaan: number;
}

const DAPAT_DIULANG = new Set(["WAKTU_HABIS", "MODEL_TIDAK_TERSEDIA"]);
const MAKS_PERCOBAAN = 2;

export function bikinWorker(opsi: WorkerOpsi) {
  const { db, store, klien } = opsi;
  const ekstrak = opsi.ekstrak ?? ekstraktorKlasifikasi;
  const paralel = opsi.paralel ?? 2;
  const jedaMs = opsi.jedaMs ?? 2000;

  async function klaim(): Promise<Klaim | null> {
    const { rows } = await db.query<Klaim>(
      `update ekstraksi set status = 'berjalan', mulai_at = now(), percobaan = percobaan + 1
        where id = (select id from ekstraksi where status = 'antre' order by id for update skip locked limit 1)
        returning id, berkas_id as "berkasId", percobaan`,
    );
    return rows[0] ?? null;
  }

  async function proses(k: Klaim): Promise<void> {
    const mulai = Date.now();
    let model: string | null = null;
    try {
      const { rows } = await db.query<{ id: number; mime: MimeBerkas; sha256: string }>(
        "select id, mime, sha256 from berkas where id = $1",
        [k.berkasId],
      );
      const berkas = rows[0];
      if (!berkas) throw new AiGalat("BERKAS_TIDAK_TERBACA", "Berkas sudah dihapus.");
      const data = await store.get(berkas.sha256).catch(() => {
        throw new AiGalat("BERKAS_TIDAK_TERBACA", "Isi berkas tidak ada di penyimpanan.");
      });
      const isi = await bacaIsi(berkas.mime, data);
      const konf = await konfigurasiAi(db);
      const hasil = await ekstrak({ berkas, isi, konf, klien });
      model = hasil.model;
      await db.query(
        `update ekstraksi set status = 'selesai', model = $2, hasil = $3, kode_galat = null, galat = null, selesai_at = now()
          where id = $1`,
        [k.id, hasil.model, JSON.stringify(hasil.hasil)],
      );
      if (hasil.jenis) await db.query("update berkas set jenis = $2 where id = $1", [berkas.id, hasil.jenis]);
      console.log(`[ekstraksi] berkas=${k.berkasId} model=${model} status=selesai durasi=${Date.now() - mulai}ms`);
    } catch (error) {
      const galat = error instanceof AiGalat ? error : new AiGalat("GALAT_INTERNAL", "Terjadi kesalahan saat membaca dokumen.");
      if (!(error instanceof AiGalat)) console.error("[ekstraksi] galat tak terduga", error);
      const ulang = DAPAT_DIULANG.has(galat.kode) && k.percobaan < MAKS_PERCOBAAN;
      await db.query(
        `update ekstraksi set status = $2::text, kode_galat = $3, galat = $4,
                selesai_at = case when $2::text = 'gagal' then now() else null end
          where id = $1`,
        [k.id, ulang ? "antre" : "gagal", galat.kode, galat.message],
      );
      console.warn(`[ekstraksi] berkas=${k.berkasId} status=${ulang ? "antre" : "gagal"} kode=${galat.kode} durasi=${Date.now() - mulai}ms`);
    }
  }

  async function jalankanSekali(): Promise<number> {
    const diklaim: Klaim[] = [];
    for (let i = 0; i < paralel; i += 1) {
      const k = await klaim();
      if (!k) break;
      diklaim.push(k);
    }
    await Promise.all(diklaim.map(proses));
    return diklaim.length;
  }

  /** Pekerjaan 'berjalan' sisa proses sebelumnya (mis. API di-restart) dikembalikan ke antrean. */
  async function pulihkan(): Promise<void> {
    await db.query("update ekstraksi set status = 'antre' where status = 'berjalan'");
  }

  let berhenti = false;
  let lari: Promise<void> | null = null;

  function mulai(): void {
    if (lari) return;
    berhenti = false;
    lari = (async () => {
      await pulihkan();
      while (!berhenti) {
        let n = 0;
        try {
          n = await jalankanSekali();
        } catch (error) {
          console.error("[ekstraksi] putaran worker gagal", (error as Error).message);
        }
        if (n === 0 && !berhenti) await new Promise((r) => setTimeout(r, jedaMs));
      }
    })();
  }

  async function henti(): Promise<void> {
    berhenti = true;
    await lari;
    lari = null;
  }

  return { jalankanSekali, pulihkan, mulai, henti };
}
```
Catatan: log hanya memuat id berkas, model, status, kode, durasi (sesuai Global Constraints).

- [ ] **Step 6: Jalankan, pastikan lulus**

Run: `cd ~/spjan/apps/api && npm test && npm run lint`
Expected: semua lulus (klasifikasi 5, worker 10, ditambah seluruh tes sebelumnya).

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/ekstraksi
git commit -m "feat(api): klasifikasi jenis berkas dan worker antrean ekstraksi"
```

---

### Task 8: Pengkabelan server, Docker, compose, dan dokumen deploy

**Files:**
- Modify: `apps/api/src/server.ts`, `Dockerfile.combined`, `docker-compose.dokploy.yml`, `docs/deploy.md`, `.env.example` (bila ada; periksa `ls -a`)

**Interfaces:**
- Consumes: `bikinWorker`, `FileBerkasStore`, `klienOllama`, `buildApp`.
- Produces: proses API menjalankan worker saat boot dan menghentikannya saat SIGINT/SIGTERM; image API memiliki `pdftotext`/`pdftoppm` dan `/data/berkas` yang dapat ditulis user `node`; volume `spjan-berkas`.

- [ ] **Step 1: Ubah `server.ts`**

Tambah impor:
```ts
import { klienOllama } from "./ai/ollama.js";
import { FileBerkasStore } from "./berkas/store.js";
import { bikinWorker } from "./ekstraksi/worker.js";
```
Ganti bagian pembuatan app dan penutupan:
```ts
  const store = new FileBerkasStore(config.BERKAS_DIR);
  const app = await buildApp(pool, { store, klien: klienOllama });
  const worker = bikinWorker({ db: pool, store, klien: klienOllama });
  worker.mulai();
  await app.listen({ host: config.HOST, port: config.PORT });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await worker.henti();
      await app.close();
      await closePool();
      process.exit(0);
    });
  }
```

- [ ] **Step 2: Image API**

Di `Dockerfile.combined`, pada target `api` ganti `USER node` dengan:
```dockerfile
# poppler-utils: pdftotext/pdftoppm untuk membaca PDF pada ekstraksi dokumen.
RUN apk add --no-cache poppler-utils && mkdir -p /data/berkas && chown node:node /data/berkas
ENV BERKAS_DIR=/data/berkas
USER node
```

- [ ] **Step 3: Compose**

Di `docker-compose.dokploy.yml`, pada `spjan-api`: tambahkan ke `environment`:
```yaml
      - OLLAMA_URL=${OLLAMA_URL:-http://172.17.0.1:11434}
```
tambahkan sebelum `networks:` layanan itu:
```yaml
    volumes:
      - spjan-berkas:/data/berkas
```
dan di blok `networks:` tingkat atas tambahkan di atasnya:
```yaml
volumes:
  spjan-berkas:

```

- [ ] **Step 4: Dokumen deploy**

Tambahkan bagian di akhir `docs/deploy.md`:
```markdown
## Berkas unggahan dan Model AI (Tahap 2)
- Berkas asli (invoice, tiket, ST) disimpan di Docker volume `spjan-berkas` (di dalam kontainer: `/data/berkas`). Volume ini
  BUKAN bagian dari database; cadangkan terpisah, mis.:
  `docker run --rm -v <proyek>_spjan-berkas:/d -v "$PWD":/b alpine tar czf /b/spjan-berkas.tgz -C /d .`
  (nama volume sebenarnya: `docker volume ls | grep spjan-berkas`).
- Model dibaca lewat Ollama di host (`OLLAMA_URL`, bawaan `http://172.17.0.1:11434`). Nama model diatur di aplikasi:
  Pengaturan > Model AI (tombol "Uji model"). Model cloud dapat dipensiunkan tanpa pemberitahuan (HTTP 410), ganti di sana.
- Isi dokumen yang dibaca model dikirim ke ollama.com (model cloud). Log API hanya mencatat id berkas, model, status, durasi.
- Image API memasang `poppler-utils`; tanpa itu PDF tidak terbaca.
```
Bila ada `.env.example`, tambahkan `BERKAS_DIR=./data/berkas` dan `OLLAMA_URL=http://127.0.0.1:11434` (dev) di sana; bila tidak ada, lewati.

- [ ] **Step 5: Verifikasi build dan image**

Run:
```bash
cd ~/spjan && npm run build && npm run lint
docker build -f Dockerfile.combined --target api -t spjan-api:test .
docker run --rm spjan-api:test sh -c 'pdftotext -v 2>&1 | head -1; touch /data/berkas/x && echo tulis-ok && id -un'
```
Expected: build dan lint lulus; baris versi poppler; `tulis-ok` dan `node`. Image `spjan-api:test` dipakai lagi di Step 6 dan dihapus di sana.

- [ ] **Step 6: Uji integrasi kontainer terhadap DB tes**

Run (database tes ada di `spjan-dev-postgres`; hubungkan lewat jaringan docker bersama):
```bash
docker network create spjan-t2a-net >/dev/null 2>&1 || true
docker network connect spjan-t2a-net spjan-dev-postgres 2>/dev/null || true
docker run --rm -d --name spjan-t2a --network spjan-t2a-net -p 127.0.0.1:18000:8000 \
  -e NODE_ENV=production -e PORT=8000 -e FRONTEND_ORIGIN=http://localhost:18000 \
  -e DATABASE_URL=postgres://postgres:postgres@spjan-dev-postgres:5432/spjan_test \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=sandi-uji-12345 spjan-api:test
sleep 15; curl -s localhost:18000/api/health
curl -s -c /tmp/t2a.cj -H 'content-type: application/json' -d '{"username":"admin","password":"sandi-uji-12345"}' localhost:18000/api/auth/login >/dev/null
curl -s -b /tmp/t2a.cj localhost:18000/api/model-ai
docker logs spjan-t2a 2>&1 | tail -5
docker rm -f spjan-t2a; docker network disconnect spjan-t2a-net spjan-dev-postgres; docker network rm spjan-t2a-net
docker image rm spjan-api:test
```
Expected: `{"status":"ok"}`, JSON model-ai berisi `modelTeks` `gpt-oss:120b-cloud`, log tanpa galat.

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/server.ts Dockerfile.combined docker-compose.dokploy.yml docs/deploy.md
git add .env.example 2>/dev/null || true
git commit -m "feat(deploy): jalankan worker ekstraksi, poppler, volume berkas, dan OLLAMA_URL"
```

---

### Task 9: Kartu Model AI di halaman Pengaturan

**Files:**
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/lib/queries.ts`, `apps/web/src/pages/pengaturan.tsx`
- Create: `apps/web/src/components/model-ai-card.tsx`

**Interfaces:**
- Consumes: `ModelAiDto`, `ModelAiPayload`, `ModelAiPayloadSchema`, `UjiModelHasil` dari `@spjan/shared`; komponen `Card*`, `Field`, `Input`, `Button`, `Alert`; `pesanGalat`.
- Produces: `api.modelAi.{get, save, uji}`; hook `useModelAi()`, `useSimpanModelAi()`, `useUjiModelAi()`; komponen `<ModelAiCard />`.

- [ ] **Step 1: Klien API**

Di `apps/web/src/lib/api.ts`: tambahkan `ModelAiDto, ModelAiPayload, UjiModelHasil` ke daftar impor tipe dari `@spjan/shared`, dan di objek `api` setelah `pengaturan`:
```ts
  modelAi: {
    get: () => request<ModelAiDto>('GET', '/api/model-ai'),
    save: (p: ModelAiPayload) => request<ModelAiDto>('PUT', '/api/model-ai', p),
    uji: (jenis: 'teks' | 'gambar') => request<UjiModelHasil>('POST', '/api/model-ai/uji', { jenis }),
  },
```

- [ ] **Step 2: Hook**

Di `apps/web/src/lib/queries.ts`: tambahkan `ModelAiPayload` ke impor tipe, `modelAi: ['model-ai'] as const,` ke `keys`, dan di akhir berkas:
```ts
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
```

- [ ] **Step 3: Komponen**

`apps/web/src/components/model-ai-card.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ModelAiPayloadSchema, type ModelAiDto, type UjiModelHasil } from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { pesanGalat } from '@/lib/format'
import { useModelAi, useSimpanModelAi, useUjiModelAi } from '@/lib/queries'

const kosongJadiNull = (v: string) => (v.trim() === '' ? null : v.trim())

function HasilUji({ hasil }: { hasil: UjiModelHasil }) {
  return hasil.ok ? (
    <Alert>
      Model <strong>{hasil.model}</strong> menjawab dalam {Math.round(hasil.durasiMs / 100) / 10} detik: &ldquo;{hasil.balasan}&rdquo;
    </Alert>
  ) : (
    <Alert variant="destructive">
      {hasil.model ? <strong>{hasil.model}: </strong> : null}
      {hasil.pesan ?? 'Uji gagal.'}
    </Alert>
  )
}

function FormModelAi({ awal }: { awal: ModelAiDto }) {
  const simpan = useSimpanModelAi()
  const uji = useUjiModelAi()
  const [url, setUrl] = useState(awal.llmUrl ?? '')
  const [teks, setTeks] = useState(awal.modelTeks ?? '')
  const [gambar, setGambar] = useState(awal.modelGambar ?? '')
  const [galat, setGalat] = useState<string | null>(null)
  const [hasilUji, setHasilUji] = useState<{ jenis: 'teks' | 'gambar'; hasil: UjiModelHasil } | null>(null)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat(null)
    const parsed = ModelAiPayloadSchema.safeParse({ llmUrl: kosongJadiNull(url), modelTeks: kosongJadiNull(teks), modelGambar: kosongJadiNull(gambar) })
    if (!parsed.success) {
      setGalat(parsed.error.issues[0]?.message ?? 'Isian tidak valid.')
      return
    }
    try {
      await simpan.mutateAsync(parsed.data)
      toast.success('Model AI disimpan.')
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  async function ujiModel(jenis: 'teks' | 'gambar') {
    setHasilUji(null)
    try {
      setHasilUji({ jenis, hasil: await uji.mutateAsync(jenis) })
    } catch (error) {
      setGalat(pesanGalat(error))
    }
  }

  return (
    <form onSubmit={kirim} className="grid gap-4">
      {galat ? <Alert variant="destructive">{galat}</Alert> : null}
      <Field label="Alamat Ollama" htmlFor="llmUrl" hint={`Kosong = bawaan server (${awal.bawaanUrl}).`}>
        <Input id="llmUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={awal.bawaanUrl} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Model teks" htmlFor="modelTeks" hint="Untuk dokumen PDF berteks (mis. surat tugas).">
          <Input id="modelTeks" value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="gpt-oss:120b-cloud" />
        </Field>
        <Field label="Model gambar" htmlFor="modelGambar" hint="Harus mendukung gambar (vision), untuk foto invoice, tiket, dan struk.">
          <Input id="modelGambar" value={gambar} onChange={(e) => setGambar(e.target.value)} placeholder="mis. kimi-k3:cloud" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={simpan.isPending}>
          {simpan.isPending ? 'Menyimpan...' : 'Simpan model'}
        </Button>
        <Button type="button" variant="outline" disabled={uji.isPending} onClick={() => ujiModel('teks')}>
          Uji model teks
        </Button>
        <Button type="button" variant="outline" disabled={uji.isPending} onClick={() => ujiModel('gambar')}>
          Uji model gambar
        </Button>
      </div>
      {uji.isPending ? <p className="text-sm text-muted-foreground">Menguji model... (bisa sampai 1 menit)</p> : null}
      {hasilUji ? <HasilUji hasil={hasilUji.hasil} /> : null}
      <p className="text-xs text-muted-foreground">Uji memakai nilai yang sudah disimpan. Simpan dulu bila baru mengganti nama model.</p>
    </form>
  )
}

export function ModelAiCard() {
  const data = useModelAi()
  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Model AI untuk membaca dokumen</CardTitle>
        <CardDescription>
          Dokumen yang dibaca (surat tugas, invoice, tiket, struk) dikirim ke ollama.com bila memakai model cloud. Hasil bacaan selalu
          berupa usulan yang Anda setujui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.isError ? <Alert variant="destructive">{pesanGalat(data.error)}</Alert> : null}
        {data.isPending ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {data.data ? <FormModelAi awal={data.data} /> : null}
      </CardContent>
    </Card>
  )
}
```
Periksa varian `Button` yang tersedia (`grep -n variant apps/web/src/components/ui/button.tsx`); bila `outline` tidak ada, pakai varian sekunder yang ada.

- [ ] **Step 4: Pasang di halaman**

Di `apps/web/src/pages/pengaturan.tsx`: impor `import { ModelAiCard } from '@/components/model-ai-card'` dan ubah `PengaturanPage`:
```tsx
      {data.data ? <FormPengaturan awal={data.data} /> : null}
      <div className="mt-5">
        <ModelAiCard />
      </div>
```

- [ ] **Step 5: Verifikasi**

Run: `cd ~/spjan && npm run lint -w web && npm run build -w web`
Expected: lulus tanpa galat tipe.

Verifikasi visual (sekali): jalankan `npm run dev:api` dan `npm run dev:web` (butuh `.env` API menunjuk `spjan_dev`), buka `/pengaturan`, pastikan kartu tampil, simpan nama model, dan "Uji model teks" menampilkan hasil atau pesan galat yang jelas.

- [ ] **Step 6: Commit**
```bash
git add apps/web
git commit -m "feat(web): kartu Model AI pada halaman Pengaturan dengan uji model"
```

---

### Task 10: Skrip uji manual dan keputusan model gambar

**Files:**
- Create: `apps/api/scripts/probe-llm.ts`

**Interfaces:**
- Consumes: `bacaIsi`, `klasifikasiBerkas`, `klienOllama`, `deteksiMime`.
- Produces: skrip CLI `npx tsx scripts/probe-llm.ts <berkas> --model <nama> [--url <ollama>]` yang mencetak jenis hasil, ringkasan, dan durasi. Tidak dijalankan di CI dan tidak memuat data asli di repo.

- [ ] **Step 1: Tulis skrip**

`apps/api/scripts/probe-llm.ts`:
```ts
// Uji manual: baca satu berkas asli dengan model tertentu dan cetak hasil klasifikasinya.
// Pemakaian: npx tsx scripts/probe-llm.ts "/path/invoice.jpeg" --model kimi-k3:cloud [--url http://127.0.0.1:11434]
import { readFile } from "node:fs/promises";

import { klienOllama } from "../src/ai/ollama.js";
import { deteksiMime } from "../src/berkas/deteksi.js";
import { bacaIsi } from "../src/ekstraksi/baca-berkas.js";
import { klasifikasiBerkas } from "../src/ekstraksi/klasifikasi.js";

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const berkas = process.argv[2];
const model = argumen("model");
const url = argumen("url") ?? "http://127.0.0.1:11434";
if (!berkas || !model) {
  console.error('Pemakaian: tsx scripts/probe-llm.ts <berkas> --model <nama> [--url <ollama>]');
  process.exit(2);
}

const data = await readFile(berkas);
const mime = deteksiMime(data);
if (!mime) {
  console.error("Jenis berkas tidak didukung (bukan PDF/JPG/PNG/WEBP).");
  process.exit(2);
}
const isi = await bacaIsi(mime, data);
console.log(`[probe] ${berkas} mime=${mime} teks=${isi.teks.length} karakter gambar=${isi.gambar.length}`);
const mulai = Date.now();
try {
  const { hasil } = await klasifikasiBerkas(klienOllama, { llmUrl: url, modelTeks: model, modelGambar: model }, isi);
  console.log(`[probe] model=${model} durasi=${((Date.now() - mulai) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(hasil, null, 2));
} catch (error) {
  console.error(`[probe] GAGAL model=${model} setelah ${((Date.now() - mulai) / 1000).toFixed(1)}s:`, (error as Error).message);
  process.exit(1);
}
```

- [x] **Step 2: Uji dengan model teks yang sudah terpasang (tanpa mengubah Ollama)**

Run: `cd ~/spjan/apps/api && npx tsx scripts/probe-llm.ts "/home/ryandshinevps/spj/2026/diy/ST.226.pdf" --model gpt-oss:120b-cloud`
Expected: `mime=application/pdf teks=<ratusan> karakter gambar=0`, hasil `{"jenis":"st", ...}`.

- [x] **Step 3: GERBANG: minta persetujuan pengguna sebelum mengubah Ollama bersama**

Menguji model gambar membutuhkan menambah satu stub model cloud (sekitar 300 byte) ke Ollama server ini (`ollama pull kimi-k3:cloud`), yang dipakai layanan lain. **Tanyakan dulu kepada pengguna** (AskUserQuestion): boleh menambah stub untuk kandidat `kimi-k3`, `gemma4:31b`, `glm-5.3-flash`, dan menghapusnya (`ollama rm`) bila tidak dipakai. Jangan lanjut tanpa persetujuan. Foto invoice contoh akan dikirim ke ollama.com (sudah disetujui pengguna untuk semua dokumen).

- [x] **Step 4: Uji kandidat model gambar pada foto invoice**

Setelah disetujui, untuk tiap kandidat:
```bash
ollama pull kimi-k3:cloud
cd ~/spjan/apps/api && npx tsx scripts/probe-llm.ts "/home/ryandshinevps/spj/2026/diy/WhatsApp Image 2026-10-04 at 17.22.59.jpeg" --model kimi-k3:cloud
```
Ulangi untuk `gemma4:31b`, `glm-5.3-flash`. Kriteria memilih: jenis `hotel`, durasi di bawah 60 detik, hasil konsisten pada dua kali jalan. Catat tabel hasil (model, jenis, detik) di pesan commit.

- [x] **Step 5: Tetapkan model gambar**

Minta pengguna mengisi **Pengaturan > Model AI > Model gambar** dengan pemenang dan menekan "Uji model gambar" (di produksi, setelah deploy Task 11). Stub kandidat yang tidak dipilih dihapus: `ollama rm <nama>`.

- [x] **Step 6: Commit**
```bash
git add apps/api/scripts/probe-llm.ts
git commit -m "chore(api): skrip uji manual model terhadap dokumen asli"
```

---

### Task 11: Spec, verifikasi akhir, dan gerbang push/deploy

**Files:**
- Modify: `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md`

- [x] **Step 1: Selaraskan spec dengan implementasi 2A**

Di spec, bagian 1: ganti "uuid" pada kolom `id`/`st_id`/`pelaksana_id` menjadi `bigserial`/`bigint`; catat bahwa `pelaksana_id` belum ada di 2A (ditambahkan 2C bersama pencocokan); catat bahwa pengaturan model ada di tabel terpisah `model_ai` (satu baris), URL bawaan dari env `OLLAMA_URL`; tambahkan kode galat `BERKAS_TIDAK_TERBACA`; tambahkan di bagian 2: "2A hanya mengklasifikasi jenis; ekstraktor per jenis ditambahkan 2B-2D lewat `Ekstraktor`".

- [x] **Step 2: Verifikasi penuh**

Run:
```bash
cd ~/spjan && npm run build && npm test && npm run lint
```
Expected: semua lulus (shared, api, web lint/build). Catat jumlah tes untuk laporan.

- [x] **Step 3: Commit spec**
```bash
git add docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md docs/superpowers/plans/2026-10-04-spjan-tahap2a-fondasi.md
git commit -m "docs: selaraskan spec Tahap 2 dengan 2A dan simpan rencana implementasi"
```

- [ ] **Step 4: GERBANG: push dan deploy hanya dengan persetujuan**

Tanyakan pengguna (AskUserQuestion): push `main` ke GitHub lalu deploy 2A ke Dokploy? Bila ya: `git push origin main`, picu webhook Dokploy seperti sebelumnya (refreshToken di `/tmp/claude-1000/spjan-rtk.txt`; kontainer lama otomatis diganti), tunggu `spjan-api` `healthy`, lalu verifikasi dari luar:
```bash
curl -s https://spjan.ditpps.com/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://spjan.ditpps.com/api/berkas   # 401
docker exec spjan-app-oeyc0e-spjan-api-1 sh -c 'pdftotext -v 2>&1 | head -1; ls -ld /data/berkas'
docker exec spjan-app-oeyc0e-spjan-api-1 node -e "fetch('http://172.17.0.1:11434/api/version').then(r=>r.text()).then(console.log)"
```
Expected: `{"status":"ok"}`, `401`, versi poppler dan `/data/berkas` milik `node`, versi Ollama. Lalu minta pengguna membuka Pengaturan > Model AI dan menekan kedua tombol uji.

---

## Self-Review

**Cakupan spec 2A** (bagian 7 spec: migrasi `berkas`/`ekstraksi`, `BerkasStore`, rute unggah/daftar/hapus, worker, klien Ollama, Pengaturan Model AI + Uji model, poppler di image, volume di compose, uji model gambar):
- migrasi: Task 2; `BerkasStore`: Task 3; rute unggah/daftar/hapus (+ unduh, ulang): Task 4; klien Ollama, Pengaturan Model AI, Uji model: Task 5 (API) dan Task 9 (UI); pembaca PDF/gambar: Task 6; worker + klasifikasi: Task 7; poppler, volume, `OLLAMA_URL`, worker di server: Task 8; uji model gambar dan keputusan: Task 10; batas unggah (10 MB, 30/ST, magic bytes, dedupe sha256): Task 4; privasi (log tanpa isi): Task 7 dan catatan di Task 8/9; pemulihan pekerjaan macet, retry, SKIP LOCKED: Task 7; hapus ST menghapus berkas: Task 4; galat 410 menjadi pesan jelas: Task 5; backup volume dicatat: Task 8; pembaca palsu yang dapat disuntikkan: `KlienAi` (Task 4/5).
- Ditunda ke tahap berikutnya sesuai spec (bukan celah): halaman "Buat dari ST" dan panel Bukti/tab Usulan (2B/2C), pencocokan pelaksana (`pelaksana_id` pada `berkas`), pemetaan usulan, ekstraktor per jenis.

**Pemindaian placeholder:** tidak ada TBD/TODO; setiap langkah kode berisi kode lengkap. Satu langkah bersyarat dijelaskan eksplisit (`.env.example` bila ada; varian `Button` yang ada diperiksa dengan `grep`).

**Konsistensi tipe:** `KlienAi.chat(PermintaanAi)` (Task 4 stub, dipakai Task 5/7); `KonfigurasiAi` (Task 4 stub, dipakai Task 5 `konfigurasiAi`, Task 7); `IsiBerkas` (Task 6, dipakai Task 7); `tambahBerkas(db, store, {stId, namaAsli, data})` (Task 4, dipakai tes Task 7); `klienPalsu` (Task 5 helper, dipakai Task 7); `bikinWorker` mengembalikan `{ jalankanSekali, pulihkan, mulai, henti }` (Task 7, dipakai Task 8); `ModelAiDto.bawaanUrl` (Task 1, dikembalikan Task 5, dipakai Task 9); `UjiModelHasil` (Task 1, dipakai Task 5 dan 9). `KODE_GALAT_AI` memuat `BERKAS_TIDAK_TERBACA` yang dipakai Task 6 dan 7.

**Risiko yang perlu dicermati saat eksekusi:**
- `@fastify/multipart` versi untuk Fastify 5 (`npm install` memilih; bila peer dependency konflik, pakai versi yang dinyatakan kompatibel Fastify 5 oleh npm).
- Tes 10 MB di Task 4 membuat buffer 10 MB: lambat sedikit tetapi wajar.
- `z.toJSONSchema` pada zod 4 menghasilkan `required` dan `additionalProperties: false`; Ollama menerima ini (diverifikasi lewat tes `skema` dan uji manual Task 10).
