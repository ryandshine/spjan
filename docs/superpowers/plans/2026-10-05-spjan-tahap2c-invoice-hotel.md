# Rencana Implementasi SPJAN Tahap 2C: Ekstraksi Invoice Hotel & Panel Bukti di Editor ST

> **Target**: Pengguna dapat mengunggah berkas bukti (foto/scan kuitansi & invoice hotel) langsung pada halaman Editor Surat Tugas (`/st/:id`). Sistem AI vision (`gemma4:cloud`) / teks mengekstrak rincian tagihan (nama hotel, tamu, tanggal inap, tarif per malam, total biaya), mencocokkannya dengan pelaksana & etape perjalanan, membandingkannya dengan plafon batas SBM hotel, dan menyediakan tombol "Terapkan" yang otomatis mengisi rincian biaya penginapan pada Surat Tugas.

---

## Ringkasan Perubahan

1. **Migrasi Database**:
   - `apps/api/migrations/1791126000002_berkas_pelaksana.sql`:
     - Tambahkan kolom `pelaksana_id bigint references pelaksana (id) on delete set null` pada tabel `berkas`.
     - Buat index `berkas_pelaksana_idx`.

2. **Paket Shared (`packages/shared`)**:
   - Skema Zod `HasilEkstraksiHotelSchema` (`namaHotel`, `nomorInvoice`, `tamu`, `checkIn`, `checkOut`, `jumlahMalam`, `tarifPerMalam`, `totalBiaya`).
   - Tipe `UsulanHotel` & `UsulanHotelHasil`.
   - Fungsi murni `petakanHotelKeUsulan(berkasList, suratTugas, sbm)`:
     - Mencocokkan nama tamu ke pelaksana ST.
     - Mencocokkan tanggal check-in/out dengan tanggal berangkat/kembali etape pelaksana.
     - Memeriksa batas plafon tarif penginapan SBM berdasarkan provinsi tujuan dan status jabatan pelaksana.
     - Menghasilkan usulan yang siap disematkan ke etape ST.

3. **API (`apps/api`)**:
   - Ekstraktor Hotel `ekstraksi/hotel.ts`:
     - Memanfaatkan model gambar vision (`gemma4:cloud`) bila berkas berupa gambar (atau PDF tanpa teks).
     - Memanfaatkan model teks (`gpt-oss:120b-cloud`) bila berkas berupa PDF dengan teks.
   - Integrasi Worker:
     - Worker memanggil ekstraktor hotel saat klasifikasi jenis berkas adalah `hotel`.
   - Rute API:
     - `GET /api/surat-tugas/:id/usulan-hotel`: Mengembalikan daftar usulan hotel yang telah diekstrak dan dipetakan.
     - `PATCH /api/berkas/:id/usulan-status`: Mengubah status usulan berkas (`diterapkan` / `diabaikan`) dan opsional menautkan `pelaksanaId`.

4. **Web Frontend (`apps/web`)**:
   - Komponen `BuktiPanel`: Area unggah multi-berkas (drag-and-drop), daftar berkas terkait ST, status ekstraksi real-time, tombol lihat dokumen asli, coba lagi, dan hapus.
   - Komponen `UsulanHotelPanel`: Kartu usulan hotel dengan komparasi plafon SBM, pemilih pelaksana/etape target, dan tombol aksi "Terapkan ke Biaya".
   - Integrasi di `apps/web/src/pages/st-editor.tsx`: Menempatkan panel Bukti dan Usulan Hotel di halaman editor ST.

---

## Rincian Tugas

### Task 1: Migrasi Database & Skema Berkas [SELESAI - Commit `7f1f586`]
**Files:**
- Create: `apps/api/migrations/1791126000002_berkas_pelaksana.sql`
- Modify: `packages/shared/src/berkas.ts`
- Modify: `apps/api/src/repositories/berkas.ts`

### Task 2: Skema Ekstraksi Hotel & Pemetaan Plafon SBM di Shared [SELESAI - Commit `64a5095`]
**Files:**
- Create: `packages/shared/src/hotel-ekstraksi.ts`
- Create: `packages/shared/src/hotel-ekstraksi.test.ts`
- Modify: `packages/shared/src/index.ts`

### Task 3: Ekstraktor Hotel di API (Vision & Teks) & Integrasi Worker [SELESAI - Commit `7c8292b`]
**Files:**
- Create: `apps/api/src/ekstraksi/hotel.ts`
- Create: `apps/api/src/ekstraksi/hotel.test.ts`
- Modify: `apps/api/src/ekstraksi/worker.ts`
- Modify: `apps/api/src/ekstraksi/worker.test.ts`

### Task 4: Endpoint Usulan Hotel & Update Status Usulan di API [SELESAI - Commit `b06d6f3`]
**Files:**
- Modify: `apps/api/src/routes/berkas.ts`
- Modify: `apps/api/src/routes/surat-tugas.ts`
- Modify: `apps/api/src/berkas.test.ts`
- Modify: `apps/api/src/surat-tugas.test.ts`

### Task 5: Antarmuka Web Panel Bukti & Usulan Hotel di Editor ST [SELESAI - Commit `fa30239`]
**Files:**
- Create: `apps/web/src/components/st/bukti-panel.tsx`
- Create: `apps/web/src/components/st/usulan-hotel-panel.tsx`
- Modify: `apps/web/src/pages/st-editor.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/queries.ts`

### Task 6: Verifikasi Penuh, Uji Invoice Nyata (The Royal Alana), dan Dokumentasi [SELESAI]
**Files:**
- Create: `apps/api/scripts/probe-hotel.ts`
- Modify: `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md`
- Modify: `docs/HANDOFF.md`

