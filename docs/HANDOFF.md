# SPJAN: Catatan Handoff untuk Agen Berikutnya

Ditulis 2026-10-05 oleh Claude (sesi 4bd77fb6) atas permintaan pengguna, untuk agen AI yang melanjutkan. Baca berkas ini dulu, lalu `CLAUDE.md`. Semua nilai rahasia sengaja TIDAK ditulis di sini.

## 1. Gambaran singkat
- **Produk**: web app SPJAN untuk menyusun SPJ perjalanan dinas (SPTB, Rincian Biaya, Kuitansi) Direktorat Pengendalian Perhutanan Sosial, Kemenhut. **Satu pengguna** (akun admin tunggal). Bahasa antarmuka dan komunikasi dengan pengguna: **Indonesia**.
- **Repo**: `~/spjan` (GitHub `ryandshine/spjan`). Produksi: https://spjan.ditpps.com (aktif, pengguna sudah berhasil login).
- **Tahap 1 (inti)**: selesai dan live.
- **Tahap 2A (fondasi)**: selesai, dimerge ke `main`, dipush, dan telah live di produksi https://spjan.ditpps.com.
- **Tahap 2B (ST menjadi draf)**: selesai dikerjakan dan diuji penuh di cabang `tahap-2b` (156 tes vitest lulus, lint/build lulus, probe `ST.226.pdf` sukses 4.1s). Menunggu persetujuan pengguna untuk merge ke `main`, push, dan deploy.

## 2. Peta dokumen (sumber kebenaran)
| Dokumen | Isi |
|---|---|
| `CLAUDE.md` | Konvensi repo, perintah, struktur |
| `docs/superpowers/specs/2026-10-04-spjan-design.md` | Rancangan Tahap 1, aturan hitung SBM (PMK 32/2025) |
| `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md` | **Spec Tahap 2 (otoritas mengikat)**, diselaraskan dengan Tahap 2A & 2B |
| `docs/superpowers/plans/2026-10-04-spjan-tahap2a-fondasi.md` | Rencana 2A (selesai & live di Dokploy) |
| `docs/superpowers/plans/2026-10-05-spjan-tahap2b-st-ke-draf.md` | **Rencana 2B** (6 tugas, selesai diuji) |
| `docs/deploy.md` | Runbook deploy (Dokploy, env, backup, Cloudflare tunnel) |

## 3. Keadaan git SAAT INI (penting)
- Cabang kerja **`tahap-2b`**: memuat pengerasan worker, skema ekstraksi ST, pemetaan usulan di `@spjan/shared`, ekstraktor ST di `apps/api`, endpoint `GET /api/berkas/:id/usulan-st` & buat ST dari berkas, serta antarmuka web `/st/buat-dari-st`.
- `main` = `1fefaf3` (live di produksi).
- Tes terakhir: shared 68 lulus, api 88 lulus (Postgres nyata `spjan_test`), total 156 lulus, lint & build monorepo sukses, image Docker `Dockerfile.combined` lulus build.
- **Gerbang Persetujuan**: Menggabungkan `tahap-2b` ke `main`, push, dan deploy adalah gerbang yang membutuhkan izin eksplisit pengguna.

## 4. Fakta infrastruktur yang sudah dipelajari dengan susah payah
- **Dokploy**: proyek `spjan`, compose bernama `app` (composeId `rlO_EjvL20bHhcWdy1eAw`, appName `spjan-app-oeyc0e`). Kontainer: `spjan-app-oeyc0e-spjan-api-1`, `spjan-app-oeyc0e-spjan-web-1`. Dibuat lewat UI oleh pengguna; **env dikelola di UI Dokploy** (DATABASE_URL, ADMIN_USERNAME=`admin`, ADMIN_PASSWORD, SESSION_TTL_DAYS). Kata sandi ada di env Dokploy, **jangan** dicetak atau ditulis ke repo. Berkas bantu sementara di host (`/tmp/claude-1000/spjan-secrets.env`, `spjan-rtk.txt`) mungkin sudah tidak ada; refreshToken webhook dapat dilihat di pengaturan compose Dokploy.
- **Cara deploy** (hanya setelah pengguna setuju): push ke `origin/main`, lalu `POST http://100.109.156.10:3000/api/deploy/compose/<refreshToken>` dengan header `Content-Type: application/json`, `X-GitHub-Event: push`, body `{"ref":"refs/heads/main","repository":{"name":"spjan","full_name":"ryandshine/spjan"}}`. Tunggu `spjan-api` berstatus healthy. Pengguna sudah menambahkan aturan izin `/permissions` untuk `docker exec` dan POST webhook itu; selain itu sistem pengaman memblokir penulisan ke database Dokploy.
- **Database**: database `spjan` + peran `spjan` di server PostgreSQL SIPEKAPS (`gealgeolgeo-postgis`, lewat `dokploy-network`). Dev/tes: kontainer terpisah `spjan-dev-postgres` (127.0.0.1:55432, DB `spjan_dev` dan `spjan_test`; `docker compose -f docker-compose.dev.yml up -d`). Migrasi SQL berjalan otomatis saat boot API.
- **Nama layanan compose harus unik** (`spjan-api`, `spjan-web`): `dokploy-network` dipakai banyak proyek, nama generik (`api`, `web`) pernah membuat permintaan nyasar ke kontainer proyek lain.
- **Router Traefik `web` TIDAK boleh memakai `redirect-to-https`**: Cloudflare Tunnel masuk ke Traefik lewat HTTP port 80, redirect menyebabkan loop 308. (Sudah diperbaiki di `33b1dc3`; jangan dikembalikan.)
- **Cloudflare Tunnel** `548807be-8bcf-4b30-a7fc-0feac2a91e54` dikelola dari **dashboard** (Zero Trust > Networks > Tunnels), bukan `/etc/cloudflared/config.yml` lokal (entri lokal diabaikan). Hostname `spjan.ditpps.com` → HTTP `172.17.0.2:80` sudah ditambahkan di dashboard. Tunnel sipekaps (`545b0514…`) terpisah dan dikelola lokal; jangan disentuh.
- **Ollama** di host: `ollama serve` (v0.16.2) mendengarkan `0.0.0.0:11434`, tanpa GPU, 8 vCPU, RAM 15 GB dibagi dengan SIPEKAPS. Model lokal hanyalah stub cloud: `gpt-oss:20b-cloud`, `gpt-oss:120b-cloud` (teks, **terbukti jalan**: klasifikasi ST.226 jenis `st` dalam 1,7 detik), `kimi-k2.5:cloud` (**sudah pensiun 2026-07-31, HTTP 410**), `glm-5:cloud`. Katalog ollama.com yang mendukung gambar (vision): `kimi-k3`, `kimi-k2.6`, `gemma4:31b`, `glm-5.3-flash`, `deepseek-v4.1-flash`, `minimax-m3`. Memakainya butuh `ollama pull <nama>:cloud` (menambah stub di Ollama bersama): **minta izin pengguna dulu**. Dari kontainer API, Ollama terjangkau di `http://172.17.0.1:11434` (sudah diuji dari kontainer produksi lama; ulangi dari kontainer baru).
- Server dipakai bersama aplikasi lain (SIPEKAPS, kitapantaups, gealgeolgeo, pgadmin). Jangan mengubah resource bersama (Dokploy DB, Traefik global, tunnel lain, Ollama) tanpa persetujuan pengguna.

## 5. Arsitektur Tahap 2A dalam satu paragraf
Semua di `apps/api`, tanpa container baru. Berkas diunggah multipart ke `POST /api/berkas?stId=` (jenis dari magic bytes, maks 10 MB, 30/ST, dedupe sha256), disimpan lewat antarmuka `BerkasStore` (implementasi `FileBerkasStore` di Docker volume `spjan-berkas`, `/data/berkas`), metadata di tabel `berkas`; tiap unggahan membuat baris `ekstraksi` berstatus `antre`. Worker in-process (`ekstraksi/worker.ts`, `bikinWorker`) mengklaim pekerjaan dengan `FOR UPDATE SKIP LOCKED`, membaca isi (`baca-berkas.ts`: PDF berteks lewat `pdftotext`, PDF pindai dirender `pdftoppm`, gambar langsung), memanggil model lewat antarmuka `KlienAi` (`klienOllama`, `/api/chat`, keluaran JSON terstruktur dari skema zod), memvalidasi dengan zod (coba ulang sekali), lalu menyimpan hasil. **Di 2A worker hanya mengklasifikasi jenis berkas** (`st|hotel|tiket|transport|lainnya`); ekstraktor per jenis ditambahkan di 2B-2D lewat tipe `Ekstraktor`. Model/URL diatur di tabel `model_ai` (satu baris) lewat `GET/PUT /api/model-ai` dan UI Pengaturan > Model AI, dengan `POST /api/model-ai/uji`. Hasil bacaan akan selalu berupa **usulan** yang disetujui pengguna (belum ada UI-nya; itu 2B/2C). Log hanya memuat id berkas, model, status, kode galat, durasi (diuji; jangan tambah log yang mencetak error/teks dokumen).

## 6. Apa yang masih menunggu (urutan disarankan)
1. **Gerbang pengguna (jangan dilewati)**: tanya pengguna sebelum (a) menambah stub model gambar di Ollama, (b) menggabungkan `tahap-2a` ke `main`, (c) `git push`, (d) deploy. Pola yang biasa dipakai pengguna: commit per tugas disetujui, tetapi push dan deploy dijawab terpisah ("Push lalu ...").
2. **Uji model gambar** (sisa Task 10 Step 3-5 di rencana 2A): setelah izin, `ollama pull kimi-k3:cloud` (dan `gemma4:31b`, `glm-5.3-flash`), lalu `cd apps/api && npx tsx scripts/probe-llm.ts "<foto invoice>" --model <nama>` pada foto contoh di `~/spj/2026/diy/` (`WhatsApp Image 2026-10-04 at 17.22.59.jpeg`, invoice The Royal Alana, foto miring). Pilih model: jenis `hotel`, di bawah 60 detik, konsisten dua kali jalan. Hapus stub yang tidak dipilih (`ollama rm`). Pengguna lalu mengisi Pengaturan > Model AI > Model gambar.
3. **Merge + push + deploy 2A** (setelah izin), lalu pemeriksaan produksi: `/api/health`, `/api/berkas` tanpa login = 401, "Uji model" teks dari UI, `ls -ld /data/berkas` milik `node`, pastikan Ollama (0.0.0.0:11434) tidak terbuka ke publik di firewall.
4. **Tulis rencana 2B** (ST → draf: skema ekstraksi ST, pemetaan ke `SuratTugasPayload`, halaman "Buat dari ST"). **Mulai dari `docs/superpowers/plans/2026-10-04-spjan-tahap2b-catatan.md`**: bagian "Wajib dikerjakan sebelum UI unggah dipasang" harus masuk ke tugas awal 2B. Lalu 2C (invoice hotel + panel Bukti + tab Usulan, kolom `pelaksana_id` pada `berkas`), 2D (tiket + bukti transport).
5. Hal Tahap 1 yang pernah diminta pengguna dicek: **aturan kelas tiket per status pegawai** belum diverifikasi terhadap PMK Perjalanan Dinas; fitur ganti password belum ada: `ensureAdmin` (`apps/api/src/auth.ts`) hanya membuat akun bila tabel `users` kosong, jadi mengubah `ADMIN_PASSWORD` di env Dokploy TIDAK mengganti sandi akun yang sudah ada (menggantinya sekarang butuh `update users` manual di database `spjan` atau fitur baru); backup volume berkas belum diatur (lihat `docs/deploy.md`).

## 7. Cara bekerja di repo ini
- Perintah: lihat `CLAUDE.md`. Setelah mengubah `packages/shared`, jalankan `npm run build -w @spjan/shared` sebelum tes/lint API (API mengimpor dari `dist`). Tes API membutuhkan Postgres dev (`npm run db:up`); tes tidak boleh memanggil jaringan luar (pembaca model palsu lewat `klienPalsu` atau server HTTP lokal).
- Proses yang dipakai sesi ini: `superpowers:brainstorming` → spec → `superpowers:writing-plans` → `superpowers:subagent-driven-development` (implementer per tugas, review per tugas, review akhir). Pola itu berhasil; ulangi untuk 2B.
- Commit: satu per tugas, pesan Indonesia bergaya `feat(api): ...`; akhiri dengan dua baris trailer persis (jangan ganti nama model):
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM
  ```
  (Satu commit lama `cc1fe83` salah menulis "Haiku 4.5"; sengaja tidak ditulis ulang.)
- `.gitignore` mengabaikan `apps/api/data/` (unggahan lokal). **Jangan** menambah pola `data/` polos: itu akan mengabaikan `packages/shared/src/data/sbm-2026.ts` (fixture SBM yang di-track). Dokumen asli (ST.226.pdf, foto invoice) berisi NIP/nama: jangan dimasukkan ke repo atau log.
- Pengguna berbahasa Indonesia, pegawai Ditjen PS; menyukai diskusi desain dulu, keputusan satu per satu, dan hasil yang diverifikasi sebelum diklaim selesai.

## 8. Keputusan yang diambil atas nama pengguna selama eksekusi 2A (bisa dibatalkan)
1. Bekerja di cabang `tahap-2a` (bukan worktree) agar `main`/produksi tetap utuh. Biaya bila salah: pindah worktree butuh `npm ci`.
2. Push/merge/deploy tidak dilakukan.
3. Helper tes `pdfSederhana(teks, ukuranFont?)` diberi parameter opsional agar tes pemotongan 12.000 karakter benar-benar teruji. Biaya bila salah: kembalikan helper.
4. Batasan "log tanpa isi dokumen" menang atas kode rencana yang mencetak error penuh: worker hanya mencatat id, kode, nama galat, durasi. Biaya bila salah: log kurang informatif.
5. Task 10 dibagi: skrip probe dan uji teks dikerjakan, uji model gambar (menambah stub Ollama bersama) ditahan untuk persetujuan pengguna.
6. Review terpisah untuk edit dokumen spec dilebur ke review akhir.
7. `.gitignore` memakai `apps/api/data/`, bukan `data/` (alasan di bagian 7).

## 9. Risiko yang perlu diingat
- Model cloud bisa dipensiunkan tanpa pemberitahuan (HTTP 410): nama model adalah pengaturan, bukan kode. Jalur ini sudah ditangani (`MODEL_PENSIUN`).
- Dokumen yang dibaca model cloud keluar dari server ke ollama.com. Pengguna sudah menyetujui ini untuk semua jenis dokumen; sebutkan di UI (sudah ada di kartu Model AI).
- Worker menahan pekerjaan `berjalan` sampai restart bila galat DB terjadi di tengah proses (diperbaiki di 2B, lihat catatan 2B). Karena belum ada UI unggah, di 2A tidak ada yang mengisi antrean.
