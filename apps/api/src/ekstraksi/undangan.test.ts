import { describe, expect, it } from "vitest";

import { AiGalat, type KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { ekstrakUndangan } from "./undangan.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };
const validJson = JSON.stringify({
  maksudTugas: "Rapat Koordinasi",
  lokasiTugas: "Bandung",
  tanggalMulai: "2026-11-02",
  tanggalSelesai: "2026-11-04",
  nomorUndangan: "123/ABC/2026",
  tanggalUndangan: "2026-10-15",
  penyelenggara: "Dinas Kehutanan",
});

describe("ekstrakUndangan", () => {
  it("dokumen berteks memakai model teks dan menyertakan isi dokumen di prompt", async () => {
    const klien = klienPalsu(() => validJson);
    const { model, hasil } = await ekstrakUndangan(klien, konf, { teks: "UNDANGAN RAPAT...", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil.lokasiTugas).toBe("Bandung");
    expect(klien.panggilan[0]?.prompt).toContain("UNDANGAN RAPAT...");
    expect(klien.panggilan[0]?.gambar).toBeUndefined();
  });

  it("dokumen gambar memakai model gambar dan hanya halaman pertama", async () => {
    const klien = klienPalsu(() => validJson);
    const { model } = await ekstrakUndangan(klien, konf, { teks: "", gambar: ["AAA", "BBB"] });
    expect(model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual(["AAA"]);
  });

  it("membaca JSON dalam blok markdown", async () => {
    const klien = klienPalsu(() => `\`\`\`json\n${validJson}\n\`\`\``);
    const { hasil } = await ekstrakUndangan(klien, konf, { teks: "x".repeat(60), gambar: [] });
    expect(hasil.nomorUndangan).toBe("123/ABC/2026");
  });

  it("mencoba ulang sekali bila JSON pertama tidak valid", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? '{"maksudTugas": 5}' : validJson));
    const { hasil } = await ekstrakUndangan(klien, konf, { teks: "UNDANGAN", gambar: [] });
    expect(hasil.maksudTugas).toBe("Rapat Koordinasi");
    expect(klien.panggilan).toHaveLength(2);
    expect(klien.panggilan[1]?.prompt).toContain("tidak valid");
  });

  it("HASIL_TIDAK_VALID setelah dua jawaban buruk", async () => {
    const klien = klienPalsu(() => "bukan json");
    await expect(ekstrakUndangan(klien, konf, { teks: "UNDANGAN", gambar: [] })).rejects.toMatchObject({ kode: "HASIL_TIDAK_VALID" });
  });

  it("MODEL_BELUM_DIATUR bila model yang dibutuhkan null", async () => {
    const klien = klienPalsu(() => validJson);
    await expect(ekstrakUndangan(klien, { ...konf, modelTeks: null }, { teks: "UNDANGAN", gambar: [] })).rejects.toBeInstanceOf(AiGalat);
    await expect(ekstrakUndangan(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["A"] })).rejects.toMatchObject({ kode: "MODEL_BELUM_DIATUR" });
  });

  it("BERKAS_TIDAK_TERBACA bila tidak ada teks maupun gambar", async () => {
    const klien = klienPalsu(() => validJson);
    await expect(ekstrakUndangan(klien, konf, { teks: "  ", gambar: [] })).rejects.toMatchObject({ kode: "BERKAS_TIDAK_TERBACA" });
  });
});
