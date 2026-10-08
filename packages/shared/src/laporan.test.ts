import { describe, expect, it } from "vitest";
import { buatLaporanAwal, LaporanIsiSchema, type LaporanIsi } from "./laporan.js";
import { susunLaporan } from "./laporan-susun.js";
import type { PengaturanPayload, SuratTugasDto } from "./schemas.js";
import { etapeKosong } from "./st-model.js";

const pengaturan = { kotaKedudukan: "Jakarta" } as PengaturanPayload;

function stUji(over: Partial<SuratTugasDto> = {}): SuratTugasDto {
  return {
    id: 1, versiSbmId: 1, createdAt: "", updatedAt: "",
    nomor: "ST.228/PPS/PEMPS/PSL.04.02/B/09/2026", tanggal: "2026-09-14", tanggalSpj: "2026-09-21",
    kodeAkun: "", catatan: "", tahunAnggaran: null, sumberDana: "RM", pjNama: null, pjNip: null, pjJabatan: null,
    pelaksana: [
      { pegawaiId: null, nama: "Gunadi Firdaus", nip: "1", jabatan: "", status: null, noSpd: null, tanggalSpd: null, biaya: [],
        etape: [{ ...etapeKosong(), provinsi: "SUMATERA SELATAN", kota: "Musi Banyuasin",
          kegiatan: "Pengawasan di Desa Muara Merang", berangkat: "2026-09-17", pulang: "2026-09-19" }] },
      { pegawaiId: null, nama: "Aisyah", nip: "2", jabatan: "", status: null, noSpd: null, tanggalSpd: null, biaya: [],
        etape: [{ ...etapeKosong(), provinsi: "SUMATERA SELATAN", kota: "Musi Banyuasin",
          kegiatan: "Pengawasan di Desa Muara Merang", berangkat: "2026-09-17", pulang: "2026-09-19" }] },
    ],
    ...over,
  };
}
const teksBlok = (m: ReturnType<typeof susunLaporan>, id: string) => {
  const isi = m.bagian.find((b) => b.id === id)!.isi;
  return isi.jenis === "blok" ? isi.blok : [];
};

describe("buatLaporanAwal", () => {
  it("lolos skema dan id unik", () => {
    const awal = buatLaporanAwal();
    expect(LaporanIsiSchema.safeParse(awal).success).toBe(true);
    expect(new Set(awal.bagian.map((b) => b.id)).size).toBe(awal.bagian.length);
    expect(awal.bagian[0]?.jenis).toBe("sampul");
  });
  it("skema menolak id ganda dan teks terlalu panjang", () => {
    const awal = buatLaporanAwal();
    const ganda = { ...awal, bagian: [...awal.bagian, awal.bagian[1]!] };
    expect(LaporanIsiSchema.safeParse(ganda).success).toBe(false);
    const panjang: LaporanIsi = { versi: 1, bagian: [{ id: "x", jenis: "teks", judul: "A", blok: [{ tipe: "paragraf", teks: "a".repeat(10_001) }] }] };
    expect(LaporanIsiSchema.safeParse(panjang).success).toBe(false);
  });
});

describe("susunLaporan", () => {
  it("menurunkan bagian otomatis dari data ST", () => {
    const m = susunLaporan(stUji(), pengaturan, buatLaporanAwal(), []);
    expect(m.sampul.judul).toBe("PERJALANAN DINAS DALAM RANGKA PENGAWASAN DI DESA MUARA MERANG");
    expect(m.sampul.nama).toEqual(["Gunadi Firdaus", "Aisyah"]);
    expect(m.sampul.tempatTanggal).toBe("JAKARTA, 21 SEPTEMBER 2026");
    expect(teksBlok(m, "dasar")).toEqual([
      { tipe: "paragraf", teks: "Surat Tugas Direktur Pengendalian Perhutanan Sosial nomor: ST.228/PPS/PEMPS/PSL.04.02/B/09/2026 tanggal 14 September 2026." },
    ]);
    expect(teksBlok(m, "maksud")).toEqual([
      { tipe: "paragraf", teks: "Melakukan perjalanan dinas dalam rangka Pengawasan di Desa Muara Merang." },
    ]);
    expect(teksBlok(m, "lama")).toEqual([
      { tipe: "paragraf", teks: "Perjalanan dinas selama 3 (tiga) hari, pada tanggal 17 s.d. 19 September 2026." },
    ]);
    expect(teksBlok(m, "tempat")).toEqual([
      { tipe: "paragraf", teks: "Perjalanan dinas dilaksanakan di tempat berikut:" },
      { tipe: "daftar", butir: ["Musi Banyuasin, Provinsi Sumatera Selatan"] },
    ]);
    const tw = m.bagian.find((b) => b.id === "tatawaktu")!;
    expect(tw.isi).toEqual({ jenis: "tatawaktu", baris: [{ no: 1, kegiatan: ["Pengawasan di Desa Muara Merang"], tanggal: "17-19 September 2026" }] });
    expect(tw.otomatis).toBe(true);
  });

  it("menomori bagian ber-judul saja; penutup tanpa judul tidak bernomor", () => {
    const m = susunLaporan(stUji(), pengaturan, buatLaporanAwal(), []);
    expect(m.bagian.map((b) => b.nomor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, null, 9]);
    expect(m.bagian.some((b) => b.jenis === "sampul")).toBe(false);
  });

  it("ganti menimpa bagian otomatis dan tidak lagi mengikuti ST", () => {
    const awal = buatLaporanAwal();
    const laporan: LaporanIsi = {
      ...awal,
      bagian: awal.bagian.map((b) => (b.id === "dasar" && b.jenis === "dasar" ? { ...b, ganti: [{ tipe: "paragraf" as const, teks: "Tulis sendiri" }] } : b)),
    };
    const m = susunLaporan(stUji({ nomor: "ST.BARU" }), pengaturan, laporan, []);
    expect(teksBlok(m, "dasar")).toEqual([{ tipe: "paragraf", teks: "Tulis sendiri" }]);
    expect(m.bagian.find((b) => b.id === "dasar")!.otomatis).toBe(false);
    expect(JSON.stringify(teksBlok(m, "maksud"))).toContain("Pengawasan");
  });

  it("instansi terikat ke nama sehingga aman bila urutan pelaksana berubah", () => {
    const awal = buatLaporanAwal();
    const laporan: LaporanIsi = {
      ...awal,
      bagian: awal.bagian.map((b) => (b.jenis === "petugas" ? { ...b, instansi: [{ kunci: "AISYAH", instansi: "Direktorat PPS" }] } : b)),
    };
    const st = stUji();
    const terbalik = stUji({ pelaksana: [...st.pelaksana].reverse() });
    for (const s of [st, terbalik]) {
      const p = susunLaporan(s, pengaturan, laporan, []).bagian.find((b) => b.jenis === "petugas")!.isi;
      expect(p.jenis === "petugas" && p.baris.find((r) => r.nama === "Aisyah")?.instansi).toBe("Direktorat PPS");
    }
  });

  it("tanpa etape: bagian turunan kosong dan judul sampul bawaan", () => {
    const st = stUji();
    const kosong = stUji({ pelaksana: st.pelaksana.map((p) => ({ ...p, etape: [] })) });
    const m = susunLaporan(kosong, pengaturan, buatLaporanAwal(), []);
    expect(m.sampul.judul).toBe("PERJALANAN DINAS");
    expect(teksBlok(m, "lama")).toEqual([]);
    expect(teksBlok(m, "maksud")).toEqual([]);
    expect(m.bagian.find((b) => b.id === "tatawaktu")!.isi).toEqual({ jenis: "tatawaktu", baris: [] });
  });

  it("dua etape berbeda: tempat dan tata waktu terurut menurut tanggal", () => {
    const st = stUji();
    const p0 = st.pelaksana[0]!;
    const dua = stUji({
      pelaksana: [{ ...p0, etape: [
        { ...etapeKosong(), provinsi: "JAMBI", kota: "Kota Jambi", kegiatan: "Koordinasi", berangkat: "2026-09-20", pulang: "2026-09-20" },
        ...p0.etape,
      ] }],
    });
    const m = susunLaporan(dua, pengaturan, buatLaporanAwal(), []);
    const tw = m.bagian.find((b) => b.id === "tatawaktu")!.isi;
    expect(tw.jenis === "tatawaktu" && tw.baris.map((r) => r.tanggal)).toEqual(["17-19 September 2026", "20 September 2026"]);
    expect(teksBlok(m, "lama")[0]).toEqual({ tipe: "paragraf", teks: "Perjalanan dinas selama 4 (empat) hari, pada tanggal 17 s.d. 20 September 2026." });
  });
});
