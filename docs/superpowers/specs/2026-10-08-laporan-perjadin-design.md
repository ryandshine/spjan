# Laporan Perjalanan Dinas (rancangan)

Tanggal: 2026-10-08. Fitur baru di SPJAN: menyusun dan mencetak **Laporan Perjalanan Dinas** (PDF) per surat tugas,
mengikuti contoh `Laporan_Perjadin_Supervisi_Muara_Merang.docx`.

## 1. Tujuan dan batas

Tujuan: satu laporan per surat tugas. **Prinsip: apa yang sudah ada di data SPJ (ST, etape, pelaksana, pengaturan, foto)
terisi otomatis dan selalu mengikuti data itu; apa yang tidak ada di data SPJ diisi manual oleh pengguna** (narasi hasil,
simpulan, saran, instansi petugas). Keluaran PDF.

Di luar cakupan (sengaja, YAGNI): draf narasi dengan AI, keluaran DOCX, lebih dari satu template, format teks di dalam
paragraf (tebal/miring), riwayat versi, kontrol konkurensi antar tab (pengguna tunggal; simpan terakhir menang).

## 2. Isi laporan (hasil membaca contoh)

| Bagian di contoh | Jenis bagian | Sumber |
|---|---|---|
| Sampul: kop, judul kegiatan, "Oleh:" daftar nama, kota dan tanggal | `sampul` | Otomatis dari ST (kegiatan etape, pelaksana, pengaturan) |
| Dasar Penugasan | `dasar` | Otomatis dari nomor dan tanggal ST |
| Petugas yang Melaksanakan (No, Nama, Instansi) | `petugas` | Nama otomatis dari pelaksana ST; **Instansi manual** (tidak ada di data pegawai) |
| Maksud dan Tujuan | `maksud` | Otomatis dari kegiatan etape |
| Tempat yang Dikunjungi | `tempat` | Otomatis dari kota/provinsi etape |
| Lama Perjalanan Dinas | `lama` | Otomatis dari rentang tanggal etape |
| Tata Waktu Pelaksanaan (No, Kegiatan, Tanggal) | `tatawaktu` | Otomatis dari etape (kegiatan dan tanggal) |
| Hasil Kegiatan, Hasil Pengawasan (hak, kewajiban, larangan, kebakaran) | `teks` | **Manual** (bagian kosong dengan subjudul siap) |
| Kesimpulan dan Rekomendasi (Simpulan, Saran dan Tindak Lanjut) | `teks` | **Manual** |
| Penutup "Demikian laporan ini dibuat..." | `teks` | Teks awal tetap |
| Dokumentasi Kegiatan (foto + keterangan) | `dokumentasi` | Otomatis dari berkas berjenis `dokumentasi` |

Bagian otomatis dapat ditimpa: tombol **"Tulis sendiri"** menjadikannya teks bebas (berhenti mengikuti ST) dan
**"Kembali ke otomatis"** membuangnya. Tanpa penimpaan, isinya dihitung ulang dari data ST setiap laporan dibuka atau dicetak.

## 3. Model data

### 3.1 Isi laporan (`packages/shared`, zod + tipe)

```ts
LaporanIsi = { versi: 1; bagian: Bagian[] }          // maks 40 bagian

Bagian =
  | { id: string; jenis: 'sampul'; judul?: string | null; tanggal?: string | null }   // override judul dan tanggal ISO
  | { id: string; jenis: 'petugas'; judul: string; instansi: { kunci: string; instansi: string }[] }
  | { id: string; jenis: 'dokumentasi'; judul: string }
  | { id: string; jenis: 'dasar' | 'maksud' | 'tempat' | 'lama'; judul: string; ganti: Blok[] | null }
  | { id: string; jenis: 'tatawaktu'; judul: string; ganti: { kegiatan: string[]; tanggal: string }[] | null }
  | { id: string; jenis: 'teks'; judul: string; blok: Blok[] }   // judul '' = tanpa judul dan tanpa nomor

Blok =
  | { tipe: 'paragraf'; teks: string }
  | { tipe: 'subjudul'; teks: string }
  | { tipe: 'daftar'; butir: string[] }       // berbutir
  | { tipe: 'nomor'; butir: string[] }        // bernomor
```

- `ganti: null` = otomatis dari data ST; terisi = hasil "Tulis sendiri" (tidak lagi mengikuti ST).
- `id` string pendek acak dari klien (kunci React dan urutan); unik dalam satu laporan.
- `kunci` instansi = `norm(nama)` pelaksana (aturan `norm()` proyek), agar tidak bergeser bila urutan pelaksana berubah.
- Batas panjang: judul 300, teks per blok 10.000, 200 blok per bagian, 100 butir per daftar, 100 baris tata waktu.
- Bagian bernomor: hanya `teks` dan bagian khusus ber-`judul` tak kosong, bernomor 1, 2, 3 menurut urutan.

### 3.2 Fungsi murni (`packages/shared`, tanpa DB)

- `buatLaporanAwal(): LaporanIsi`: template "Pengawasan PS" tanpa data ST: semua bagian otomatis berstatus `ganti: null`.
  Subjudul awal bagian Hasil: Pelaksanaan Pengawasan, Hasil Pengawasan, Pemenuhan Hak, Pelaksanaan Kewajiban
  Pengelolaan, Kepatuhan terhadap Larangan, Perlindungan Hutan dan Pengendalian Kebakaran; masing-masing diikuti
  paragraf kosong. Saran dan Tindak Lanjut diawali satu butir `nomor` kosong.
- `susunLaporan(st, pengaturan, laporan, foto): ModelLaporan`: menghitung semua bagian otomatis dari data ST
  (teks dasar, maksud, tempat, lama, baris tata waktu, nama petugas, sampul), memakai `ganti` bila terisi, lalu menghitung
  nomor bagian. Dipakai editor (pratinjau), PDF, dan tes.
- Teks tanggal memakai helper yang sudah ada (`tanggalIndonesia`, rentang tanggal etape); tidak ada format baru.

### 3.3 Basis data (migrasi `1791126000012_laporan.sql`)

```sql
create table laporan (
  st_id bigint primary key references surat_tugas (id) on delete cascade,
  isi jsonb not null,
  updated_at timestamptz not null default now()
);
```

Satu baris per ST; hapus ST ikut menghapus laporan. Tanpa kolom turunan; semua isi di `isi`.

## 4. API (`apps/api`, di bawah `/api`)

- `GET /surat-tugas/:id/laporan` mengembalikan `{ isi: LaporanIsi | null, updatedAt: string | null }`; `null` bila belum pernah disimpan
  (klien lalu memakai `buatLaporanAwal()`). 404 bila ST tidak ada.
- `PUT /surat-tugas/:id/laporan` menerima `LaporanIsi` (validasi zod dari `@spjan/shared`), upsert, mengembalikan bentuk yang sama.
- Galat memakai bentuk seragam proyek. File baru: `routes/laporan.ts`, `repositories/laporan.ts`; didaftarkan seperti route lain.

## 5. Web (`apps/web`)

- Tab **Laporan** di editor ST (`st-editor.tsx`), di samping Bukti. Komponen: `components/laporan/` (editor bagian, editor blok).
- Editor: daftar bagian; tiap bagian bisa diberi judul, digeser naik/turun, dihapus, ditambah (menu "Tambah bagian": Teks,
  Tata waktu, Petugas, Dokumentasi). Dalam bagian `teks`: tambah blok paragraf/subjudul/daftar/nomor, geser, hapus. Tanpa pustaka seret-lepas.
  Bagian khusus punya editor sendiri: petugas (kolom Instansi per pelaksana), 
  sampul (override judul dan tanggal). Bagian otomatis (dasar, maksud, tempat, lama, tata waktu) menampilkan hasil hitungan
  berlabel "Otomatis dari data ST" dengan tombol "Tulis sendiri" / "Kembali ke otomatis". Dokumentasi menampilkan jumlah foto dan tautan ke kartu Foto Dokumentasi.
- Simpan otomatis: `PUT` tertunda 1,5 detik setelah perubahan terakhir; indikator "Menyimpan... / Tersimpan / Gagal menyimpan (coba lagi)".
  Peringatan bila keluar halaman dengan perubahan belum tersimpan.
- Hook TanStack Query: `useLaporan(stId)`, `useSimpanLaporan()`, di `lib/queries.ts`; metode di `lib/api.ts`.
- Halaman Dokumen (`/st/:id/dokumen`): tombol cetak/pratinjau **Laporan** terpisah dari paket SPJ (`semua` tidak berubah).

## 6. PDF (`apps/web/src/pdf/laporan.tsx`)

- `@react-pdf/renderer`, A4 potret, font Liberation Sans yang sama; impor relatif (bukan `@/`) agar skrip Node bisa menjalankannya.
- Sampul satu halaman (kop, logo dari `logo.ts`, "LAPORAN", judul kegiatan, "Oleh:" daftar nama, kota dan tanggal huruf besar),
  lalu isi mengalir. Judul bagian tidak boleh terpisah sendirian di dasar halaman; baris tabel tidak terpotong
  (aturan dari skill `react-pdf-layout`). Dokumentasi: foto dua kolom dengan keterangan di bawah tiap foto.
- Jenis cetak baru `laporan` di `spj-document.tsx`. Data memakai `susunLaporan`.
- Kop sampul konstanta: baris 1 "DIREKTORAT JENDERAL PERHUTANAN SOSIAL", baris 2 "DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL" (`pengaturan.namaSatker` tidak dipakai: isinya "Kantor Pusat Direktorat Jenderal...").

## 7. Pengujian

- `packages/shared` (vitest): skema menolak bentuk salah dan batas panjang; `buatLaporanAwal`; `susunLaporan` (satu etape, dua etape, tanpa etape, tanpa pelaksana;
  bagian otomatis mengikuti perubahan ST; `ganti` menimpa dan "kembali ke otomatis" memulihkan; penomoran bagian;
  kunci instansi tetap saat urutan pelaksana berubah).
- `apps/api` (vitest, Postgres sungguhan): GET kosong, PUT lalu GET, PUT menimpa, 404 ST tidak ada, 400 isi tidak valid, hapus ST menghapus laporan.
- Web: tanpa tes (konvensi); verifikasi dengan tsc, eslint, build, dan skrip `pdf:contoh` (data contoh di `scripts/sample-data.ts`
  ditambah satu laporan contoh meniru Muara Merang) lalu `pdftoppm` untuk melihat halamannya, dan cek di peramban.

## 8. Urutan pengerjaan

1. `shared`: tipe, skema, `buatLaporanAwal`, `susunLaporan` + tes; build `shared`.
2. `api`: migrasi, repositori, route + tes.
3. `web`: api client dan hook, editor tab Laporan.
4. `web`: PDF laporan, jenis cetak, tombol di halaman Dokumen, data contoh.
5. Verifikasi menyeluruh (lint, tes, build, PDF contoh, peramban). Commit/push/deploy hanya atas persetujuan per gerbang.

## 9. Risiko

- Tata letak PDF untuk narasi panjang dan tabel lintas halaman: dikurangi dengan pola `react-pdf-layout` dan pengecekan lewat PDF contoh panjang.
- Bagian yang sudah "Tulis sendiri" berhenti mengikuti ST: disengaja, ditandai jelas di editor agar tidak terlupa.
- Simpan terakhir menang bila dua tab terbuka: diterima untuk pengguna tunggal.
- `jsonb` bebas bentuk: dijaga skema zod di API dan versi (`versi: 1`) untuk migrasi isi di masa depan.
