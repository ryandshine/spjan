import { describe, expect, it } from "vitest";
import type { KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { ekstrakTiket } from "./tiket.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };

const validTiketJson = JSON.stringify({
  maskapai: "Garuda Indonesia",
  kodeBooking: "ABCDEF",
  nomorTiket: "126-2134567890",
  penumpang: "GUNADI FIRDAUS MR",
  asal: "Jakarta (CGK)",
  tujuan: "Yogyakarta (YIA)",
  tanggal: "2026-09-12",
  jam: "08:30",
  nomorPenerbangan: "GA 204",
  tarif: 1450000,
  arah: "pergi",
});

describe("ekstrakTiket", () => {
  it("berkas gambar memanggil model gambar vision dengan gambar base64", async () => {
    const klien = klienPalsu(() => validTiketJson);
    const gambarBase64 = "fake-tiket-image";
    const { model, hasil } = await ekstrakTiket(klien, konf, { teks: "", gambar: [gambarBase64] });
    expect(model).toBe("m-gambar");
    expect(hasil.maskapai).toBe("Garuda Indonesia");
    expect(hasil.penumpang).toBe("GUNADI FIRDAUS MR");
    expect(klien.panggilan[0]?.model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual([gambarBase64]);
  });

  it("dokumen e-ticket PDF berteks memanggil model teks", async () => {
    const klien = klienPalsu(() => validTiketJson);
    const { model, hasil } = await ekstrakTiket(klien, konf, { teks: "ELECTRONIC TICKET RECEIPT...", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil.maskapai).toBe("Garuda Indonesia");
    expect(klien.panggilan[0]?.prompt).toContain("ELECTRONIC TICKET RECEIPT...");
  });

  it("berhasil membaca JSON yang dibungkus markdown", async () => {
    const klien = klienPalsu(() => `\`\`\`json\n${validTiketJson}\n\`\`\``);
    const { hasil } = await ekstrakTiket(klien, konf, { teks: "TICKET ITINERARY...", gambar: [] });
    expect(hasil.nomorPenerbangan).toBe("GA 204");
  });

  it("melempar MODEL_BELUM_DIATUR bila model null", async () => {
    const klien = klienPalsu(() => validTiketJson);
    await expect(
      ekstrakTiket(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["img"] }),
    ).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
  });

  it("melempar BERKAS_TIDAK_TERBACA bila dokumen kosong", async () => {
    const klien = klienPalsu(() => validTiketJson);
    await expect(ekstrakTiket(klien, konf, { teks: "", gambar: [] })).rejects.toMatchObject({
      kode: "BERKAS_TIDAK_TERBACA",
    });
  });

  it("coba ulang jika respons pertama tidak valid", async () => {
    let dipanggil = 0;
    const klien = klienPalsu(() => {
      dipanggil += 1;
      return dipanggil === 1 ? "{ bukan json" : validTiketJson;
    });
    const { hasil } = await ekstrakTiket(klien, konf, { teks: "TICKET...", gambar: [] });
    expect(dipanggil).toBe(2);
    expect(hasil.tarif).toBe(1450000);
  });
});
