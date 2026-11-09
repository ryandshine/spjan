import { describe, expect, it } from "vitest";
import type { KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { ekstrakTransport } from "./transport.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };

const validTransportJson = JSON.stringify({
  kategori: "taksi",
  penyedia: "Blue Bird",
  nomorKuitansi: "BB-987123",
  tanggal: "2026-09-12",
  uraian: "Taksi Bandara YIA ke Hotel",
  totalBiaya: 175000,
});

describe("ekstrakTransport", () => {
  it("berkas foto struk taksi memanggil model gambar vision dengan gambar base64", async () => {
    const klien = klienPalsu(() => validTransportJson);
    const gambarBase64 = "fake-receipt-image";
    const { model, hasil } = await ekstrakTransport(klien, konf, { teks: "", gambar: [gambarBase64] });
    expect(model).toBe("m-gambar");
    expect(hasil.kategori).toBe("taksi");
    expect(hasil.penyedia).toBe("Blue Bird");
    expect(hasil.totalBiaya).toBe(175000);
    expect(klien.panggilan[0]?.model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual([gambarBase64]);
  });

  it("dokumen bukti transport berteks memanggil model teks", async () => {
    const klien = klienPalsu(() => validTransportJson);
    const { model, hasil } = await ekstrakTransport(klien, konf, { teks: "RECEIPT BLUE BIRD...", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil.penyedia).toBe("Blue Bird");
    expect(klien.panggilan[0]?.prompt).toContain("RECEIPT BLUE BIRD...");
  });

  it("melempar MODEL_BELUM_DIATUR bila model gambar null untuk berkas gambar", async () => {
    const klien = klienPalsu(() => validTransportJson);
    await expect(
      ekstrakTransport(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["img"] }),
    ).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
  });

  it("coba ulang jika respons pertama tidak valid", async () => {
    let dipanggil = 0;
    const klien = klienPalsu(() => {
      dipanggil += 1;
      return dipanggil === 1 ? "invalid json" : validTransportJson;
    });
    const { hasil } = await ekstrakTransport(klien, konf, { teks: "RECEIPT...", gambar: [] });
    expect(dipanggil).toBe(2);
    expect(hasil.totalBiaya).toBe(175000);
  });

  it("mengirim semua halaman gambar dan menggabungkan array struk transportasi", async () => {
    const arrayTransport = JSON.stringify([
      {
        kategori: "taksi",
        penyedia: "Grab",
        nomorKuitansi: "GRB-1",
        tanggal: "2026-10-26",
        uraian: "Grab Halim ke Manggala",
        totalBiaya: 108000,
      },
      {
        kategori: "taksi",
        penyedia: "Grab",
        nomorKuitansi: "GRB-2",
        tanggal: "2026-10-28",
        uraian: "Grab Manggala ke Halim",
        totalBiaya: 95000,
      },
    ]);

    const klien = klienPalsu(() => arrayTransport);
    const { hasil } = await ekstrakTransport(klien, konf, { teks: "", gambar: ["hal1", "hal2"] });

    expect(klien.panggilan[0]?.gambar).toEqual(["hal1", "hal2"]);
    expect(hasil.kategori).toBe("taksi");
    expect(hasil.totalBiaya).toBe(203000);
    expect(hasil.uraian).toContain("Grab Halim ke Manggala, Grab Manggala ke Halim");
  });
});
