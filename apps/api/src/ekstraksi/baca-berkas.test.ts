import { describe, expect, it } from "vitest";

import { AiGalat } from "../ai/klien.js";
import { PNG_1X1, pdfSederhana } from "../test-support/helpers.js";
import { bacaIsi } from "./baca-berkas.js";

describe("bacaIsi", () => {
  it("gambar: diteruskan sebagai base64 tanpa teks", async () => {
    const isi = await bacaIsi("image/png", PNG_1X1);
    expect(isi.teks).toBe("");
    expect(isi.gambar).toEqual([PNG_1X1.toString("base64")]);
  });

  it("PDF berteks: teks terbaca, tanpa gambar", async () => {
    const teks = "SURAT TUGAS Nomor ST.226/PPS/PEMPS/PSL.04.02/B/09/2026 Direktur Pengendalian Perhutanan Sosial";
    const isi = await bacaIsi("application/pdf", pdfSederhana(teks));
    expect(isi.gambar).toEqual([]);
    expect(isi.teks).toContain("ST.226/PPS/PEMPS/PSL.04.02/B/09/2026");
  });

  it("PDF tanpa lapisan teks (pindaian): halaman dirender menjadi PNG", async () => {
    const isi = await bacaIsi("application/pdf", pdfSederhana(""));
    expect(isi.gambar).toHaveLength(1);
    const png = Buffer.from(isi.gambar[0] as string, "base64");
    expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  });

  it("teks dipotong maksimal 12.000 karakter", async () => {
    const panjang = `${"kata ".repeat(5000)}`.trim();
    const isi = await bacaIsi("application/pdf", pdfSederhana(panjang, 4));
    expect(isi.teks.length).toBeLessThanOrEqual(12_000);
    expect(isi.teks.length).toBeGreaterThan(1000);
  });

  it("PDF rusak menjadi BERKAS_TIDAK_TERBACA", async () => {
    const galat = await bacaIsi("application/pdf", Buffer.from("%PDF-1.4\nini bukan pdf yang sah sama sekali")).catch((e) => e);
    expect(galat).toBeInstanceOf(AiGalat);
    expect(galat).toMatchObject({ kode: "BERKAS_TIDAK_TERBACA" });
  });
});
