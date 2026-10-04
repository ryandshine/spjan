import { describe, expect, it } from "vitest";
import type { KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { ekstrakSt } from "./st.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };

const validStJson = JSON.stringify({
  nomor: "ST.226/PPS/2026",
  tanggal: "2026-09-08",
  kegiatan: "Koordinasi",
  pelaksana: [
    {
      nama: "Gunadi Firdaus",
      nip: "197803101997031001",
      jabatan: "Kasubdit",
      etape: [
        {
          tujuan: "Bali",
          tanggalBerangkat: "2026-09-10",
          tanggalKembali: "2026-09-11",
        },
      ],
    },
  ],
});

describe("ekstrakSt", () => {
  it("dokumen berteks memanggil model teks dan mengembalikan hasil valid", async () => {
    const klien = klienPalsu(() => validStJson);
    const { model, hasil } = await ekstrakSt(klien, konf, { teks: "SURAT TUGAS...", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil.nomor).toBe("ST.226/PPS/2026");
    expect(hasil.pelaksana).toHaveLength(1);
    expect(klien.panggilan[0]?.prompt).toContain("SURAT TUGAS...");
  });

  it("berhasil membaca JSON yang dibungkus blok kode markdown ```json", async () => {
    const klien = klienPalsu(() => `\`\`\`json\n${validStJson}\n\`\`\``);
    const { hasil } = await ekstrakSt(klien, konf, { teks: "SURAT TUGAS...", gambar: [] });
    expect(hasil.nomor).toBe("ST.226/PPS/2026");
  });

  it("melempar MODEL_BELUM_DIATUR bila model teks null", async () => {
    const klien = klienPalsu(() => validStJson);
    await expect(ekstrakSt(klien, { ...konf, modelTeks: null }, { teks: "ST", gambar: [] })).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
  });

  it("melempar BERKAS_TIDAK_TERBACA bila teks dokumen kosong", async () => {
    const klien = klienPalsu(() => validStJson);
    await expect(ekstrakSt(klien, konf, { teks: "   ", gambar: [] })).rejects.toMatchObject({
      kode: "BERKAS_TIDAK_TERBACA",
    });
  });

  it("coba ulang sekali jika respons pertama tidak valid", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? "invalid json" : validStJson));
    const { hasil } = await ekstrakSt(klien, konf, { teks: "ST...", gambar: [] });
    expect(hasil.nomor).toBe("ST.226/PPS/2026");
    expect(klien.panggilan).toHaveLength(2);
    expect(klien.panggilan[1]?.prompt).toContain("tidak valid");
  });

  it("melempar HASIL_TIDAK_VALID jika dua kali respons tidak valid", async () => {
    const klien = klienPalsu(() => '{"nomor": 123}');
    await expect(ekstrakSt(klien, konf, { teks: "ST...", gambar: [] })).rejects.toMatchObject({
      kode: "HASIL_TIDAK_VALID",
    });
    expect(klien.panggilan).toHaveLength(2);
  });
});
