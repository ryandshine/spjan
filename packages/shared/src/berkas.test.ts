import { describe, expect, it } from "vitest";

import { BATAS_BERKAS, HasilKlasifikasiSchema, JENIS_BERKAS, ModelAiPayloadSchema } from "./berkas.js";

describe("ModelAiPayloadSchema", () => {
  it("menerima nilai null (pakai bawaan) dan nilai terisi", () => {
    expect(ModelAiPayloadSchema.parse({ llmUrl: null, modelTeks: null, modelGambar: null })).toEqual({
      llmUrl: null,
      modelTeks: null,
      modelGambar: null,
    });
    expect(
      ModelAiPayloadSchema.parse({ llmUrl: "http://172.17.0.1:11434", modelTeks: " gpt-oss:120b-cloud ", modelGambar: "kimi-k3:cloud" }),
    ).toEqual({ llmUrl: "http://172.17.0.1:11434", modelTeks: "gpt-oss:120b-cloud", modelGambar: "kimi-k3:cloud" });
  });

  it("menolak URL tidak valid dan nama model kosong", () => {
    expect(ModelAiPayloadSchema.safeParse({ llmUrl: "bukan url", modelTeks: null, modelGambar: null }).success).toBe(false);
    expect(ModelAiPayloadSchema.safeParse({ llmUrl: null, modelTeks: "   ", modelGambar: null }).success).toBe(false);
  });
});

describe("HasilKlasifikasiSchema", () => {
  it("hanya menerima jenis dokumen yang dikenal (bukan 'belum')", () => {
    expect(HasilKlasifikasiSchema.parse({ jenis: "hotel", ringkasan: "Invoice hotel" }).jenis).toBe("hotel");
    expect(HasilKlasifikasiSchema.safeParse({ jenis: "belum", ringkasan: "" }).success).toBe(false);
    expect(HasilKlasifikasiSchema.safeParse({ jenis: "pesawat", ringkasan: "" }).success).toBe(false);
  });
});

describe("konstanta", () => {
  it("batas berkas sesuai spec", () => {
    expect(BATAS_BERKAS).toEqual({ maksUkuranMb: 10, maksPerSt: 30 });
    expect(JENIS_BERKAS).toEqual(["belum", "st", "hotel", "tiket", "transport", "lainnya"]);
  });
});
