# Rencana Implementasi SPJAN Tahap 2D: Ekstraksi Tiket Pesawat & Bukti Transportasi

> **Target**: Pengguna dapat mengunggah berkas tiket penerbangan/kereta api dan bukti transportasi (taksi bandara, transportasi darat, sewa kendaraan, dsb) langsung pada panel bukti Editor Surat Tugas (`/st/:id`). Sistem AI vision (`gemma4:cloud`) / teks mengekstrak rincian tiket & transport (nama penumpang, rute, tanggal, nomor penerbangan/tiket, tarif), mencocokkannya dengan pelaksana & etape perjalanan ST, serta menyediakan panel usulan dengan tombol "Terapkan ke Biaya" yang otomatis menambahkan baris biaya ke pelaksana.

---

## Ringkasan Komponen

1. **Paket Shared (`packages/shared`)**:
   - `HasilEkstraksiTiketSchema`:
     - `maskapai`: string (Garuda, Batik, Citilink, KAI, dsb)
     - `kodeBooking`: string (PNR)
     - `nomorTiket`: string opsional
     - `penumpang`: string nama penumpang
     - `asal`: bandara / kota asal
     - `tujuan`: bandara / kota tujuan
     - `tanggal`: format YYYY-MM-DD
     - `jam`: string opsional (HH:mm)
     - `nomorPenerbangan`: string opsional (GA 204, dsb)
     - `tarif`: number (Rp)
     - `arah`: `"pergi"` | `"kembali"` | `"lainnya"`
   - `HasilEkstraksiTransportSchema`:
     - `jenisTransport`: `"taksi"` | `"darat"` | `"sewa_kendaraan"` | `"lainnya"`
     - `penyedia`: operator/perusahaan (Blue Bird, Grab, Damri, Rental, dsb)
     - `nomorKuitansi`: string opsional
     - `tanggal`: format YYYY-MM-DD
     - `uraian`: deskripsi perjalanan
     - `totalBiaya`: number (Rp)
   - Tipe `UsulanTransportItem`:
     - `berkasId`, `namaBerkas`, `kategori` (`"tiket"` | `"transport"`), `jenisBiaya` (`JenisBiaya`), `pelaksanaIndex`, `etapeIndex`, `penumpangNama`, `uraian`, `tanggal`, `tarifRiil`, `usulanStatus`, `peringatan`.
   - Fungsi murni `petakanTransportKeUsulan(daftarBerkas, suratTugas, sbm)`:
     - Mencocokkan nama penumpang ke pelaksana ST.
     - Mencocokkan tanggal dengan etape keberangkatan (-> `TIKET_PERGI`) atau kepulangan (-> `TIKET_KEMBALI`).
     - Memetakan struk taksi/transport ke `TAKSI_TERMINAL`, `TAKSI_KEDUDUKAN`, `TRANSPORT_DARAT`, atau `SEWA_RODA4`.

2. **API (`apps/api`)**:
   - Ekstraktor `ekstraksi/tiket.ts` & `ekstraksi/transport.ts` (vision untuk gambar/struk, teks untuk e-ticket PDF berteks).
   - Integrasi di `ekstraksi/worker.ts` untuk jenis `tiket` dan `transport`.
   - Endpoint `GET /api/surat-tugas/:id/usulan-transport`.

3. **Web Frontend (`apps/web`)**:
   - Komponen `UsulanTransportPanel`: menampilkan usulan tiket penerbangan dan bukti transport.
   - Tombol "Terapkan ke Biaya": menyisipkan objek `BiayaPayload` ke dalam array `pelaksana.biaya` pada form editor ST dan memperbarui `usulanStatus` berkas menjadi `diterapkan`.
   - Integrasi pada `apps/web/src/pages/st-editor.tsx`.

---

## Rincian Tugas

### Task 1: Skema Ekstraksi Tiket & Transport serta Pemetaan Usulan di Shared [SELESAI - Commit `ed6aa6f`]
**Files:**
- Create: `packages/shared/src/transport-ekstraksi.ts`
- Create: `packages/shared/src/transport-ekstraksi.test.ts`
- Modify: `packages/shared/src/index.ts`

### Task 2: Ekstraktor Tiket & Transport di API serta Integrasi Worker [SELESAI - Commit `355f17a`]
**Files:**
- Create: `apps/api/src/ekstraksi/tiket.ts`
- Create: `apps/api/src/ekstraksi/tiket.test.ts`
- Create: `apps/api/src/ekstraksi/transport.ts`
- Create: `apps/api/src/ekstraksi/transport.test.ts`
- Modify: `apps/api/src/ekstraksi/worker.ts`
- Modify: `apps/api/src/ekstraksi/worker.test.ts`

### Task 3: Endpoint Usulan Transport di API [SELESAI - Commit `790426b`]
**Files:**
- Modify: `apps/api/src/routes/surat-tugas.ts`
- Modify: `apps/api/src/surat-tugas.test.ts`

### Task 4: Antarmuka Web Panel Usulan Transport di Editor ST [SELESAI - Commit `0299f28`]
**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/queries.ts`
- Create: `apps/web/src/components/st/usulan-transport-panel.tsx`
- Modify: `apps/web/src/pages/st-editor.tsx`

### Task 5: Skrip Probe, Verifikasi Penuh, dan Dokumentasi [SELESAI]
**Files:**
- Create: `apps/api/scripts/probe-tiket.ts`
- Modify: `docs/superpowers/specs/2026-10-04-spjan-tahap2-ekstraksi-design.md`
- Modify: `docs/HANDOFF.md`

