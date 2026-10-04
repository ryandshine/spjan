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
Dokumen PDF (SPTB, Rincian, Kuitansi) dibuat di peramban dengan `@react-pdf/renderer` (`apps/web/src/pdf/`). Font: Liberation Sans (metrik sama dengan Arial, lisensi SIL OFL) di `apps/web/public/fonts/` beserta berkas lisensinya.
Untuk memeriksa tata letak tanpa peramban: `npm run pdf:contoh -w web -- /tmp/spjan-pdf` (data contoh di `apps/web/scripts/sample-data.ts`), lalu `pdftoppm -r 70 -png /tmp/spjan-pdf/semua.pdf /tmp/spjan-pdf/p` untuk melihat halamannya. File `pdf/*.tsx` memakai impor relatif (bukan alias `@/`) agar skrip Node bisa menjalankannya.
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
