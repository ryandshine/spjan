import { describe, expect, it } from "vitest";
import type { KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { ekstrakHotel } from "./hotel.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };

const validHotelJson = JSON.stringify({
  namaHotel: "The Royal Alana Yogyakarta",
  nomorInvoice: "INV-2026-09-001",
  tamu: "Gunadi Firdaus",
  checkIn: "2026-09-12",
  checkOut: "2026-09-13",
  jumlahMalam: 1,
  tarifPerMalam: 850000,
  totalBiaya: 850000,
});

describe("ekstrakHotel", () => {
  it("berkas gambar memanggil model gambar vision dengan gambar base64", async () => {
    const klien = klienPalsu(() => validHotelJson);
    const gambarBase64 = "fake-base64-data";
    const { model, hasil } = await ekstrakHotel(klien, konf, { teks: "", gambar: [gambarBase64] });
    expect(model).toBe("m-gambar");
    expect(hasil.namaHotel).toBe("The Royal Alana Yogyakarta");
    expect(klien.panggilan[0]?.model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual([gambarBase64]);
  });

  it("dokumen berteks tanpa gambar memanggil model teks", async () => {
    const klien = klienPalsu(() => validHotelJson);
    const { model, hasil } = await ekstrakHotel(klien, konf, { teks: "FOLIO / INVOICE...", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil.namaHotel).toBe("The Royal Alana Yogyakarta");
    expect(klien.panggilan[0]?.prompt).toContain("FOLIO / INVOICE...");
  });

  it("berhasil membaca JSON yang dibungkus blok kode markdown ```json", async () => {
    const klien = klienPalsu(() => `\`\`\`json\n${validHotelJson}\n\`\`\``);
    const { hasil } = await ekstrakHotel(klien, konf, { teks: "INVOICE...", gambar: [] });
    expect(hasil.namaHotel).toBe("The Royal Alana Yogyakarta");
  });

  it("melempar MODEL_BELUM_DIATUR bila model gambar null untuk berkas gambar", async () => {
    const klien = klienPalsu(() => validHotelJson);
    await expect(
      ekstrakHotel(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["base64img"] }),
    ).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
  });

  it("melempar BERKAS_TIDAK_TERBACA bila teks dokumen kosong dan gambar kosong", async () => {
    const klien = klienPalsu(() => validHotelJson);
    await expect(ekstrakHotel(klien, konf, { teks: "   ", gambar: [] })).rejects.toMatchObject({
      kode: "BERKAS_TIDAK_TERBACA",
    });
  });

  it("coba ulang sekali jika respons pertama tidak valid", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? "invalid json" : validHotelJson));
    const { hasil } = await ekstrakHotel(klien, konf, { teks: "INVOICE...", gambar: [] });
    expect(hasil.namaHotel).toBe("The Royal Alana Yogyakarta");
    expect(klien.panggilan).toHaveLength(2);
    expect(klien.panggilan[1]?.prompt).toContain("tidak valid");
  });

  it("melempar HASIL_TIDAK_VALID jika dua kali respons tidak valid", async () => {
    const klien = klienPalsu(() => '{"namaHotel": 123}');
    await expect(ekstrakHotel(klien, konf, { teks: "INVOICE...", gambar: [] })).rejects.toMatchObject({
      kode: "HASIL_TIDAK_VALID",
    });
    expect(klien.panggilan).toHaveLength(2);
  });
});
