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
});
