# Isi Naskah Surat Tugas dari Surat Undangan

Tanggal: 2026-10-20. Status: menunggu tinjauan pengguna.

## Tujuan

Di editor "Buat Surat Tugas" (`/st-naskah`), pengguna dapat mengunggah surat undangan (PDF atau foto).
AI membaca dokumen itu dan mengusulkan isian naskah. Pengguna memeriksa usulan, lalu menerapkannya.

## Keputusan

- Titik masuk: editor naskah ST (`st-naskah-editor.tsx`), bukan halaman SPJ.
- Berkas diterima: PDF, PNG, JPG. Word (.docx) di luar cakupan.
- Berkas tidak disimpan: dibaca sekali lalu dibuang. Tanpa migrasi, tanpa izin berkas, tanpa tempat sampah.
- Pelaksana tidak diisi AI (tetap dipilih manual dari master Pegawai).
- Hasil AI tidak pernah menimpa isian diam-diam: selalu lewat panel usulan.

## Pendekatan

Endpoint sinkron `POST /api/naskah-st/ekstrak-undangan`. Memakai ulang `bacaIsi`, klien AI, dan pola `ekstrakSt`/`ekstrakTiket`.
Ditolak: lewat pipeline berkas + worker (menyimpan berkas, terlalu berat); ekstraksi di peramban (konfigurasi model hanya milik admin).

## Komponen

### `packages/shared`
- `HasilEkstraksiUndanganSchema` (zod), semua field nullable:
  `maksudTugas`, `lokasiTugas`, `tanggalMulai`, `tanggalSelesai` (YYYY-MM-DD), `nomorUndangan`, `tanggalUndangan` (YYYY-MM-DD), `penyelenggara`.
- Fungsi murni `usulanDariUndangan(naskah: NaskahStPayload, hasil): UsulanIsian[]`.
  `UsulanIsian = { field, label, nilaiLama, nilaiBaru, bawaanAtauKosong }`. Field yang diusulkan:
  `maksudTugas`, `lokasiTugas`, `tanggalMulai`, `tanggalSelesai` (+ `lamaHari` diturunkan via `hitungLamaHariSt`), `dasarSpesifik`
  (dirangkai "Undangan {penyelenggara} Nomor {nomor} tanggal {tanggal Indonesia}", bagian yang null dilewati).
  Aturan: field null tidak diusulkan; usulan sama dengan nilai sekarang dibuang; tanggalSelesai < tanggalMulai (atau salah satu tidak valid) membuat pasangan tanggal dibuang;
  `bawaanAtauKosong` = true bila nilai lama kosong atau sama dengan nilai bawaan `buatNaskahStAwal` (tanggal = hari ini).
- Diekspor dari `packages/shared/src/naskah-st.ts` / `schemas.ts`; `npm run build` di shared setelah ubah.

### `apps/api`
- `src/ekstraksi/undangan.ts`: `ekstrakUndangan(klien, konf, isi)`. Prompt bahasa Indonesia, skema JSON, retry sekali bila JSON tidak valid.
  Jalur teks (PDF berteks) memakai `modelTeks`; jalur gambar memakai `modelGambar` (halaman pertama saja, seperti `ekstrakTiket`).
  Galat: `MODEL_BELUM_DIATUR`, `BERKAS_TIDAK_TERBACA`, `HASIL_TIDAK_VALID` (kelas `AiGalat`).
- `src/routes/naskah-st.ts`: `POST /ekstrak-undangan`, didaftarkan sebelum rute `/:id`.
  - `@fastify/multipart` didaftarkan di plugin ini (di `berkasRoutes` ia terenkapsulasi), batas `BATAS_BERKAS.maksUkuranMb`, 1 berkas, tanpa field.
  - Validasi tipe memakai `deteksiMime` (magic bytes), bukan ekstensi. Bukan PDF/PNG/JPG → 400 `TIPE_BERKAS_TIDAK_DIDUKUNG`. Terlalu besar → 413 `BERKAS_TERLALU_BESAR`. Tanpa berkas → 400 `BERKAS_KOSONG`.
  - Konfigurasi AI dari `getPengaturan` seperti di `routes/berkas.ts` / worker. Galat AI dipetakan ke `HttpError` berpesan Indonesia (model belum diatur → arahkan ke Pengaturan > Model AI).
  - Hanya pengguna login (tidak menyentuh data ST tersimpan, jadi tanpa `wajibBolehLihatSt`). `catatAudit` aksi `st.ekstrak_undangan` (detail: mime, ukuran, model; tanpa isi berkas).
  - Balasan: `{ model, hasil }`. Penerapan usulan (`usulanDariUndangan`) dilakukan di web agar memakai state formulir terkini.

### `apps/web`
- Komponen baru `isi-dari-undangan.tsx` (dipasang di atas formulir editor): area seret-lepas (`lib/use-seret-lepas.ts`) + tombol pilih berkas, status memproses, pesan galat.
- Panel usulan: tiap `UsulanIsian` menampilkan nilai lama → baru dengan kotak centang (tercentang bila `bawaanAtauKosong`), tombol "Terapkan" dan "Batal".
  "Terapkan" menulis ke state editor (mengisi `lamaHari` otomatis). Setelah diterapkan atau dibatalkan panel hilang, sehingga data tidak tampil di dua tempat.
- Hook `useMutation` TanStack Query ke endpoint di atas; unggah `FormData`. Hanya token warna tema yang ada. Tanpa tes frontend (konvensi).

## Pengujian

- shared: skema dan `usulanDariUndangan` (field null, nilai sama, tanggal terbalik, bawaan vs terisi, rangkaian dasarSpesifik).
- api: `undangan.test.ts` dengan klien AI palsu (jalur teks, jalur gambar, retry, model belum diatur, teks kosong); tes rute (tanpa login 401, tipe salah, tanpa berkas, berhasil, galat AI, audit tercatat).
- web: `tsc`, `eslint`, `npm run build`. Semua `npm run lint/test/build` dari root harus hijau.

## Risiko

- Mutu hasil bergantung pada model AI yang diatur admin; undangan hasil pindai buram bisa meleset. Mitigasi: panel usulan + tanggal divalidasi.
- Hanya halaman pertama yang dibaca untuk gambar; undangan multi-halaman berupa PDF scan hanya memakai gambar sampai batas `MAKS_HALAMAN_GAMBAR` oleh `bacaIsi`, namun ekstraktor memakai halaman pertama (konsisten dengan tiket).

## Di luar cakupan

Menyimpan berkas undangan, mengusulkan pelaksana dari daftar peserta, dukungan .docx, pembuatan SPJ langsung dari undangan.
