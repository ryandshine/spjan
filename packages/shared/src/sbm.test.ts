import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { STATUS_KODE } from "./types.js";

describe("SBM_2026 (PMK 32/2025)", () => {
  it("memuat jumlah baris yang diharapkan", () => {
    expect(Object.keys(SBM_2026.uangHarian)).toHaveLength(38);
    expect(Object.keys(SBM_2026.penginapan)).toHaveLength(38);
    expect(Object.keys(SBM_2026.terminal)).toHaveLength(34);
    expect(Object.keys(SBM_2026.sewaKendaraan)).toHaveLength(38);
    expect(SBM_2026.tiketPp).toHaveLength(316);
    expect(SBM_2026.transportIbukota).toHaveLength(361);
    expect(SBM_2026.transportJakarta).toHaveLength(9);
    expect(SBM_2026.representasi).toHaveLength(3);
  });

  it("nilai acuan cocok dengan teks PMK", () => {
    expect(SBM_2026.uangHarian["D.I. YOGYAKARTA"]?.luarKota).toBe(420_000);
    expect(SBM_2026.uangHarian["BALI"]?.luarKota).toBe(480_000);
    expect(SBM_2026.uangHarian["SULAWESI UTARA"]?.luarKota).toBe(370_000);
    expect(SBM_2026.penginapan["D.I. YOGYAKARTA"]).toEqual([5_100_000, 2_695_000, 1_600_000, 845_000]);
    expect(SBM_2026.penginapan["BALI"]?.[3]).toBe(1_138_000);
    expect(SBM_2026.representasi.map((r) => r.luarKota)).toEqual([250_000, 200_000, 150_000]);
    expect(SBM_2026.terminal["BALI"]).toBe(219_000);
    expect(SBM_2026.terminal["D.K.I. JAKARTA"]).toBe(250_000);
    expect(SBM_2026.sewaKendaraan["BALI"]?.roda4).toBe(1_275_000);
    expect(SBM_2026.transportKegiatanPp).toBe(170_000);
    const gianyar = SBM_2026.transportIbukota.find((r) => r.kabKota === "Kab. Gianyar");
    expect(gianyar).toMatchObject({ provinsi: "BALI", ibukota: "Denpasar", besaran: 225_000 });
    const jktDps = SBM_2026.tiketPp.find((r) => r.asal === "JAKARTA" && r.tujuan === "DENPASAR");
    expect(jktDps).toMatchObject({ bisnis: 5_305_000, ekonomi: 3_262_000 });
  });

  it("konfigurasi status lengkap untuk semua status", () => {
    for (const kode of STATUS_KODE) {
      expect(SBM_2026.statusKonfigurasi[kode]).toBeDefined();
    }
    expect(SBM_2026.statusKonfigurasi.ESELON_II.barisRepresentasi).toBe(3);
    expect(SBM_2026.statusKonfigurasi.ESELON_IV_GOL_III_II_I.kolomHotel).toBe(4);
  });
});
