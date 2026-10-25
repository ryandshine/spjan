import { describe, expect, it } from "vitest";
import {
  buatNaskahStAwal,
  formatHariDenganTerbilang,
  formatRentangWaktuSt,
  hitungLamaHariSt,
  DASAR_HUKUM_BAWAAN_ST,
  AMBANG_LAMPIRAN_PELAKSANA,
  pakaiLampiranPelaksana,
} from "./naskah-st.js";
import {
  evaluasiTataLetakSt,
  perluLampiranSt,
  JARAK_PADAT,
  JARAK_SANGAT_PADAT,
} from "./tata-letak-st.js";

describe("naskah-st helper", () => {
  it("menghitung lama hari dengan benar", () => {
    expect(hitungLamaHariSt("2026-10-14", "2026-10-14")).toBe(1);
    expect(hitungLamaHariSt("2026-10-14", "2026-10-16")).toBe(3);
    expect(hitungLamaHariSt("2026-10-30", "2026-11-02")).toBe(4);
  });

  it("memformat hari dengan terbilang", () => {
    expect(formatHariDenganTerbilang(1)).toBe("1 (satu)");
    expect(formatHariDenganTerbilang(3)).toBe("3 (tiga)");
    expect(formatHariDenganTerbilang(14)).toBe("14 (empat belas)");
  });

  it("memformat rentang waktu penugasan", () => {
    expect(formatRentangWaktuSt("2026-10-14", "2026-10-14")).toBe("14 Oktober 2026");
    expect(formatRentangWaktuSt("2026-10-14", "2026-10-16")).toBe("14 s.d. 16 Oktober 2026");
    expect(formatRentangWaktuSt("2026-10-30", "2026-11-02")).toBe("30 Oktober s.d. 2 November 2026");
  });

  it("membuat data naskah ST awal dengan benar", () => {
    const data = buatNaskahStAwal({
      pjNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
      pjNip: "196810191998031001",
      pjJabatan: "Direktur Pengendalian Perhutanan Sosial,",
      tahunAnggaran: 2026,
    });
    expect(data.nomor).toBe("${nomor_naskah}");
    expect(data.modeNomor).toBe("srikandi");
    expect(data.penandatanganNama).toBe("Dr. Marcus Octavianus Susatyo, S.Hut., M.P.");
    expect(data.dasarHukum.length).toBe(DASAR_HUKUM_BAWAAN_ST.length);
    expect(data.pembebananAnggaran).toContain("2026");
  });
});

describe("daftar pelaksana sebagai lampiran", () => {
  it("ambangnya 3 pelaksana", () => {
    expect(AMBANG_LAMPIRAN_PELAKSANA).toBe(3);
  });

  it("lampiran hanya bila pelaksana lebih dari 3", () => {
    expect(pakaiLampiranPelaksana(0)).toBe(false);
    expect(pakaiLampiranPelaksana(1)).toBe(false);
    expect(pakaiLampiranPelaksana(3)).toBe(false);
    expect(pakaiLampiranPelaksana(4)).toBe(true);
    expect(pakaiLampiranPelaksana(10)).toBe(true);
  });
});

describe("evaluasi tata letak otomatis dan ruang QR 3x3 cm", () => {
  it("ruangTtd selalu minimal 750 dxa (menjamin gap >= 3,1 cm untuk QR 3x3 cm)", () => {
    // 3 cm = 1.701 dxa; 2 * 750 + 258 = 1.758 dxa > 1.701 dxa
    expect(JARAK_PADAT.ruangTtd).toBeGreaterThanOrEqual(750);
    expect(JARAK_SANGAT_PADAT.ruangTtd).toBeGreaterThanOrEqual(750);
    expect(2 * JARAK_SANGAT_PADAT.ruangTtd + 258).toBeGreaterThan(1701);
  });

  const buatPayload = (n: number, dasarTambahan: string[] = [], maksud = "Rapat Koordinasi"): any => ({
    nomor: "${nomor_naskah}",
    modeNomor: "srikandi",
    tanggal: null,
    tempatNaskah: "Jakarta",
    maksudTugas: maksud,
    lokasiTugas: "Kota Bogor",
    tanggalMulai: "2026-10-14",
    tanggalSelesai: "2026-10-15",
    lamaHari: 2,
    dasarHukum: ["Dasar hukum 1", ...dasarTambahan],
    dasarSpesifik: "",
    pelaporanHari: 5,
    pembebananAnggaran: "DIPA 2026",
    penandatanganJabatan: "Direktur,",
    penandatanganNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
    penandatanganNip: "196810191998031001",
    tembusan: ["Sekretaris Ditjen PS", "Yang Bersangkutan"],
    pelaksana: Array.from({ length: n }, (_, i) => ({
      nama: `Pelaksana Nomor${i + 1}`,
      nip: `19800101200501100${i + 1}`,
      jabatan: `Jabatan Nomor${i + 1}`,
    })),
  });

  it("1 atau 2 pelaksana dengan teks wajar tetap di halaman 1", () => {
    const res1 = evaluasiTataLetakSt(buatPayload(1));
    expect(res1.lampiran).toBe(false);

    const res2 = evaluasiTataLetakSt(buatPayload(2));
    expect(res2.lampiran).toBe(false);
  });

  it("3 pelaksana dengan teks ringan tetap di halaman 1", () => {
    const res = evaluasiTataLetakSt(buatPayload(3));
    expect(res.lampiran).toBe(false);
    expect(perluLampiranSt(buatPayload(3))).toBe(false);
  });

  it("4 pelaksana selalu masuk lampiran (alasan: jumlah_pelaksana)", () => {
    const res = evaluasiTataLetakSt(buatPayload(4));
    expect(res.lampiran).toBe(true);
    expect(res.alasanLampiran).toBe("jumlah_pelaksana");
  });

  it("3 pelaksana dengan teks panjang otomatis pindah ke lampiran (alasan: kapasitas_halaman)", () => {
    const dasarPanjang = [
      "Peraturan Menteri Kehutanan Nomor 1 Tahun 2024 tentang Organisasi dan Tata Kerja Kementerian Kehutanan;",
      "Peraturan Menteri Keuangan Nomor P.113/PMK.05/2012 tentang Perjalanan dinas dalam negeri bagi Pejabat Negara;",
      "Undangan Direktur Pengawasan Pengenaan Sanksi Administratif Nomor UN.127/PPSA/PKPSA/GKM.02.02/B/10/2026 tanggal 13 Oktober 2026;",
      "Surat Keputusan Menteri Lingkungan Hidup dan Kehutanan tentang Penetapan Peta Indikatif Pengelolaan Perhutanan Sosial;",
      "Rencana Strategis Direktorat Pengendalian Perhutanan Sosial Tahun Anggaran 2025-2029;",
      "Pedoman Pelaksanaan Anggaran dan Belanja Negara Direktorat Jenderal Perhutanan Sosial TA 2026.",
    ];
    const maksudPanjang =
      "Koordinasi Pemantauan dan Pengawasan Percepatan Pengelolaan Perhutanan Sosial serta Menghadiri Kegiatan Sekolah Lapang Usaha Perhutanan Sosial";

    const payload = buatPayload(3, dasarPanjang, maksudPanjang);
    const res = evaluasiTataLetakSt(payload);
    expect(res.lampiran).toBe(true);
    expect(res.alasanLampiran).toBe("kapasitas_halaman");
    expect(perluLampiranSt(payload)).toBe(true);
  });
});

