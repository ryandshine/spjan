# Catatan untuk Tahap 2B (hasil review akhir 2A)

Dikumpulkan dari review per tugas dan review akhir cabang `tahap-2a`. Bukan rencana; bahan masukan saat menulis rencana 2B.

## Wajib dikerjakan sebelum UI unggah dipasang (2B)
- **Pemulihan pekerjaan macet**: `pulihkan()` hanya jalan saat boot. Jadwalkan ulang berkala `status='berjalan' AND mulai_at < now() - interval '10 min'`; pakai `Promise.allSettled` di `jalankanSekali` agar satu galat DB tidak melepas pekerjaan saudara. (`ekstraksi/worker.ts`)
- **Atomik**: update `ekstraksi` selesai + `berkas.jenis` dalam satu transaksi (penting bila hasil mulai menggerakkan usulan).
- **`pulihkan()` di luar try** pada IIFE `mulai()`: pindahkan ke dalam try agar tidak menjadi unhandled rejection saat DB gagal saat boot.
- **Pembaca PDF** (`ekstraksi/baca-berkas.ts`): petakan ENOENT poppler ke `GALAT_INTERNAL` (bukan "PDF rusak"); lempar `BERKAS_TIDAK_TERBACA` bila `pdftoppm` sukses tanpa PNG; batasi ukuran render (`-scale-to 2000`); perkecil gambar sebelum dikirim ke model.
- **Tes yang masih kurang**: `WAKTU_HABIS`, `ekstrak` terinjeksi (2B memakainya), berkas terhapus saat diproses, tes SKIP LOCKED yang tidak lolos tanpa SKIP LOCKED.
- **Wadah "tanpa ST" bersifat global**: `st_id IS NULL` satu ember untuk hitungan (maks 30), dedupe, dan daftar. Unggahan "Buat dari ST" yang belum terhubung akan menumpuk dan memicu 409 `BATAS_BERKAS`. Rencanakan pembersihan atau penautan. Memindahkan berkas ke ST (`UPDATE st_id`) dapat melanggar unique index `(coalesce(st_id,0), sha256)` (23505) bila ST itu sudah punya berkas sama.

## Kontrak klien unggah
- Kirim tepat satu bagian berkas dan **tanpa field lain** (`fields: 0`); `stId` lewat query string. Field tambahan menghasilkan `413 PERMINTAAN_SALAH` ("reach fields limit", Inggris).
- 413 berbeda menurut ukuran: 10-12 MB JSON dari API, di atas 12 MB HTML dari nginx. Klien harus menangani 413 non-JSON.
- Rate limit 300 permintaan/menit/IP: polling status paling cepat tiap 2 detik, dan hanya selama ada pekerjaan `antre`/`berjalan`.
- Periksa pratinjau PDF di peramban nyata: CSP helmet (`object-src 'none'`, `frame-ancestors 'self'`) berlaku di `/api/berkas/:id/isi`; bila PDF inline tidak tampil, longgarkan CSP hanya untuk rute itu.

## Pengerasan yang ditunda (risiko rendah, pengguna tunggal)
- `llmUrl` menerima skema apa pun (`z.url()`); batasi http/https dan tolak query/fragment. `POST /api/model-ai/uji` bisa menjangkau host internal apa pun lewat sesi admin dan memantulkan 200 karakter badan respons non-2xx.
- `FileBerkasStore.put`: nama sementara `pid.Date.now()` bisa bentrok (ENOENT/500) dan tidak dibersihkan bila gagal tulis; pakai `randomUUID()` + `rm` di catch.
- `tambahBerkas` tidak transaksional: batas 30 bisa terlewati 1-2, duplikat bersamaan menghasilkan 409 `DUPLIKAT` (bukan 200), file yatim bila insert gagal setelah `put`; balapan hapus-unggah isi identik dapat meninggalkan baris yang menunjuk file hilang (kunci advisory sha256 atau penyapu yatim).
- Penutupan server (`server.ts`): `henti()` menunggu pekerjaan berjalan (bisa 2x120 detik) sehingga `docker stop` (10 detik) mematikan paksa; tambahkan guard re-entrancy + try/catch dan tutup app/worker paralel, atau atur `stop_grace_period`.
- Log: `req.log.error(error)` di `app.ts` mencatat objek galat penuh pada 500 (detail pg dapat memuat `nama_asli`); pertimbangkan pembersihan.
- `/isi`: `filename*` tidak meloloskan `' ( ) *` (RFC 5987); `cache-control: private, max-age=3600` membuat berkas terhapus masih tampil dari cache; belum ada tes header nosniff/CSP.
- Kartu Model AI (web): pesan zod berbahasa Inggris, banner galat tidak dibersihkan di awal `ujiModel`, tombol uji tidak dinonaktifkan saat simpan, `hasilUji.jenis` tidak dipakai, dan tampilan belum pernah dilihat di peramban.
- Kecil: CHECK `sha256` tanpa panjang 64; `HasilKlasifikasiSchema` menduplikasi `JENIS_BERKAS` (turunkan dengan `.exclude(["belum"])`); `probe-llm.ts` mencetak path penuh dan `error.message`.

## Pemeriksaan produksi saat deploy
- Jalankan "Uji model" dari kontainer produksi: `172.17.0.1:11434` harus terjangkau dari jaringan default compose dan `dokploy-network`.
- Pastikan `/data/berkas` pada volume baru dimiliki `node` setelah deploy pertama.
- Di luar cabang ini: Ollama mendengarkan `0.0.0.0:11434`; pastikan firewall host tidak membukanya ke publik.
- Model gambar belum dipilih: uji kandidat (`kimi-k3`, `gemma4:31b`, `glm-5.3-flash`, dll.) pada foto invoice setelah stub model ditambahkan (butuh persetujuan pengguna).
