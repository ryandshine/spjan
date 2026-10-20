import { describe, expect, it } from "vitest";

import { HasilEkstraksiUndanganSchema, terapkanUsulan, usulanDariUndangan, type HasilEkstraksiUndangan } from "./undangan-ekstraksi.js";

const HARI_INI = "2026-10-20";
const kosong = { maksudTugas: "", lokasiTugas: "", tanggalMulai: HARI_INI, tanggalSelesai: HARI_INI, dasarSpesifik: "" };
const hasil = (p: Partial<HasilEkstraksiUndangan> = {}): HasilEkstraksiUndangan => ({
  maksudTugas: null,
  lokasiTugas: null,
  tanggalMulai: null,
  tanggalSelesai: null,
  nomorUndangan: null,
  tanggalUndangan: null,
  penyelenggara: null,
  ...p,
});
const cari = (u: ReturnType<typeof usulanDariUndangan>, f: string) => u.find((x) => x.field === f);

describe("HasilEkstraksiUndanganSchema", () => {
  it("menerima semua field null dan menolak tanggal salah format", () => {
    expect(HasilEkstraksiUndanganSchema.parse(hasil())).toEqual(hasil());
    expect(() => HasilEkstraksiUndanganSchema.parse(hasil({ tanggalMulai: "20/10/2026" }))).toThrow();
  });
});

describe("usulanDariUndangan", () => {
  it("tanpa data tidak mengusulkan apa pun", () => {
    expect(usulanDariUndangan(kosong, hasil(), HARI_INI)).toEqual([]);
  });

  it("mengusulkan maksud, lokasi, tanggal, dan dasar spesifik", () => {
    const u = usulanDariUndangan(
      kosong,
      hasil({
        maksudTugas: "Rapat Koordinasi",
        lokasiTugas: "Bandung",
        tanggalMulai: "2026-11-02",
        tanggalSelesai: "2026-11-04",
        nomorUndangan: "123/ABC/2026",
        tanggalUndangan: "2026-10-15",
        penyelenggara: "Dinas Kehutanan Jawa Barat",
      }),
      HARI_INI,
    );
    expect(cari(u, "maksudTugas")).toMatchObject({ nilaiLama: "", nilaiBaru: "Rapat Koordinasi", bawaanAtauKosong: true });
    expect(cari(u, "tanggalMulai")).toMatchObject({ nilaiBaru: "2026-11-02", bawaanAtauKosong: true });
    expect(cari(u, "dasarSpesifik")?.nilaiBaru).toBe(
      "Undangan Dinas Kehutanan Jawa Barat Nomor 123/ABC/2026 tanggal 15 Oktober 2026",
    );
  });

  it("field yang sudah diisi pengguna ditandai bukan bawaan, nilai sama dibuang", () => {
    const naskah = { ...kosong, maksudTugas: "Sudah ada", lokasiTugas: "Bandung" };
    const u = usulanDariUndangan(naskah, hasil({ maksudTugas: "Baru", lokasiTugas: "Bandung" }), HARI_INI);
    expect(cari(u, "maksudTugas")).toMatchObject({ nilaiLama: "Sudah ada", bawaanAtauKosong: false });
    expect(cari(u, "lokasiTugas")).toBeUndefined();
  });

  it("string kosong dari AI diperlakukan sebagai tidak ada", () => {
    expect(usulanDariUndangan(kosong, hasil({ maksudTugas: "   " }), HARI_INI)).toEqual([]);
  });

  it("hanya tanggal mulai: tanggal selesai ikut sama (satu hari)", () => {
    const u = usulanDariUndangan(kosong, hasil({ tanggalMulai: "2026-11-02" }), HARI_INI);
    expect(cari(u, "tanggalMulai")?.nilaiBaru).toBe("2026-11-02");
    expect(cari(u, "tanggalSelesai")?.nilaiBaru).toBe("2026-11-02");
  });

  it("tanggal selesai sebelum mulai: pasangan tanggal dibuang", () => {
    const u = usulanDariUndangan(kosong, hasil({ tanggalMulai: "2026-11-05", tanggalSelesai: "2026-11-02" }), HARI_INI);
    expect(cari(u, "tanggalMulai")).toBeUndefined();
    expect(cari(u, "tanggalSelesai")).toBeUndefined();
  });

  it("dasar spesifik dilewati bila nomor, tanggal, dan penyelenggara semuanya kosong", () => {
    const u = usulanDariUndangan(kosong, hasil({ maksudTugas: "X" }), HARI_INI);
    expect(cari(u, "dasarSpesifik")).toBeUndefined();
  });

  it("dasar spesifik hanya memuat bagian yang ada", () => {
    const u = usulanDariUndangan(kosong, hasil({ nomorUndangan: "9/X/2026" }), HARI_INI);
    expect(cari(u, "dasarSpesifik")?.nilaiBaru).toBe("Undangan Nomor 9/X/2026");
  });
});

describe("terapkanUsulan", () => {
  it("menulis field terpilih dan menghitung ulang lamaHari", () => {
    const u = usulanDariUndangan(kosong, hasil({ maksudTugas: "Rakor", tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-04" }), HARI_INI);
    expect(terapkanUsulan(kosong, u)).toEqual({
      maksudTugas: "Rakor",
      tanggalMulai: "2026-11-02",
      tanggalSelesai: "2026-11-04",
      lamaHari: 3,
    });
  });

  it("tanpa usulan terpilih menghasilkan patch kosong", () => {
    expect(terapkanUsulan(kosong, [])).toEqual({});
  });

  it("hanya satu tanggal terpilih: lamaHari memakai tanggal lain dari naskah", () => {
    const naskah = { ...kosong, tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-04" };
    const u = usulanDariUndangan(naskah, hasil({ tanggalMulai: "2026-11-03", tanggalSelesai: "2026-11-04" }), HARI_INI);
    const hanyaMulai = u.filter((x) => x.field === "tanggalMulai");
    expect(terapkanUsulan(naskah, hanyaMulai)).toEqual({ tanggalMulai: "2026-11-03", lamaHari: 2 });
  });
});
