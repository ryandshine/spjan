import { describe, expect, it } from "vitest";
import {
  buatNaskahStAwal,
  formatHariDenganTerbilang,
  formatRentangWaktuSt,
  hitungLamaHariSt,
  DASAR_HUKUM_BAWAAN_ST,
} from "./naskah-st.js";

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
