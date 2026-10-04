import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { catatanBiaya, paguBiaya, paguTiket } from "./pagu.js";

const KEDUDUKAN = "D.K.I. JAKARTA";

describe("paguBiaya", () => {
  it("mencari pagu transport darat berdasarkan provinsi dan kab/kota persis", () => {
    expect(paguBiaya(SBM_2026, { jenis: "TRANSPORT_DARAT", provinsi: "bali", uraian: "kab. gianyar", tarif: 1 }, KEDUDUKAN)).toEqual({
      adaPagu: true,
      nilai: 225_000,
    });
  });

  it("tujuan yang tidak ada: pagu ada tetapi nilai null", () => {
    expect(paguBiaya(SBM_2026, { jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian: "Kab. Tidak Ada", tarif: 1 }, KEDUDUKAN)).toEqual({
      adaPagu: true,
      nilai: null,
    });
  });

  it("Jakarta-sekitar, kegiatan PP, terminal, taksi kedudukan, dan sewa kendaraan", () => {
    const nilai = (b: Parameters<typeof paguBiaya>[1]) => paguBiaya(SBM_2026, b, KEDUDUKAN).nilai;
    expect(nilai({ jenis: "TRANSPORT_JAKARTA_SEKITAR", uraian: "Kota Bogor", tarif: 1 })).toBe(270_000);
    expect(nilai({ jenis: "TRANSPORT_KEGIATAN_PP", tarif: 1 })).toBe(170_000);
    expect(nilai({ jenis: "TAKSI_TERMINAL", provinsi: "BALI", tarif: 1 })).toBe(219_000);
    expect(nilai({ jenis: "TAKSI_KEDUDUKAN", tarif: 1 })).toBe(250_000);
    expect(nilai({ jenis: "SEWA_RODA4", provinsi: "BALI", tarif: 1 })).toBe(1_275_000);
    expect(nilai({ jenis: "SEWA_RODA6", provinsi: "D.I. YOGYAKARTA", tarif: 1 })).toBe(2_570_000);
    expect(nilai({ jenis: "SEWA_BUS_BESAR", provinsi: "D.I. YOGYAKARTA", tarif: 1 })).toBe(3_808_000);
  });

  it("jenis tanpa pagu", () => {
    for (const jenis of ["AIRPORT_TAX_BAGASI", "KERETA_BUS_LAIN", "LAINNYA", "TIKET_PERGI"] as const) {
      expect(paguBiaya(SBM_2026, { jenis, tarif: 1 }, KEDUDUKAN)).toEqual({ adaPagu: false, nilai: null });
    }
  });
});

describe("catatanBiaya", () => {
  it("tiket tidak diberi catatan di sini", () => {
    expect(catatanBiaya(SBM_2026, { jenis: "TIKET_KEMBALI", tarif: 1 }, KEDUDUKAN)).toBeUndefined();
  });

  it("dalam pagu, melebihi pagu, tidak ditemukan, dan tanpa pagu", () => {
    const c = (tarif: number, uraian = "Kab. Gianyar") =>
      catatanBiaya(SBM_2026, { jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian, tarif }, KEDUDUKAN);
    expect(c(225_000)).toBe("Tarif dalam pagu PMK Rp225.000.");
    expect(c(226_000)).toBe("Tarif Rp226.000 melebihi pagu PMK Rp225.000 per satuan (dapat dilampaui bila riil; lampirkan bukti).");
    expect(c(1, "Kab. X")).toBe("Tujuan/provinsi tidak ditemukan di tabel PMK (harga pasar/at cost).");
    expect(catatanBiaya(SBM_2026, { jenis: "KERETA_BUS_LAIN", tarif: 1 }, KEDUDUKAN)).toBe(
      "Tidak ada pagu di PMK: biaya riil, lampirkan bukti.",
    );
  });
});

describe("paguTiket", () => {
  it("rute Jakarta-Denpasar menurut kelas", () => {
    expect(paguTiket(SBM_2026, "Jakarta", "Denpasar", "Ekonomi")).toBe(3_262_000);
    expect(paguTiket(SBM_2026, "jakarta", "denpasar", "Bisnis")).toBe(5_305_000);
  });

  it("rute yang tidak ada mengembalikan null", () => {
    expect(paguTiket(SBM_2026, "Jakarta", "Tidak Ada", "Ekonomi")).toBeNull();
  });
});
