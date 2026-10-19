import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { generateNaskahStDocx } from "./generator.js";

describe("generateNaskahStDocx", () => {
  it("menghasilkan docx yang valid dari payload naskah ST", async () => {
    const buffer = await generateNaskahStDocx({
      nomor: "ST.123/TEST/2026",
      modeNomor: "srikandi",
      tanggal: "2026-10-14",
      tempatNaskah: "Jakarta",
      maksudTugas: "Rapat Pembahasan Kelapa Sawit",
      lokasiTugas: "Kota Bogor",
      tanggalMulai: "2026-10-14",
      tanggalSelesai: "2026-10-16",
      lamaHari: 3,
      dasarHukum: ["Dasar hukum 1", "Dasar hukum 2"],
      dasarSpesifik: "Undangan No. 123",
      pelaporanHari: 5,
      pembebananAnggaran: "DIPA Kantor Pusat 2026",
      penandatanganJabatan: "Direktur,",
      penandatanganNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
      penandatanganNip: "196810191998031001",
      tembusan: ["Sekretaris Ditjen PS", "Yang Bersangkutan"],
      pelaksana: [
        { nama: "Budi Santoso", nip: "198001012005011001", jabatan: "Pengendali Ekosistem Hutan" },
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("text");
    expect(docXml).toBeDefined();
    expect(docXml).toContain("Rapat Pembahasan Kelapa Sawit");
    expect(docXml).toContain("Kota Bogor");
    expect(docXml).toContain("Budi Santoso");
    expect(docXml).toContain("Dr. Marcus Octavianus Susatyo, S.Hut., M.P.");
    expect(docXml).toContain("${nomor_naskah}");
  });

  it("menggunakan nomor manual bila mode manual dipilih", async () => {
    const buffer = await generateNaskahStDocx({
      nomor: "ST.789/PPS/2026",
      modeNomor: "manual",
      tanggal: "2026-10-14",
      tempatNaskah: "Jakarta",
      maksudTugas: "Konsultasi Teknis",
      lokasiTugas: "Bandung",
      tanggalMulai: "2026-10-14",
      tanggalSelesai: "2026-10-14",
      lamaHari: 1,
      dasarHukum: ["Dasar hukum 1"],
      dasarSpesifik: "",
      pelaporanHari: 5,
      pembebananAnggaran: "DIPA 2026",
      penandatanganJabatan: "Direktur,",
      penandatanganNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
      penandatanganNip: "196810191998031001",
      tembusan: ["Yang Bersangkutan"],
      pelaksana: [
        { nama: "Siti Rahma", nip: "198501012010012001", jabatan: "Analis Kebijakan" },
      ],
    });

    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("text");
    expect(docXml).toContain("ST.789/PPS/2026");
    expect(docXml).toContain("14 Oktober 2026");
  });

  it("mempertahankan layout, margin, dan font Bookman Old Style 11pt sesuai CONTOH SPT.docx", async () => {
    const fs = await import("node:fs/promises");
    const buffer = await generateNaskahStDocx({
      nomor: "${nomor_naskah}",
      modeNomor: "srikandi",
      tanggal: null,
      tempatNaskah: "Jakarta",
      maksudTugas:
        "Menghadiri Rapat Pembahasan Penanganan Tanaman Sawit dalam Proses Transformasi Kulin KK di Provinsi Lampung dan Sumatera Utara serta Sinkronisasi Data Persetujuan Pengelolaan Perhutanan Sosial",
      lokasiTugas: "Ruang Rapat CIFOR, Jl. Raya Cifor, Kota Bogor",
      tanggalMulai: "2026-10-14",
      tanggalSelesai: "2026-10-14",
      lamaHari: 1,
      dasarHukum: [
        "Keputusan Presiden Nomor 42 Tahun 2002 tentang Pedoman Pelaksanaan Anggaran dan Belanja Negara (APBN);",
        "Peraturan Menteri Kehutanan Nomor 1 Tahun 2024 tentang Organisasi dan Tata Kerja Kementerian Kehutanan;",
        "Peraturan Menteri Keuangan Nomor P.113/PMK.05/2012 tentang Perjalanan dinas dalam negeri bagi Pejabat Negara, Pegawai Negeri, dan Pegawai tidak tetap;",
        "Undangan Direktur Penyiapan Kawasan Perhutanan Sosial Nomor: UN.207/PKPS/PPPS/PSL.01.01/B/10/2026 tanggal 12 Oktober 2026.",
      ],
      dasarSpesifik: "",
      pelaporanHari: 5,
      pembebananAnggaran:
        "Anggaran DIPA Kantor Pusat Direktorat Jenderal Perhutanan Sosial Tahun Anggaran 2026.",
      penandatanganJabatan: "Direktur,",
      penandatanganNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
      penandatanganNip: "196810191998031001",
      tembusan: [
        "Sekretaris Direktorat Jenderal Perhutanan Sosial;",
        "Yang Bersangkutan.",
      ],
      pelaksana: [
        { nama: "Sukardi, S.Hut., M.Si.", nip: "197501012000031001", jabatan: "PEH Ahli Madya" },
        { nama: "Irwan Hermawan. S.Hut, M.Si.", nip: "198002022005011002", jabatan: "PEH Ahli Muda" },
      ],
    });

    await fs.writeFile("/tmp/generated_verified.docx", buffer);

    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("text");
    expect(docXml).toBeDefined();

    // 1. Margin A4 dan Line Pitch sesuai Standar Resmi Dokumen ST.265 / CONTOH SPT
    expect(docXml).toContain('w:w="11906" w:h="16838"');
    expect(docXml).toContain('w:top="567" w:right="1440" w:bottom="360" w:left="1440"');
    expect(docXml).toContain('w:linePitch="360"');

    // 2. Pemberi tugas (P9) tidak terdistorsi menjadi DIREKTUR,
    expect(docXml).toContain("DIREKTUR");
    expect(docXml).toContain("PENGENDALIAN PERHUTANAN SOSIAL");

    // 3. SRIKANDI placeholders & tanda tangan
    expect(docXml).toContain("${nomor_naskah}");
    expect(docXml).toContain("${tanggal_naskah}");
    expect(docXml).toContain("${ttd_pengirim}");

    // 4. Font Bookman Old Style pada isi naskah
    expect(docXml).toContain('w:ascii="Bookman Old Style"');
    expect(docXml).toContain('w:sz w:val="22"');

    // 5. Font Figtree pada Kop Surat
    expect(docXml).toContain('w:ascii="Figtree"');
  });
});
