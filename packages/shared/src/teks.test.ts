import { describe, expect, it } from "vitest";
import {
  angkaKata,
  daftarHariIso,
  formatAngka,
  formatDaftarTanggal,
  formatRp,
  norm,
  parseTanggal,
  proper,
  rentangRincian,
  rentangSptb,
  selisihHari,
  tanggalIndonesia,
  terbilangRupiah,
} from "./teks.js";

const t = (iso: string) => {
  const r = parseTanggal(iso);
  if (!r) throw new Error(`tanggal tidak valid: ${iso}`);
  return r;
};

describe("terbilangRupiah", () => {
  it.each([
    [0, "Nol Rupiah"],
    [21, "Dua Puluh Satu Rupiah"],
    [100, "Seratus Rupiah"],
    [1000, "Seribu Rupiah"],
    [1_001_000, "Satu Juta Seribu Rupiah"],
    [15_000, "Lima Belas Ribu Rupiah"],
    [111_111_111, "Seratus Sebelas Juta Seratus Sebelas Ribu Seratus Sebelas Rupiah"],
    [2_020_000, "Dua Juta Dua Puluh Ribu Rupiah"],
    [4_715_000, "Empat Juta Tujuh Ratus Lima Belas Ribu Rupiah"],
    [6_965_979, "Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah"],
    [11_909_784, "Sebelas Juta Sembilan Ratus Sembilan Ribu Tujuh Ratus Delapan Puluh Empat Rupiah"],
    [12_345_678, "Dua Belas Juta Tiga Ratus Empat Puluh Lima Ribu Enam Ratus Tujuh Puluh Delapan Rupiah"],
  ])("%i -> %s", (n, expected) => {
    expect(terbilangRupiah(n)).toBe(expected);
  });

  it("menolak angka di luar jangkauan", () => {
    expect(() => angkaKata(-1)).toThrow(RangeError);
    expect(() => angkaKata(1_000_000_000_000)).toThrow(RangeError);
  });
});

describe("tanggal", () => {
  it("memvalidasi tanggal kalender", () => {
    expect(parseTanggal("2026-09-10")).toEqual({ y: 2026, m: 9, d: 10 });
    expect(parseTanggal("2026-02-30")).toBeNull();
    expect(parseTanggal("10/09/2026")).toBeNull();
    expect(parseTanggal("")).toBeNull();
    expect(parseTanggal(null)).toBeNull();
  });

  it("menghitung selisih hari termasuk lintas bulan", () => {
    expect(selisihHari(t("2026-09-10"), t("2026-09-13"))).toBe(3);
    expect(selisihHari(t("2026-09-30"), t("2026-10-02"))).toBe(2);
  });

  it("menulis tanggal Indonesia", () => {
    expect(tanggalIndonesia("2026-09-08")).toBe("8 September 2026");
    expect(tanggalIndonesia("bukan tanggal")).toBe("");
  });

  it("rentang Rincian: satu hari, satu bulan, lintas bulan, lintas tahun", () => {
    expect(rentangRincian(t("2026-09-10"), t("2026-09-10"))).toBe("10 September 2026");
    expect(rentangRincian(t("2026-09-10"), t("2026-09-13"))).toBe("10-13 September 2026");
    expect(rentangRincian(t("2026-09-30"), t("2026-10-02"))).toBe("30 September - 2 Oktober 2026");
    expect(rentangRincian(t("2026-12-30"), t("2027-01-02"))).toBe("30 Desember 2026 - 2 Januari 2027");
  });

  it("rentang SPTB: satu hari, satu bulan, lintas bulan, lintas tahun", () => {
    expect(rentangSptb(t("2026-09-10"), t("2026-09-10"))).toBe("10 September 2026");
    expect(rentangSptb(t("2026-09-10"), t("2026-09-13"))).toBe("10 s.d. 13 September 2026");
    expect(rentangSptb(t("2026-09-30"), t("2026-10-02"))).toBe("30 September s.d. 2 Oktober 2026");
    expect(rentangSptb(t("2026-12-30"), t("2027-01-02"))).toBe("30 Desember 2026 s.d. 2 Januari 2027");
  });

  it("daftarHariIso menghasilkan tanggal harian inklusif", () => {
    expect(daftarHariIso(t("2026-09-10"), t("2026-09-13"))).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("formatDaftarTanggal memformat daftar tanggal dengan benar", () => {
    expect(formatDaftarTanggal([])).toBe("");
    expect(formatDaftarTanggal(["2026-09-11"])).toBe("11 September 2026");
    expect(formatDaftarTanggal(["2026-09-11", "2026-09-12"])).toBe("11 s.d. 12 September 2026");
    expect(formatDaftarTanggal(["2026-09-10", "2026-09-13"])).toBe("10 dan 13 September 2026");
    expect(formatDaftarTanggal(["2026-09-10", "2026-09-11", "2026-09-14"])).toBe("10 s.d. 11 dan 14 September 2026");
    expect(formatDaftarTanggal(["2026-09-30", "2026-10-02"])).toBe("30 September 2026 dan 2 Oktober 2026");
  });
});

describe("teks umum", () => {
  it("norm dan proper", () => {
    expect(norm("  d.i.   yogyakarta ")).toBe("D.I. YOGYAKARTA");
    expect(proper("D.I. YOGYAKARTA")).toBe("D.I. Yogyakarta");
    expect(proper("NUSA TENGGARA BARAT")).toBe("Nusa Tenggara Barat");
  });

  it("format angka rupiah dengan titik", () => {
    expect(formatAngka(4_715_000)).toBe("4.715.000");
    expect(formatAngka(999)).toBe("999");
    expect(formatRp(225_000)).toBe("Rp225.000");
  });
});
