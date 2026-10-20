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

    // 1. Margin A4 mengikuti ST.265 / CONTOH SPT (kiri 1,78 cm, kanan 2 cm, atas 1 cm, bawah 2,5 cm)
    expect(docXml).toContain('w:w="11906" w:h="16838"');
    expect(docXml).toContain('w:top="567" w:right="1134" w:bottom="1418" w:left="1009"');
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
  it("membangun badan surat dengan tabel label dan butir bernomor yang rapi", async () => {
    const buffer = await generateNaskahStDocx({
      nomor: "${nomor_naskah}",
      modeNomor: "srikandi",
      tanggal: null,
      tempatNaskah: "Jakarta",
      maksudTugas: "Rapat Koordinasi",
      lokasiTugas: "Bogor",
      tanggalMulai: "2026-10-14",
      tanggalSelesai: "2026-10-14",
      lamaHari: 1,
      dasarHukum: ["Dasar satu;", "Dasar dua."],
      dasarSpesifik: "Undangan tiga",
      pelaporanHari: 5,
      pembebananAnggaran: "DIPA 2026",
      penandatanganJabatan: "Direktur",
      penandatanganNama: "Nama Pejabat",
      penandatanganNip: "196810191998031001",
      tembusan: ["Satu.", "Dua"],
      pelaksana: [
        { nama: "Budi", nip: "1", jabatan: "/ Analis" },
        { nama: "Sari", nip: "2", jabatan: "" },
      ],
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = (await zip.file("word/document.xml")?.async("text")) ?? "";
    const teks = xml.replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "");

    // dua tabel label dengan lebar kolom tetap, tanpa label berpadding spasi
    expect(xml.match(/<w:tblLayout w:type="fixed"/g)).toHaveLength(2);
    for (const label of ["Menimbang", "Dasar", "Kepada", "Untuk"]) {
      expect(teks).toContain(label);
      expect(teks).not.toMatch(new RegExp(`${label} {2,}:`));
    }
    // butir memakai tab (bukan spasi) dan tanda baca dirapikan
    expect(teks).toContain("a.\tbahwa dalam rangka Rapat Koordinasi, diperlukan untuk menugaskan personil;");
    expect(teks).toContain("2.\tDasar dua;");
    expect(teks).toContain("3.\tUndangan tiga.");
    expect(teks).toContain("1.\tBudi / Analis");
    expect(teks).toContain("2.\tSari");
    expect(teks).toContain("1.\tSatu;");
    expect(teks).toContain("2.\tDua.");
    expect(teks).toContain("Direktur,");
    expect(teks).toContain("NIP. 196810191998031001");
    expect(teks).toContain("${tanggal_naskah}");
    expect(teks).toContain("${ttd_pengirim}");
    // geometri halaman dan kop mengikuti ST.265 / CONTOH SPT
    expect(xml).toMatch(/<w:pgMar [^>]*w:top="567"[^>]*w:right="1134"[^>]*w:bottom="1418"[^>]*w:left="1009"/);
    expect(xml).toContain('<a:ext cx="1009650" cy="1009650"/>'); // logo 2,80 cm
    // garis ganda simetris: 0,99 cm dari kiri dan kanan kertas (356235 + 6847840 + 356235 = lebar A4)
    expect(xml).toContain('<wp:posOffset>356235</wp:posOffset>');
    expect(xml).toContain('<a:ext cx="6847840" cy="57150"/>');
    expect(xml).not.toContain("7127875");
    expect(xml).toContain('w:ascii="Figtree"'); // kop (Permenhut 1/2025 Pasal 56)
    expect(xml).toContain('w:ascii="Bookman Old Style"');
    expect(teks).toContain("KEMENTERIAN KEHUTANAN");
    expect(teks).toContain("DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL");
    // tidak ada lagi paragraf kosong sebagai jarak
    expect(xml).not.toMatch(/<w:p>(?:<w:pPr>.*?<\/w:pPr>)?<\/w:p>/);
  });

  describe("daftar pelaksana sebagai lampiran (lebih dari 3 pelaksana)", () => {
    const pelaksana = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        nama: `Pelaksana Nomor${i + 1}`,
        nip: i === 3 ? "" : `19800101200501100${i + 1}`,
        jabatan: `Jabatan Nomor${i + 1}`,
      }));
    const buat = async (n: number, modeNomor: "srikandi" | "manual" = "srikandi") => {
      const buffer = await generateNaskahStDocx({
        nomor: modeNomor === "manual" ? "ST.55/PPS/2026" : "${nomor_naskah}",
        modeNomor,
        tanggal: modeNomor === "manual" ? "2026-10-14" : null,
        tempatNaskah: "Jakarta",
        maksudTugas: "Rapat Koordinasi",
        lokasiTugas: "Kota Bogor",
        tanggalMulai: "2026-10-14",
        tanggalSelesai: "2026-10-15",
        lamaHari: 2,
        dasarHukum: ["Dasar hukum 1"],
        dasarSpesifik: "",
        pelaporanHari: 5,
        pembebananAnggaran: "DIPA 2026",
        penandatanganJabatan: "Direktur,",
        penandatanganNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
        penandatanganNip: "196810191998031001",
        tembusan: ["Sekretaris Ditjen PS", "Yang Bersangkutan"],
        pelaksana: pelaksana(n),
      });
      const zip = await JSZip.loadAsync(buffer);
      return (await zip.file("word/document.xml")?.async("text")) ?? "";
    };
    const hitung = (xml: string, kecil: string) => xml.split(kecil).length - 1;

    it("3 pelaksana tetap di badan surat tanpa lampiran", async () => {
      const xml = await buat(3);
      expect(xml).not.toContain("DAFTAR TERLAMPIR");
      expect(xml).not.toContain("Lampiran Surat Tugas");
      expect(xml).toContain("Pelaksana Nomor3 / Jabatan Nomor3");
    });

    it("4 pelaksana: 'Kepada' berisi DAFTAR TERLAMPIR dan nama pindah ke lampiran", async () => {
      const xml = await buat(4);
      expect(xml).toContain("DAFTAR TERLAMPIR");
      expect(xml).toContain("Lampiran Surat Tugas");
      expect(xml).toContain("DAFTAR PELAKSANA TUGAS");
      expect(xml).not.toContain("Pelaksana Nomor1 / Jabatan Nomor1");
      for (let i = 1; i <= 4; i++) {
        expect(xml).toContain(`Pelaksana Nomor${i}`);
        expect(xml).toContain(`Jabatan Nomor${i}`);
      }
      expect(xml).toContain("NIP. 198001012005011001");
      expect(xml).toContain("NIP. -");
    });

    it("lampiran dimulai di halaman baru dengan nomor halaman otomatis dan baris judul tabel berulang", async () => {
      const xml = await buat(4);
      expect(xml).toMatch(/w:pageBreakBefore|w:br w:type="page"/);
      expect(xml).toContain("PAGE");
      expect(xml).toContain("<w:tblHeader/>");
      expect(xml).toContain("NAMA/NIP");
    });

    it("tanda tangan Direktur diulang di lampiran, tembusan hanya sekali", async () => {
      const xml = await buat(4);
      expect(hitung(xml, "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.")).toBe(2);
      expect(hitung(xml, "${ttd_pengirim}")).toBe(2);
      expect(hitung(xml, "Tembusan:")).toBe(1);
    });

    it("baris terakhir tabel ditahan bersama tanda tangan agar tanda tangan tidak terdampar sendirian", async () => {
      const xml = await buat(4);
      const paragrafDengan = (nama: string) =>
        new RegExp(`<w:p><w:pPr>(<w:keepNext/>)?(?:(?!</w:p>).)*${nama}`, "s").exec(xml);
      expect(paragrafDengan("Pelaksana Nomor4")?.[1]).toBe("<w:keepNext/>");
      expect(paragrafDengan("Pelaksana Nomor3")?.[1]).toBeUndefined();
    });

    it("tanggal lampiran mengikuti mode nomor (SRIKANDI memakai variabel, manual memakai tanggal)", async () => {
      expect(hitung(await buat(4, "srikandi"), "${tanggal_naskah}")).toBe(2);
      const manual = await buat(4, "manual");
      expect(hitung(manual, "14 Oktober 2026")).toBeGreaterThanOrEqual(2);
      expect(hitung(manual, "ST.55/PPS/2026")).toBe(2);
    });
  });
});
