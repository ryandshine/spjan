# SPJAN Tahap 2: Ekstraksi Dokumen - Rancangan

Disetujui pengguna secara lisan pada sesi 2026-10-04. Melengkapi `2026-10-04-spjan-design.md` (Tahap 1, sudah live di spjan.ditpps.com).

## Tujuan
Pengguna mengunggah Surat Tugas (ST), invoice hotel, tiket, dan bukti transport; isian SPJ terisi dari dokumen itu dengan sedikit pengetikan. Hasil baca model selalu berupa **usulan** yang disetujui pengguna, tidak pernah langsung menulis ke ST.

## Keputusan
- Cakupan dokumen: ST (PDF), invoice hotel (foto/PDF), tiket pesawat/kereta, bukti lain (taksi, bensin, tol, dan sejenisnya).
- Model cloud (ollama.com) boleh dipakai untuk semua dokumen, termasuk foto yang berisi nama dan nominal.
- Alur: mulai dari ST ("Buat dari ST"), lalu bukti diunggah di editor ST.
- Arsitektur A: semua di dalam `apps/api`, tanpa container baru; berkas di Docker volume; antrean di Postgres. Layanan Python/OCR/MinIO terpisah ditolak karena OCR lokal tidak lagi dibutuhkan.
- Satu pengguna, volume kecil (puluhan berkas per ST).

## Fakta lingkungan (diverifikasi 2026-10-04)
- Ollama v0.16.2 di host, `OLLAMA_HOST=0.0.0.0:11434`; container API menjangkau `http://172.17.0.1:11434`. Server tanpa GPU, 8 vCPU, RAM 15 GB (dipakai bersama SIPEKAPS) sehingga model lokal tidak dipakai.
- Model terpasang di Ollama lokal hanya stub cloud: `gpt-oss:20b-cloud`, `gpt-oss:120b-cloud` (teks, berfungsi), `kimi-k2.5:cloud` (**pensiun 2026-07-31, HTTP 410**), `glm-5:cloud`.
- Model cloud berkemampuan vision di katalog ollama.com: `kimi-k3`, `kimi-k2.6`, `gemma4:31b`, `glm-5.3-flash`, `deepseek-v4.1-flash`, `minimax-m3`. Belum diuji membaca foto invoice nyata; menguji berarti menambah stub model di Ollama bersama (butuh persetujuan pengguna, dapat dihapus dengan `ollama rm`).
- ST.226.pdf berteks digital (ditandatangani BSrE), terbaca penuh oleh `pdftotext -layout`. Invoice hotel contoh berupa foto WhatsApp miring berlatar buram.
- Model data ST sudah menampung semua isian: `EtapeInput.hotelNama/hotelTarif`, `BiayaInput` (TIKET_PERGI, TIKET_KEMBALI, TAKSI_TERMINAL, TRANSPORT_DARAT, KERETA_BUS_LAIN, LAINNYA), `PelaksanaInput`.

## 1. Data dan penyimpanan
Migrasi SQL baru (node-pg-migrate, `1791126000001_berkas.sql`), tabel `berkas`, `ekstraksi`, dan `model_ai`. Semua `id` berupa `bigserial` dan acuannya `bigint`, sama seperti tabel Tahap 1 (bukan uuid).

`berkas`
| Kolom | Catatan |
|---|---|
| id | bigserial |
| st_id | bigint, acuan ke `surat_tugas` (hapus berantai); boleh kosong selama ST belum dibuat dari unggahan awal |
| nama_asli, mime, ukuran | metadata |
| sha256 | unik per `st_id` lewat indeks `(coalesce(st_id, 0), sha256)` (unggahan ulang berkas yang sama tidak membuat baris baru, termasuk dua berkas tanpa ST) |
| jenis | `belum` (bawaan, sebelum diklasifikasi), `st`, `hotel`, `tiket`, `transport`, `lainnya`; diisi hasil klasifikasi model |
| created_at | timestamptz |

Kolom `pelaksana_id` (pelaksana yang dicocokkan) belum ada di 2A; ditambahkan di 2C bersama pencocokan pelaksana.

`ekstraksi`
| Kolom | Catatan |
|---|---|
| id, berkas_id | bigserial, bigint (acuan ke `berkas`, hapus berantai) |
| status | `antre`, `berjalan`, `selesai`, `gagal` |
| model | nama model yang dipakai |
| hasil | jsonb, sudah lolos validasi zod |
| kode_galat | salah satu kode galat di bawah |
| galat | pesan galat untuk pengguna (bukan isi dokumen) |
| percobaan | jumlah percobaan worker |
| usulan_status | `menunggu`, `diterapkan`, `diabaikan` |
| created_at, mulai_at, selesai_at | timestamptz |

Kode galat (`KODE_GALAT_AI` di `packages/shared/src/berkas.ts`): `MODEL_PENSIUN`, `MODEL_TIDAK_TERSEDIA`, `MODEL_BELUM_DIATUR`, `HASIL_TIDAK_VALID`, `WAKTU_HABIS`, `BERKAS_TIDAK_TERBACA` (PDF rusak/terkunci, gagal dirender, atau isi berkas hilang dari penyimpanan), dan `GALAT_INTERNAL` (galat tak terduga; pesan asli tidak dikirim ke pengguna maupun log).

`model_ai` (pengaturan model, tabel terpisah satu baris, `id = 1`)
| Kolom | Catatan |
|---|---|
| llm_url | boleh kosong; bila kosong dipakai env `OLLAMA_URL` (bawaan `http://172.17.0.1:11434`) |
| model_teks | awal `gpt-oss:120b-cloud` |
| model_gambar | kosong sampai dipilih setelah uji model gambar |
| updated_at | timestamptz |

Penyimpanan berkas: antarmuka `BerkasStore` (`put`, `get`, `delete`) dengan implementasi sistem berkas pada Docker volume `spjan-berkas` (`/data/berkas/<2 hex pertama sha256>/<sha256>`). Ganti ke S3/MinIO nanti hanya menambah implementasi.

Batas unggah: jpg/png/webp/pdf; maksimal 10 MB per berkas dan 30 berkas per ST. Jenis diperiksa dari isi berkas (magic bytes), bukan ekstensi. Nama asli tidak dipakai sebagai jalur berkas. Menghapus ST menghapus berkasnya.

API (semua di belakang sesi login):
- `POST /api/berkas?stId=` (multipart, satu berkas; `stId` opsional) mengembalikan `{ berkas, duplikat }` (201 baru, 200 ganda).
- `GET /api/berkas?stId=` daftar berkas beserta ekstraksi terbarunya.
- `GET /api/berkas/:id/isi` isi berkas (inline, sesuai mime).
- `DELETE /api/berkas/:id` hapus berkas.
- `POST /api/berkas/:id/ulang` jadwalkan ulang ekstraksi.
- `GET /api/model-ai`, `PUT /api/model-ai` baca/ubah pengaturan model; `POST /api/model-ai/uji` uji model teks atau gambar.

## 2. Alur ekstraksi
- Worker di proses API: mengambil pekerjaan `antre` dengan `FOR UPDATE SKIP LOCKED`, dua paralel, batas waktu 120 detik per pemanggilan model. Galat `WAKTU_HABIS` dan `MODEL_TIDAK_TERSEDIA` dicoba ulang satu kali (maksimal dua percobaan); galat lain langsung `gagal`. Saat worker mulai (API boot), pekerjaan `berjalan` dikembalikan ke `antre`.
- Cakupan 2A: worker hanya mengklasifikasi jenis berkas (`st`/`hotel`/`tiket`/`transport`/`lainnya`) dan menyimpan `jenis` serta ringkasan satu kalimat sebagai `hasil`. Ekstraktor per jenis ditambahkan di 2B-2D lewat tipe `Ekstraktor` (`apps/api/src/ekstraksi/worker.ts`); 2A memakai `ekstraktorKlasifikasi`.
- PDF: `pdftotext -layout` (paket poppler-utils ditambahkan ke image API). Bila teks hampir kosong (PDF hasil pindai), halaman dirender dengan `pdftoppm` ke PNG dan diperlakukan sebagai gambar.
- Pemanggilan model: `POST {url}/api/chat` Ollama dengan `format` berupa JSON Schema yang diturunkan dari skema zod, `temperature: 0`. Hasil divalidasi zod; bila tidak valid, sekali coba ulang dengan pesan galat validasi, lalu status `gagal` (`HASIL_TIDAK_VALID`).
- Pemilihan model: berkas yang diperlakukan sebagai gambar memakai model gambar, yang berupa teks (PDF berteks) memakai model teks; model yang belum diatur menghasilkan `MODEL_BELUM_DIATUR`.
- Rencana 2B-2D: ST memakai model teks. Bukti (hotel/tiket/transport) memakai model gambar dengan satu pemanggilan yang mengembalikan `jenis` beserta bidangnya (skema gabungan berdasarkan `jenis`).
- Konfigurasi di tabel `model_ai` (dapat diubah di UI): `llm_url` (bawaan dari env `OLLAMA_URL`, default `http://172.17.0.1:11434`), `model_teks` (awal `gpt-oss:120b-cloud`), `model_gambar` (kosong sampai diputuskan setelah uji, kandidat di atas). Tombol "Uji model" mengirim permintaan kecil dan melaporkan hasil atau galat. Kode HTTP 410 diterjemahkan menjadi pesan "model sudah dipensiunkan, ganti di Pengaturan".
- Klien model berupa antarmuka `KlienAi` sehingga dapat diganti klien palsu pada uji; `Ekstraktor` adalah fungsi per jenis dokumen yang menerima klien itu.
- Privasi: baris log worker hanya memuat id berkas, model, status, kode galat, dan durasi; tidak pernah teks galat, isi dokumen, atau nama. Layar menyatakan bahwa berkas dikirim ke ollama.com.

## 3. Hasil baca menjadi usulan
Pemetaan berupa fungsi murni di `packages/shared` (tanpa jaringan), menerima hasil ekstraksi dan keadaan ST saat ini, mengembalikan daftar usulan.

| Sumber | Usulan |
|---|---|
| ST | nomor, tanggal, kegiatan, pelaksana (nama, NIP, jabatan), etape (tujuan, tanggal berangkat/pulang). Pelaksana dicocokkan ke master pegawai lewat NIP, lalu nama; yang tidak ada diusulkan sebagai pegawai baru. Provinsi dipetakan ke kunci SBM (fungsi `norm()`); yang tidak cocok ditandai. Status pegawai tidak ada di ST dan tetap kosong. |
| Hotel | `hotelNama`, `hotelTarif` per malam pada etape yang tanggalnya beririsan; pelaksana dari nama tamu. `malamOverride` hanya diusulkan bila jumlah malam di invoice berbeda dari hitungan tanggal. |
| Tiket pesawat | `TIKET_PERGI` atau `TIKET_KEMBALI` dengan `tarif` dan `etapeIndex` dari tanggal. |
| Kereta/bus | `KERETA_BUS_LAIN` dengan keterangan rute. |
| Taksi, tol, bensin, dll. | `TAKSI_TERMINAL`, `TRANSPORT_DARAT`, atau `LAINNYA` dengan keterangan dari struk. |

Aturan penerapan:
- Setiap usulan menampilkan nilai usulan, nilai saat ini, dan sumber (berkas, halaman). Pengguna memilih Terapkan atau Abaikan per baris, atau "Terapkan semua yang aman".
- "Aman" berarti isian tujuan masih kosong dan tidak ada peringatan validasi. Bila nilai saat ini berbeda, baris disorot dan tidak pernah menimpa tanpa klik.
- Validasi otomatis yang menghasilkan peringatan: tanggal di luar rentang ST, total tidak sama dengan jumlah × tarif, nama tamu/penumpang tidak cocok dengan pelaksana mana pun, tarif nol atau negatif.
- Menerapkan usulan hanya menyunting data ST lewat API ST yang sudah ada; perhitungan tetap oleh `hitungSpj`.

## 4. Tampilan
- Halaman `Buat dari ST`: unggah PDF, tampil progres, halaman tinjau draf (daftar usulan ST), tombol "Buat draf ST", lalu masuk ke editor.
- Editor ST: panel `Bukti` (seret-lepas banyak berkas, status per berkas, pratinjau, tombol coba lagi, hapus) dan tab `Usulan`.
- Pengaturan: bagian `Model AI` (URL, model teks, model gambar, Uji model).
- Dokumen PDF SPJ tidak berubah. Melampirkan bukti ke PDF di luar cakupan.

## 5. Penanganan galat
- Ollama tidak terjangkau: berkas tetap tersimpan, status `gagal` dengan kode `MODEL_TIDAK_TERSEDIA`, tombol "Coba lagi".
- Model pensiun (410): pesan jelas mengarah ke Pengaturan.
- Hasil tidak valid atau semua bidang kosong: status `gagal`; pengguna dapat mengisi manual.
- Berkas ganda: diabaikan dengan pemberitahuan. Berkas rusak atau jenis tidak didukung: ditolak saat unggah dengan pesan.
- Semua rute baru berada di belakang sesi login dan pemeriksaan Origin yang sama dengan rute lain.

## 6. Pengujian
- Unit (`packages/shared`): pemetaan usulan dan validasi dengan data sintetis.
- API (vitest, Postgres nyata `spjan_test`): unggah, dedupe, batas ukuran, jenis salah, antrean dan pemulihan pekerjaan macet, ekstraksi dengan `KlienAi` palsu (usulan menyusul di 2B-2D), galat 410 dan tak terjangkau, hapus ST menghapus berkas.
- Frontend: tanpa uji otomatis (konvensi proyek); verifikasi visual dengan playwright seperti Tahap 1.
- Uji model nyata terhadap ST.226 dan invoice contoh lewat skrip manual `apps/api/scripts/probe-llm.ts`, tidak dijalankan di CI. Dokumen asli (NIP, nama) tidak masuk repo.

## 7. Tahapan pembangunan (tiap tahap dapat dipakai sendiri)
1. **2A Fondasi**: migrasi `berkas`/`ekstraksi`, `BerkasStore`, rute unggah/daftar/hapus, worker, klien Ollama, Pengaturan Model AI + Uji model, poppler di image, volume di compose. Termasuk uji model gambar dan keputusan `model_gambar` (butuh persetujuan menambah stub model).
2. **2B ST menjadi draf**: skema ekstraksi ST, pemetaan, halaman `Buat dari ST`.
3. **2C Invoice hotel**: skema, pemetaan, panel Bukti + tab Usulan.
4. **2D Tiket dan bukti transport**.

## Di luar cakupan
Melampirkan bukti ke PDF SPJ, OCR lokal, unggah massal lintas ST dengan pengelompokan otomatis, ekstraksi dokumen dari email, penyimpanan MinIO (antarmuka disiapkan, implementasi belum).

## Risiko
- Model cloud berganti atau pensiun tanpa pemberitahuan: ditangani lewat model yang dapat diatur dan pesan galat jelas.
- Foto buram membuat angka salah baca: ditangani lewat usulan (bukan penulisan langsung), validasi total, dan sumber berkas yang selalu terlihat.
- Gangguan jaringan keluar atau kuota cloud: ekstraksi gagal, data manual tetap berfungsi.
- Volume berkas belum tercakup backup: dicatat di `docs/deploy.md` saat 2A.
