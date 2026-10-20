import { describe, expect, it } from "vitest";

import {
  JARAK_NORMAL,
  JARAK_PADAT,
  JARAK_SANGAT_PADAT,
  JARAK_RINGKAS,
  KAPASITAS_HALAMAN,
  pilihJarak,
  taksirTinggi,
  type BahanHalaman,
} from "./tata-letak.js";

// Isi contoh ST_CILOTO: 2 butir Menimbang, 4 butir Dasar, 4 butir Untuk.
const sampel = (jumlahPelaksana: number, tembusan = ["Sekretaris Direktorat Jenderal Perhutanan Sosial;", "Yang Bersangkutan."]): BahanHalaman => ({
  menimbang: [
    "bahwa dalam rangka Koordinasi Pemantauan Persetujuan Pengelolaan Perhutanan Sosial dan Menghadiri Kegiatan Sekolah Lapang Perhutanan Sosial, diperlukan untuk menugaskan personil;",
    "bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas.",
  ],
  dasar: [
    "Keputusan Presiden Nomor 42 Tahun 2002 tentang Pedoman Pelaksanaan Anggaran Pendapatan Belanja Negara;",
    "Peraturan Menteri Kehutanan Nomor 1 Tahun 2024 tentang Organisasi dan Tata Kerja Kementerian Kehutanan;",
    "Surat Pengesahan DIPA Satker Kantor Pusat Direktorat Jenderal Perhutanan Sosial Tahun 2026 Nomor SP. DIPA-143.07.1.693712/2026 tanggal 23 Desember 2025;",
    "Nota Dinas Direktur Pengembangan Usaha Perhutanan Sosial Nomor: ND.221/PUPS/KUPS/SDM.01.07/B/08/2026 tanggal 11 Agustus 2026.",
  ],
  kepada: [
    "Umi Rusyanawati, S.E., MAP. / Analis SDM Aparatur Ahli Madya",
    "Dieta Arbaranny Koeswara, S.Hut., M.Si. / Kepala Sub Bagian Tata Usaha",
    "Agus Rahman / Operator Layanan Operasional",
  ].slice(0, jumlahPelaksana),
  untuk: [
    "Melaksanakan perjalanan dinas dalam rangka Koordinasi Pemantauan Persetujuan Pengelolaan Perhutanan Sosial dan Menghadiri Kegiatan Sekolah Lapang Perhutanan Sosial di Provinsi Jawa Barat;",
    "Yang bersangkutan melaksanakan perintah tugas selama 2 (dua) hari pada tanggal 14 s.d. 15 Agustus 2026;",
    "Selambat-lambatnya 5 (lima) hari setelah melaksanakan tugas, membuat laporan tertulis kepada Direktur PPS;",
    "Biaya dibebankan kepada Anggaran Kantor Pusat Direktorat Jenderal Perhutanan Sosial Tahun 2026.",
  ],
  tembusan,
});

const ringan: BahanHalaman = {
  menimbang: ["bahwa dalam rangka Rapat Koordinasi, diperlukan untuk menugaskan personil;", "bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas."],
  dasar: ["Dasar hukum satu;", "Dasar hukum dua."],
  kepada: ["Budi Santoso / Pengendali Ekosistem Hutan"],
  untuk: ["Melaksanakan perjalanan dinas dalam rangka Rapat Koordinasi di Bogor;", "Selama 1 (satu) hari;", "Laporan 5 (lima) hari;", "Biaya DIPA."],
  tembusan: ["Yang Bersangkutan."],
};

describe("pilihJarak (jarak halaman 1 mengecil agar tanda tangan dan tembusan tetap di halaman 1)", () => {
  it("jarak makin kecil dari normal sampai sangat padat", () => {
    const b = sampel(3);
    const tinggi = [JARAK_NORMAL, JARAK_RINGKAS, JARAK_PADAT, JARAK_SANGAT_PADAT].map((j) => taksirTinggi(b, j));
    expect(tinggi).toEqual([...tinggi].sort((a, c) => c - a));
    expect(new Set(tinggi).size).toBe(4);
  });

  it("isi ringan memakai jarak normal (satu baris antar blok)", () => {
    expect(pilihJarak(ringan)).toEqual(JARAK_NORMAL);
    expect(JARAK_NORMAL.antarBlok).toBe(258);
  });

  it("isi ST_CILOTO dengan 1 pelaksana: tanda tangan dan tembusan tetap muat di halaman 1", () => {
    expect(taksirTinggi(sampel(1), pilihJarak(sampel(1)))).toBeLessThanOrEqual(KAPASITAS_HALAMAN);
  });

  it("isi ST_CILOTO dengan 3 pelaksana: jarak dikecilkan tetapi jarak antar blok dipertahankan", () => {
    const j = pilihJarak(sampel(3));
    expect(j).not.toEqual(JARAK_NORMAL);
    expect(j.antarBlok).toBeGreaterThan(0);
    expect(taksirTinggi(sampel(3), j)).toBeLessThanOrEqual(KAPASITAS_HALAMAN);
  });

  it("tembusan lebih banyak menuntut jarak lebih rapat", () => {
    const banyak = sampel(3, ["Sekretaris Direktorat Jenderal Perhutanan Sosial;", "Direktur Jenderal Perhutanan Sosial dan Kemitraan Lingkungan;", "Kepala Biro Hukum;", "Yang Bersangkutan."]);
    expect(taksirTinggi(banyak, pilihJarak(banyak))).toBeLessThanOrEqual(KAPASITAS_HALAMAN);
    expect(taksirTinggi(banyak, pilihJarak(banyak))).toBeLessThan(taksirTinggi(banyak, JARAK_NORMAL));
  });

  it("isi ekstrem tetap memakai jarak terpadat (usaha terbaik, tanpa galat)", () => {
    const ekstrem = { ...sampel(3), dasar: Array.from({ length: 12 }, () => sampel(1).dasar[2]!) };
    expect(pilihJarak(ekstrem)).toEqual(JARAK_SANGAT_PADAT);
  });

  it("ruang tanda tangan tidak pernah di bawah dua baris", () => {
    for (const j of [JARAK_NORMAL, JARAK_RINGKAS, JARAK_PADAT, JARAK_SANGAT_PADAT]) expect(j.ruangTtd).toBeGreaterThanOrEqual(516);
  });
});
