# Rencana Implementasi SPJAN Tahap 2B: Surat Tugas Menjadi Draf SPJ

> **Target**: Pengguna mengunggah PDF Surat Tugas (ST), sistem mengekstrak metadata, personil pelaksana, dan rute/tanggal perjalanan secara otomatis, mencocokkannya ke master pegawai dan SBM, menampilkan pratinjau draf usulan, dan membuat draf Surat Tugas yang langsung siap diproses lebih lanjut.

Sesuai dengan `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md`, catatan review `docs/superpowers/plans/2026-10-04-spjan-tahap2b-catatan.md`, dan hasil probe model `gpt-oss:120b-cloud` terhadap `ST.226.pdf`.

---

## Ringkasan Perubahan

1. **Pengerasan Fondasi Worker & Berkas (Bahan Catatan 2B)**:
   - Worker (`ekstraksi/worker.ts`): pemulihan macet berkala (`10 menit`), penanganan `Promise.allSettled`, update status ekstraksi dan `berkas.jenis` atomik dalam transaksi, pemindahan `pulihkan()` ke dalam blok `try` saat boot.
   - Pembaca berkas (`ekstraksi/baca-berkas.ts`): penanganan ENOENT poppler menjadi `GALAT_INTERNAL`, batas render `-scale-to 2000`, deteksi kegagalan render PNG.
   - Penautan berkas: penanganan tabrakan indeks unik `(coalesce(st_id, 0), sha256)` saat penautan ST.
2. **Paket Shared (`packages/shared`)**:
   - Skema ekstraksi detail ST `HasilEkstraksiStSchema` dan tipe `HasilEkstraksiSt`.
   - Pemetaan murni `petakanStKeUsulan(ekstraksi, masterPegawai, daftarProvinsi, defaultSatker)`:
     - Pencocokan pelaksana (NIP atau nama normal).
     - Pemetaan provinsi tujuan etape ke SBM.
     - Peringatan validasi (tanggal tumpang tindih, provinsi tidak dikenal, dll.).
3. **API (`apps/api`)**:
   - Ekstraktor ST `ekstraktorSt(klien, konf, isi)` memakai model teks `gpt-oss:120b-cloud`.
   - Worker memanggil ekstraktor ST saat berkas bertipe `st`.
   - Endpoint `GET /api/berkas/:id/usulan-st`: mengembalikan usulan draf ST beserta status kecocokan master pegawai.
   - Endpoint `POST /api/surat-tugas/dari-berkas`: membuat Surat Tugas dan menautkan berkas sumber secara atomik.
4. **Web Frontend (`apps/web`)**:
   - Tombol "Buat dari ST" pada halaman daftar Surat Tugas.
   - Halaman `/surat-tugas/buat-dari-st`:
     - Area drag-drop unggah PDF ST dengan indikator progres & status worker AI.
     - Pratinjau draf usulan (Nomor ST, tanggal, kegiatan, pelaksana cocok/baru, etape & SBM).
     - Tombol "Buat Draf ST" yang menyimpan dan langsung membuka editor ST.

---

## Rincian Tugas

### Task 1: Pengerasan Worker, Pembaca PDF, dan Penyimpanan Berkas

**Files:**
- Modify: `apps/api/src/ekstraksi/worker.ts`
- Modify: `apps/api/src/ekstraksi/baca-berkas.ts`
- Modify: `apps/api/src/repositories/berkas.ts`
- Modify: `apps/api/src/ekstraksi/worker.test.ts`
- Modify: `apps/api/src/ekstraksi/baca-berkas.test.ts`

**Langkah:**
1. Di `apps/api/src/ekstraksi/worker.ts`:
   - Pindahkan `await pulihkan(pool)` ke dalam blok `try` pada IIFE `mulai()`.
   - Di `jalankanSekali()`, gunakan `Promise.allSettled(klaim.map(...))` agar satu kegagalan query/database tidak menggagalkan eksekusi pekerjaan lain dalam batch.
   - Di `selesaikanPekerjaan()`, lakukan update status ekstraksi selesai dan `berkas.jenis` di dalam satu transaksi PostgreSQL `BEGIN ... COMMIT`.
   - Tambahkan pemulihan berkala: panggil `pulihkan()` setiap 5 menit untuk mengembalikan baris yang berstatus `berjalan` dengan `mulai_at < now() - interval '10 min'`.
2. Di `apps/api/src/ekstraksi/baca-berkas.ts`:
   - Tangkap ENOENT dari pemanggilan binary `pdftotext`/`pdftoppm` dan lempar `AiGalat("GALAT_INTERNAL", "Utilitas sistem pembaca PDF tidak ditemukan.")`.
   - Tambahkan argumen `-scale-to 2000` pada render `pdftoppm` agar memori terkontrol.
   - Bila `pdftoppm` selesai tanpa error tapi direktori hasil render kosong (0 PNG), lempar `AiGalat("BERKAS_TIDAK_TERBACA", "PDF tidak dapat dirender menjadi gambar.")`.
3. Di `apps/api/src/repositories/berkas.ts`:
   - Tambahkan fungsi `tautkanBerkasKeSt(db, berkasId, stId)`: memperbarui `st_id` berkas, menangani potensi pelanggaran unique constraint `(coalesce(st_id, 0), sha256)` bila ST sudah memiliki berkas identik.
4. Jalankan `npm test -w api src/ekstraksi/` dan pastikan seluruh tes lulus.
5. Commit: `fix(api): pengerasan worker ekstraksi, pembaca pdf, dan penautan berkas`.

---

### Task 2: Skema Ekstraksi ST & Pemetaan Usulan ke Draf di Shared

**Files:**
- Modify: `packages/shared/src/berkas.ts`
- Create: `packages/shared/src/st-ekstraksi.ts`
- Create: `packages/shared/src/st-ekstraksi.test.ts`
- Modify: `packages/shared/src/index.ts`

**Langkah:**
1. Di `packages/shared/src/st-ekstraksi.ts`:
   - Definisikan `HasilEkstraksiStSchema`:
     - `nomor`: string (nomor surat tugas)
     - `tanggal`: string format YYYY-MM-DD
     - `kegiatan`: string maksud perjalanan
     - `pelaksana`: array of:
       - `nama`: string
       - `nip`: string nullable
       - `jabatan`: string nullable
       - `etape`: array of:
         - `tujuan`: string
         - `tanggalBerangkat`: string YYYY-MM-DD
         - `tanggalKembali`: string YYYY-MM-DD
   - Definisikan tipe `UsulanStHasil`:
     - `payload`: `SuratTugasPayload`
     - `pelaksanaStatus`: array of `{ nama: string; nip: string | null; pegawaiId: number | null; baru: boolean }`
     - `peringatan`: string[]
   - Implementasikan fungsi murni:
     ```ts
     export function petakanStKeUsulan(
       ekstraksi: HasilEkstraksiSt,
       masterPegawai: PegawaiDto[],
       daftarProvinsiSbm: string[],
       pengaturan: Pick<PengaturanPayload, "kodeAkunDefault">
     ): UsulanStHasil
     ```
     - Mencocokkan setiap pelaksana ke `masterPegawai` berdasarkan NIP (jika 18 digit) atau normalisasi nama (huruf kecil, tanpa gelar).
     - Mencocokkan tujuan etape ke `daftarProvinsiSbm` menggunakan `norm()` untuk provinsi; fallback jika tidak cocok dan mencatat peringatan.
     - Menyusun `PelaksanaPayload` dengan `etape` masing-masing pelaksana.
2. Tulis tes unit di `packages/shared/src/st-ekstraksi.test.ts`:
   - Pengujian pencocokan pelaksana dengan NIP dan tanpa NIP.
   - Pengujian pemetaan multi-tujuan (Bali, D.I. Yogyakarta).
   - Pengujian peringatan saat provinsi tidak dikenali.
3. Jalankan `npm test -w @spjan/shared` dan `npm run build -w @spjan/shared`.
4. Commit: `feat(shared): skema ekstraksi ST dan pemetaan usulan ke draf surat tugas`.

---

### Task 3: Ekstraktor ST di API & Integrasi Worker

**Files:**
- Create: `apps/api/src/ekstraksi/st.ts`
- Create: `apps/api/src/ekstraksi/st.test.ts`
- Modify: `apps/api/src/ekstraksi/worker.ts`
- Modify: `apps/api/src/ekstraksi/worker.test.ts`

**Langkah:**
1. Di `apps/api/src/ekstraksi/st.ts`:
   - Implementasikan `ekstrakSt(klien: KlienAi, konf: KonfigurasiAi, isi: IsiBerkas): Promise<HasilEkstraksiSt>`
   - Menggunakan prompt terarah yang meminta model teks mengekstrak struktur ST lengkap per pelaksana.
   - Menggunakan `uraikanJsonAi` dan validasi Zod dengan `HasilEkstraksiStSchema`.
   - Menggunakan mekanisme retry 1 kali jika hasil model tidak valid.
2. Di `apps/api/src/ekstraksi/worker.ts`:
   - Saat worker mengklasifikasikan berkas sebagai `st`, lanjutkan pemanggilan `ekstrakSt` dan simpan hasilnya pada kolom `ekstraksi.hasil`.
3. Tulis pengujian di `st.test.ts` dan perbarui `worker.test.ts` dengan mock klien AI.
4. Jalankan `npm test -w api` dan `npm run lint -w api`.
5. Commit: `feat(api): ekstraktor detail surat tugas dan integrasi pada worker`.

---

### Task 4: Rute API Usulan ST & Buat ST dari Berkas

**Files:**
- Modify: `apps/api/src/routes/berkas.ts`
- Modify: `apps/api/src/routes/surat-tugas.ts`
- Modify: `apps/api/src/berkas.test.ts`
- Modify: `apps/api/src/surat-tugas.test.ts`

**Langkah:**
1. Di `apps/api/src/routes/berkas.ts`:
   - Tambahkan `GET /api/berkas/:id/usulan-st`:
     - Membaca baris `berkas` dan `ekstraksi` terbaru.
     - Memastikan berkas berjenis `st` dan status ekstraksi `selesai`.
     - Membaca master data `pegawai` aktif dan SBM tahun anggaran berjalan.
     - Menjalankan `petakanStKeUsulan(...)` dan mengembalikan JSON `{ usulan, berkas }`.
2. Di `apps/api/src/routes/surat-tugas.ts`:
   - Tambahkan dukungan penautan berkas saat membuat ST:
     - `POST /api/surat-tugas?berkasId=123`:
     - Dalam satu transaksi simpan ST, lalu panggil `tautkanBerkasKeSt(db, berkasId, st.id)`.
3. Tulis pengujian API di `berkas.test.ts` dan `surat-tugas.test.ts`.
4. Jalankan tes API: `npm test -w api`.
5. Commit: `feat(api): endpoint usulan draf ST dan pembuatan ST dengan penautan berkas`.

---

### Task 5: Antarmuka Web "Buat dari ST"

**Files:**
- Create: `apps/web/src/pages/buat-dari-st.tsx`
- Modify: `apps/web/src/pages/surat-tugas-list.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/queries.ts`

**Langkah:**
1. Di `apps/web/src/lib/api.ts` & `queries.ts`:
   - Tambahkan fungsi API `unggahBerkas(file)`: mengirim multipart `POST /api/berkas`.
   - Tambahkan query `useUsulanSt(berkasId)` dengan polling otomatis jika status masih `antre`/`berjalan`.
   - Tambahkan mutasi `useBuatStDariBerkas()`.
2. Di `apps/web/src/pages/buat-dari-st.tsx`:
   - Desain tata letak yang bersih dan ramah pengguna:
     - Dropzone file PDF Surat Tugas (maks 10 MB).
     - Indikator progres: Mengunggah -> Membaca Teks PDF -> Ekstraksi AI -> Menyusun Usulan.
     - Kartu Tinjau Draf:
       - Nomor Surat Tugas & Tanggal.
       - Maksud Kegiatan.
       - Tabel Pelaksana: Nama, NIP, Jabatan, status badge (Terdaftar di Master Pegawai / Pegawai Baru).
       - Tabel Etape & Jadwal: Tujuan, Provinsi SBM, Tanggal Berangkat & Kembali.
       - Peringatan jika ada (mis. provinsi belum dipetakan).
     - Aksi tombol:
       - "Buat Draf ST": memanggil API dan langsung navigasi ke `/surat-tugas/:id` untuk melengkapi rincian biaya / cetak.
       - "Batal / Unggah Ulang".
3. Di `apps/web/src/pages/surat-tugas-list.tsx`:
   - Tambahkan tombol "Buat dari ST" di samping tombol "Surat Tugas Baru".
4. Di `apps/web/src/App.tsx`:
   - Daftarkan rute `/surat-tugas/buat-dari-st`.
5. Jalankan `npm run lint` dan `npm run build` di root.
6. Commit: `feat(web): halaman buat Surat Tugas dari unggahan ST dengan pratinjau usulan`.

---

### Task 6: Verifikasi Penuh, Uji Manual Dokumen Asli, dan Dokumentasi

**Files:**
- Modify: `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md`
- Create: `apps/api/scripts/probe-st.ts`

**Langkah:**
1. Buat skrip verifikasi manual `apps/api/scripts/probe-st.ts` untuk menguji ekstraksi ST langsung terhadap berkas contoh `~/spj/2026/diy/ST.226.pdf`.
2. Jalankan seluruh test suite di root: `npm test && npm run lint && npm run build`.
3. Verifikasi build produksi Docker: pastikan seluruh target (`api`, `web`) tetap dapat di-build dengan bersih.
4. Perbarui dokumentasi spec dan catat perkembangan Tahap 2B.
5. Commit: `docs: selaraskan spec dan rencana verifikasi akhir Tahap 2B`.
