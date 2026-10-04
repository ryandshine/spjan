# SPJAN Tahap 1D: Konfigurasi Deploy Dokploy - Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyiapkan image Docker, compose Dokploy, dan runbook agar SPJAN dapat dijalankan di `spjan.ditpps.com`, serta mengeraskan API untuk lingkungan produksi (variabel env kosong dari compose). Tahap ini tidak men-deploy apa pun.

**Architecture:** Satu `Dockerfile.combined` dengan target `api` (dependensi produksi saja, `USER node`, healthcheck) dan `web` (nginx statis + proxy `/api/` ke `api:8000` dengan resolver Docker). `docker-compose.dokploy.yml` menghubungkan keduanya ke `dokploy-network` dengan label Traefik. Database `spjan` ada di server PostgreSQL SIPEKAPS (alias `gealgeolgeo-postgis`).

**Tech Stack:** Docker, node:22-alpine, nginx:alpine, Traefik (label), Dokploy.

**Spec:** `docs/superpowers/specs/2026-10-04-spjan-design.md` (bagian 8, 11); rencana 1A-1C (sudah di `main`).

## Global Constraints

- Jangan men-deploy, memicu webhook, atau menyentuh kontainer/database SIPEKAPS. Uji lokal hanya memakai kontainer `spjan-dev-postgres` dan jaringan Docker sementara yang dihapus setelah selesai.
- `NODE_ENV=production` membuat cookie sesi `Secure`; uji lokal lewat `http://localhost` tetap berjalan (peramban memperlakukan localhost sebagai konteks aman). `FRONTEND_ORIGIN` pada kontainer api harus sama persis dengan alamat yang dibuka di peramban (mis. `http://localhost:18081` saat uji).
- Variabel env yang tidak diisi di Dokploy dikirim compose sebagai string kosong; API harus memperlakukannya sebagai tidak ada.
- Tidak ada rahasia di repo: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` hanya di environment Dokploy.
- Jangan commit, push, atau deploy tanpa persetujuan eksplisit pengguna di setiap gerbang. Pesan commit Conventional Commits dengan trailer `Co-Authored-By` dan `Claude-Session`.

## Struktur berkas

```
apps/api/src/config.ts, server.ts, config.test.ts   env kosong = tidak ada; peringatan bila belum ada akun
Dockerfile.combined, .dockerignore, apps/web/nginx.conf.template
docker-compose.dokploy.yml
docs/deploy.md, CLAUDE.md, spesifikasi bagian 11
```

---

### Task 1: Pengerasan API untuk produksi (env kosong dan peringatan tanpa akun)

**Files:**
- Modify: `apps/api/src/config.ts`, `apps/api/src/server.ts`
- Test: `apps/api/src/config.test.ts`

**Interfaces:**
- Consumes: skema env zod di `config.ts`; `ensureAdmin`, `pool` (rencana 1B).
- Produces: `config.ADMIN_USERNAME`/`ADMIN_PASSWORD` bernilai `undefined` bila env kosong (`""`) atau tidak ada; log peringatan `[startup] PERINGATAN: belum ada akun...` bila tabel `users` kosong setelah boot.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/src/config.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function muatConfig() {
  vi.resetModules();
  return (await import("./config.js")).config;
}

describe("config", () => {
  it("ADMIN_USERNAME dan ADMIN_PASSWORD kosong dianggap tidak ada (compose Dokploy)", async () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    const config = await muatConfig();
    expect(config.ADMIN_USERNAME).toBeUndefined();
    expect(config.ADMIN_PASSWORD).toBeUndefined();
  });

  it("nilai terisi dipertahankan dan SESSION_TTL_DAYS default 7", async () => {
    vi.stubEnv("ADMIN_USERNAME", " admin ");
    vi.stubEnv("ADMIN_PASSWORD", "rahasia-panjang-123");
    const config = await muatConfig();
    expect(config.ADMIN_USERNAME).toBe("admin");
    expect(config.ADMIN_PASSWORD).toBe("rahasia-panjang-123");
    expect(config.SESSION_TTL_DAYS).toBe(7);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd apps/api && npx vitest run src/config.test.ts`
Expected: FAIL pada tes pertama (`ZodError` karena `ADMIN_USERNAME` kosong tidak lolos `min(1)`).

- [ ] **Step 3: Ubah config.ts**

`apps/api/src/config.ts`:
```ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const kosongJadiUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  // compose menyetel variabel kosong ("") bila tidak diisi di Dokploy; perlakukan sebagai tidak ada.
  ADMIN_USERNAME: z.preprocess(kosongJadiUndefined, z.string().trim().min(1).optional()),
  ADMIN_PASSWORD: z.preprocess(kosongJadiUndefined, z.string().min(1).optional()),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  STARTUP_DB_MAX_RETRIES: z.coerce.number().int().min(0).default(10),
  STARTUP_DB_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(3000),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
```

- [ ] **Step 4: Tambah peringatan di server.ts**

Di `apps/api/src/server.ts`, ganti baris `if (await ensureAdmin(pool)) console.log(...)` dengan:
```ts
  if (await ensureAdmin(pool)) console.log("[startup] akun pertama dibuat dari ADMIN_USERNAME/ADMIN_PASSWORD");
  const { rows: pengguna } = await pool.query<{ n: number }>("select count(*)::int as n from users");
  if ((pengguna[0]?.n ?? 0) === 0) {
    console.warn("[startup] PERINGATAN: belum ada akun. Isi ADMIN_USERNAME dan ADMIN_PASSWORD lalu mulai ulang api.");
  }
```

- [ ] **Step 5: Jalankan tes dan lint**

Run: `cd apps/api && npx vitest run && npx tsc -p tsconfig.lint.json --noEmit`
Expected: `Tests  23 passed (23)`; lint tanpa keluaran.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/api/src/config.ts apps/api/src/server.ts apps/api/src/config.test.ts
git commit -m "fix(api): perlakukan ADMIN_* kosong sebagai tidak ada dan beri peringatan tanpa akun

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 2: Image Docker (api dan web) dan nginx

**Files:**
- Create: `Dockerfile.combined`, `.dockerignore`, `apps/web/nginx.conf.template`

**Interfaces:**
- Consumes: skrip `build` workspace (`@spjan/shared`, `api`, `web`); `apps/api/migrations`; keluaran `apps/web/dist`.
- Produces: target `api` (port 8000, `USER node`, `HEALTHCHECK` pada `/api/health`, dependensi produksi saja) dan target `web` (nginx port 80; env `API_UPSTREAM` default `http://api:8000`; `/api/` diteruskan dengan resolver Docker, `/assets/` immutable 1 tahun, `/fonts/` 30 hari bertipe `font/ttf`, rute lain jatuh ke `index.html` tanpa cache).

- [ ] **Step 1: Tulis berkas**

`Dockerfile.combined`:
```dockerfile
# SPJAN - satu Dockerfile dengan dua target: `api` dan `web` (lihat docker-compose.dokploy.yml).

# --- Tahap 1: dependensi + build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
# shared dulu: api mengimpor dari packages/shared/dist
RUN npm run build -w @spjan/shared && npm run build -w api && npm run build -w web

# --- Target api: hanya dependensi produksi ---
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w api -w @spjan/shared && npm cache clean --force
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
# Migrasi berjalan otomatis saat boot (migrate.ts membaca ../migrations relatif ke dist/).
COPY --from=builder /app/apps/api/migrations apps/api/migrations
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/api/health >/dev/null || exit 1
CMD ["npm", "run", "start", "-w", "api"]

# --- Target web: berkas statis + nginx (meneruskan /api ke API_UPSTREAM) ---
FROM nginx:alpine AS web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_UPSTREAM=http://api:8000
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`.dockerignore`:
```
**/node_modules
**/dist
.git
.gitignore
.env
.env.*
docs
*.log
docker-compose*.yml
Dockerfile*
```

`apps/web/nginx.conf.template`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Resolver Docker: nama layanan API dicari saat permintaan, bukan saat nginx start,
    # sehingga web tetap bisa naik walau API belum siap.
    resolver 127.0.0.11 valid=10s ipv6=off;
    resolver_timeout 5s;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml font/ttf;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options SAMEORIGIN always;

    location /api/ {
        set $upstream ${API_UPSTREAM};
        proxy_pass $upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 2m;
    }

    # Berkas hasil build Vite bernama berdasarkan hash isinya: aman di-cache lama.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff always;
        try_files $uri =404;
    }

    location /fonts/ {
        default_type font/ttf;
        expires 30d;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options nosniff always;
        try_files $uri =404;
    }

    # SPA: semua rute lain ke index.html, yang tidak boleh di-cache agar klien selalu mendapat bundel terbaru.
    location / {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header X-Content-Type-Options nosniff always;
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Bangun kedua image**

Run (dari root):
```bash
docker build --target api -f Dockerfile.combined -t spjan-api:test .
docker build --target web -f Dockerfile.combined -t spjan-web:test .
docker run --rm spjan-web:test nginx -t
```
Expected: kedua build sukses (api sekitar 290 MB, web sekitar 100 MB); `nginx: configuration file ... test is successful`.

- [ ] **Step 3: Uji tumpukan produksi secara lokal**

Run (dari root; database dev harus hidup: `npm run db:up`):
```bash
docker exec spjan-dev-postgres psql -U postgres -c "drop database if exists spjan_dev" -c "create database spjan_dev"
docker network create spjan-test && docker network connect spjan-test spjan-dev-postgres
docker run -d --name spjan-test-api --network spjan-test -e NODE_ENV=production -e PORT=8000 \
  -e DATABASE_URL=postgres://postgres:postgres@spjan-dev-postgres:5432/spjan_dev \
  -e FRONTEND_ORIGIN=http://localhost:18081 -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=sandi-dev-12345 spjan-api:test
docker run -d --name spjan-test-web --network spjan-test -e API_UPSTREAM=http://spjan-test-api:8000 -p 127.0.0.1:18081:80 spjan-web:test
sleep 14
docker ps --format '{{.Names}} {{.Status}}' | grep spjan-test
curl -s localhost:18081/api/health
curl -s -o /dev/null -w "spa %{http_code}\n" localhost:18081/st/1
curl -s -I localhost:18081/fonts/LiberationSans-Regular.ttf | grep -i content-type
```
Expected: `spjan-test-api ... (healthy)` dan `spjan-test-web ... Up`; `{"status":"ok"}`; `spa 200`; `Content-Type: font/ttf`. Lalu jalankan skrip peramban `dok.mjs` dari rencana 1C-3 dengan alamat `http://localhost:18081` setelah membuat surat tugas contoh lewat API (`origin: http://localhost:18081` pada permintaan): keempat PDF terunduh dan `errors: []`.

- [ ] **Step 4: Bersihkan uji**

Run:
```bash
docker rm -f spjan-test-web spjan-test-api
docker network disconnect spjan-test spjan-dev-postgres && docker network rm spjan-test
```
Expected: tidak ada kontainer atau jaringan `spjan-test` tersisa.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add Dockerfile.combined .dockerignore apps/web/nginx.conf.template
git commit -m "feat(deploy): Dockerfile api dan web serta konfigurasi nginx

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 3: Compose Dokploy dan runbook

**Files:**
- Create: `docker-compose.dokploy.yml`, `docs/deploy.md`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-04-spjan-design.md`

**Interfaces:**
- Consumes: target image `api` dan `web` (Task 2); env `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_TTL_DAYS` (Task 1).
- Produces: compose dengan layanan `api` (env produksi, `FRONTEND_ORIGIN=https://spjan.ditpps.com`) dan `web` (label Traefik untuk `spjan.ditpps.com`, redirect HTTPS, Let's Encrypt) pada `dokploy-network` eksternal; runbook pembuatan peran/database, konfigurasi Dokploy, webhook, verifikasi, pencadangan.

- [ ] **Step 1: Tulis compose**

`docker-compose.dokploy.yml`:
```yaml
# Compose untuk Dokploy (proyek `spjan`, domain spjan.ditpps.com lewat Traefik).
# Variabel yang wajib diisi di environment Dokploy: DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
# (dua yang terakhir hanya dipakai untuk membuat akun pertama saat tabel users masih kosong).
# Jangan menambahkan domain lewat antarmuka Dokploy: routing Traefik sudah ditulis pada label di bawah.
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.combined
      target: api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=8000
      - DATABASE_URL=${DATABASE_URL}
      - FRONTEND_ORIGIN=https://spjan.ditpps.com
      - ADMIN_USERNAME=${ADMIN_USERNAME:-}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
      - SESSION_TTL_DAYS=${SESSION_TTL_DAYS:-7}
    networks:
      - default
      - dokploy-network

  web:
    build:
      context: .
      dockerfile: Dockerfile.combined
      target: web
    restart: unless-stopped
    environment:
      - API_UPSTREAM=http://api:8000
    depends_on:
      - api
    networks:
      - default
      - dokploy-network
    labels:
      traefik.docker.network: dokploy-network
      traefik.enable: "true"
      traefik.http.routers.spjan-web.entrypoints: web
      traefik.http.routers.spjan-web.middlewares: redirect-to-https@file
      traefik.http.routers.spjan-web.rule: Host(`spjan.ditpps.com`)
      traefik.http.routers.spjan-web.service: spjan-web
      traefik.http.routers.spjan-websecure.entrypoints: websecure
      traefik.http.routers.spjan-websecure.rule: Host(`spjan.ditpps.com`)
      traefik.http.routers.spjan-websecure.service: spjan-websecure
      traefik.http.routers.spjan-websecure.tls.certresolver: letsencrypt
      traefik.http.services.spjan-web.loadbalancer.server.port: "80"
      traefik.http.services.spjan-websecure.loadbalancer.server.port: "80"

networks:
  # Jaringan overlay Dokploy: Traefik menjangkau `web` lewat sini, dan `api` menjangkau
  # PostgreSQL (alias gealgeolgeo-postgis) lewat sini.
  dokploy-network:
    external: true
```

- [ ] **Step 2: Validasi compose**

Run: `DATABASE_URL=postgres://x docker compose -f docker-compose.dokploy.yml config`
Expected: konfigurasi tercetak tanpa galat, memuat dua layanan, label Traefik `spjan-web`/`spjan-websecure`, dan jaringan `dokploy-network`.

- [ ] **Step 3: Tulis runbook**

`docs/deploy.md`:
```markdown
# Deploy SPJAN ke Dokploy (spjan.ditpps.com)

Server produksi adalah mesin yang sama dengan SIPEKAPS: Docker + Dokploy + Traefik. SPJAN berupa dua kontainer
(`api` dan `web`, lihat `docker-compose.dokploy.yml`) dan memakai database `spjan` di server PostgreSQL SIPEKAPS
(kontainer `gealgeolgeo-postgis`, alias di jaringan `dokploy-network`).

## Sekali di awal

1. **Buat peran dan database** di server PostgreSQL (dari mesin server; ganti kata sandi dan pengguna admin sesuai instalasi):
   ```bash
   docker exec -e PGPASSWORD='<sandi admin postgres>' gealgeolgeo-postgis \
     psql -U gealgeolgeo -d postgres -c "create role spjan login password '<sandi-baru-yang-kuat>'" \
                                      -c "create database spjan owner spjan"
   ```
   `DATABASE_URL` yang dipakai aplikasi: `postgres://spjan:<sandi-baru-yang-kuat>@gealgeolgeo-postgis:5432/spjan`.
   Peran `spjan` hanya memiliki database `spjan`; tidak menyentuh database `sipekaps`.
2. **DNS**: pastikan `spjan.ditpps.com` mengarah ke server (rekaman A atau wildcard `*.ditpps.com` yang sudah ada).
3. **Proyek Dokploy `spjan`** (jenis Compose):
   - Sumber: GitHub `ryandshine/spjan`, branch `main`.
   - Compose path: `docker-compose.dokploy.yml`.
   - Environment: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (kata sandi kuat; hanya dipakai membuat akun pertama).
     Opsional: `SESSION_TTL_DAYS` (default 7).
   - **Jangan** menambah domain lewat antarmuka Dokploy; routing Traefik sudah ada pada label compose.
4. Catat URL webhook deploy compose proyek ini (dipakai pada langkah Deploy).

## Setiap deploy

Alur kerja proyek: `git push origin main`, lalu picu webhook Dokploy secara manual (masing-masing gerbang
memerlukan persetujuan pengguna):
```bash
curl -sS -X POST "<URL webhook compose spjan>" \
  -H "Content-Type: application/json" -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","repository":{"name":"spjan","full_name":"ryandshine/spjan"}}'
```
Migrasi basis data dan seed SBM berjalan otomatis saat kontainer `api` boot (idempoten, dengan advisory lock);
tidak ada langkah migrasi manual.

## Verifikasi setelah deploy

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep spjan        # api (healthy) dan web Up
docker logs --since 4m <kontainer api spjan> | grep -E "migrate|startup|listening|error"
curl -s https://spjan.ditpps.com/api/health                    # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://spjan.ditpps.com/api/pegawai   # 401 (bukan 404/500)
```
Lalu buka https://spjan.ditpps.com, masuk dengan `ADMIN_USERNAME`/`ADMIN_PASSWORD`, isi menu Pengaturan
(satker, PPK, bendahara, pejabat bertanggung jawab) dan tambah pegawai.

## Pencadangan

Cadangkan database `spjan` secara berkala, mis.:
```bash
docker exec -e PGPASSWORD='<sandi spjan>' gealgeolgeo-postgis \
  pg_dump -U spjan -d spjan -Fc > spjan-$(date +%F).dump
```
Pulihkan dengan `pg_restore` ke database `spjan` yang kosong.

## Mengganti kata sandi akun

Akun dibuat hanya bila tabel `users` kosong. Untuk mengganti kata sandi, hapus baris pengguna lalu boot ulang `api`
dengan `ADMIN_PASSWORD` baru, atau minta fitur ubah kata sandi ditambahkan ke aplikasi.
```

- [ ] **Step 4: Perbarui CLAUDE.md dan spesifikasi**

Tambahkan bagian "Deploy" pada `CLAUDE.md` sebelum "Konvensi":
```markdown


Produksi: Dokploy + Traefik di `spjan.ditpps.com` (mesin yang sama dengan SIPEKAPS). `Dockerfile.combined` punya dua target
(`api`, `web`); `docker-compose.dokploy.yml` menjalankan keduanya dengan label Traefik dan jaringan `dokploy-network`.
`web` (nginx) melayani berkas statis dan meneruskan `/api/` ke `api:8000`; database `spjan` ada di server PostgreSQL SIPEKAPS.
Langkah awal dan verifikasi: `docs/deploy.md`. Migrasi dan seed SBM otomatis saat `api` boot.
Menguji image secara lokal: `docker build --target api|web -f Dockerfile.combined .`, jalankan pada satu jaringan Docker dengan
`spjan-dev-postgres` (FRONTEND_ORIGIN harus sama dengan alamat yang dibuka di peramban).
```

Tambahkan butir ini di akhir bagian 11 spesifikasi:
```markdown
- Deploy: `api` menjangkau PostgreSQL lewat `dokploy-network` (alias `gealgeolgeo-postgis` pada jaringan overlay itu), bukan `gealgeolgeo-db` (bridge lokal). `web` meneruskan `/api/` ke `api:8000` dengan resolver Docker (resolusi saat permintaan). Image `api` hanya berisi dependensi produksi.
```

- [ ] **Step 5: Jalankan semua gerbang dari root**

Run: `npm run lint && npm run build && npm run test`
Expected: lint dan build tanpa galat; shared `Tests  60 passed (60)` dan api `Tests  23 passed (23)`.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add docker-compose.dokploy.yml docs CLAUDE.md
git commit -m "feat(deploy): compose Dokploy, runbook deploy, dan dokumentasi

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

## Self-Review

1. **Cakupan spec:** bagian 8 (compose dengan `api` dan `web`, satu domain spjan.ditpps.com via Traefik + Let's Encrypt, nginx meneruskan `/api`, database `spjan` di server Postgres yang sama, env `DATABASE_URL` dan akun pertama, migrasi dan seed otomatis saat boot, deploy lewat webhook dengan gerbang terpisah) = Task 1-3; `SESSION_SECRET` sudah dihapus pada bagian 11. Pembuatan database, ID webhook, dan kata sandi akun dilakukan pengguna (runbook `docs/deploy.md`); deploy sendiri tidak dilakukan pada rencana ini.
2. **Placeholder:** tidak ada; semua langkah memuat isi berkas lengkap, perintah, dan keluaran yang diharapkan. Nilai dalam kurung sudut di runbook (`<sandi-baru-yang-kuat>`, `<URL webhook compose spjan>`) adalah isian yang memang hanya diketahui pengguna.
3. **Konsistensi:** nama layanan `api`/`web`, port 8000/80, `dokploy-network`, `FRONTEND_ORIGIN`, dan `API_UPSTREAM` sama di Dockerfile, nginx, compose, dan runbook; jumlah tes (api 23, shared 60) sesuai berkas.
