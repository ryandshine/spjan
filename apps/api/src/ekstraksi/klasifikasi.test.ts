import { describe, expect, it } from "vitest";

import type { KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { klasifikasiBerkas } from "./klasifikasi.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };
const valid = '{"jenis":"hotel","ringkasan":"Invoice The Royal Alana"}';

describe("klasifikasiBerkas", () => {
  it("dokumen berteks memakai model teks dan menyertakan isi teks pada prompt", async () => {
    const klien = klienPalsu(() => valid);
    const { model, hasil } = await klasifikasiBerkas(klien, konf, { teks: "INVOICE Royal Alana room charges", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil).toEqual({ jenis: "hotel", ringkasan: "Invoice The Royal Alana" });
    expect(klien.panggilan[0]?.prompt).toContain("INVOICE Royal Alana room charges");
    expect(klien.panggilan[0]?.gambar).toBeUndefined();
    expect(klien.panggilan[0]?.skema).toMatchObject({ type: "object", required: ["jenis", "ringkasan"] });
    expect(klien.panggilan[0]?.skema).not.toHaveProperty("$schema");
  });

  it("dokumen bergambar memakai model gambar dan mengirim gambarnya", async () => {
    const klien = klienPalsu(() => valid);
    const { model } = await klasifikasiBerkas(klien, konf, { teks: "", gambar: ["QUJD"] });
    expect(model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual(["QUJD"]);
  });

  it("model yang dibutuhkan belum diatur melempar MODEL_BELUM_DIATUR tanpa memanggil model", async () => {
    const klien = klienPalsu(() => valid);
    await expect(klasifikasiBerkas(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["QUJD"] })).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
    await expect(klasifikasiBerkas(klien, { ...konf, modelTeks: null }, { teks: "abc", gambar: [] })).rejects.toMatchObject({
      kode: "MODEL_BELUM_DIATUR",
    });
    expect(klien.panggilan).toHaveLength(0);
  });

  it("balasan tidak valid dicoba ulang sekali dengan pesan galat, lalu berhasil", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? "bukan json" : valid));
    const { hasil } = await klasifikasiBerkas(klien, konf, { teks: "abc", gambar: [] });
    expect(hasil.jenis).toBe("hotel");
    expect(klien.panggilan).toHaveLength(2);
    expect(klien.panggilan[1]?.prompt).toContain("tidak valid");
  });

  it("dua kali tidak valid (termasuk jenis di luar daftar) melempar HASIL_TIDAK_VALID", async () => {
    const klien = klienPalsu(() => '{"jenis":"pesawat","ringkasan":""}');
    await expect(klasifikasiBerkas(klien, konf, { teks: "abc", gambar: [] })).rejects.toMatchObject({ kode: "HASIL_TIDAK_VALID" });
    expect(klien.panggilan).toHaveLength(2);
  });
});
