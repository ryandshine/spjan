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

describe("ekstrakTiket - beberapa halaman", () => {
  it("mengirim semua halaman gambar ke model", async () => {
    const klien = klienPalsu(() => validTiketJson);
    await ekstrakTiket(klien, konf, { teks: "", gambar: ["hal1", "hal2"] });
    expect(klien.panggilan[0]?.gambar).toEqual(["hal1", "hal2"]);
  });

  it("menangani model yang mengembalikan array tiket (mis. Whoosh pergi dan pulang)", async () => {
    const arrayTiketJson = JSON.stringify([
      {
        moda: "kereta",
        maskapai: "PT Kereta Cepat Indonesia China",
        kodeBooking: "GA14971281",
        penumpang: "Yesi Afriani",
        asal: "Tegalluar Summarecon",
        tujuan: "Halim",
        tanggal: "2026-10-26",
        jam: "06:35",
        nomorPenerbangan: "G1006",
        tarif: 350000,
        arah: "pergi",
      },
      {
        moda: "kereta",
        maskapai: "PT Kereta Cepat Indonesia China",
        kodeBooking: "GA41125131",
        penumpang: "Yesi Afriani",
        asal: "Halim",
        tujuan: "Tegalluar Summarecon",
        tanggal: "2026-10-28",
        jam: "14:00",
        nomorPenerbangan: "G1033",
        tarif: 350000,
        arah: "kembali",
        perluDicek: [{ kolom: "jam", alasan: "jam terpotong" }],
      },
      {
        moda: "lainnya",
        maskapai: "Grab",
        tarif: 108000,
      },
    ]);

    const klien = klienPalsu(() => arrayTiketJson);
    const { hasil } = await ekstrakTiket(klien, konf, { teks: "", gambar: ["hal1", "hal2", "hal3"] });

    expect(hasil.moda).toBe("kereta");
    expect(hasil.maskapai).toBe("PT Kereta Cepat Indonesia China");
    expect(hasil.penumpang).toBe("Yesi Afriani");
    expect(hasil.tarif).toBe(700000);
    expect(hasil.perluDicek).toEqual([{ kolom: "jam", alasan: "jam terpotong" }]);
    expect(hasil.segmen).toHaveLength(2);
    expect(hasil.segmen[0]?.arah).toBe("pergi");
    expect(hasil.segmen[0]?.tarif).toBe(350000);
    expect(hasil.segmen[1]?.arah).toBe("kembali");
    expect(hasil.segmen[1]?.tarif).toBe(350000);
  });
});
