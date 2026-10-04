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
