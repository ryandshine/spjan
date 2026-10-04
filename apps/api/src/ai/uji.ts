import type { UjiModelHasil } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "./klien.js";

/** PNG 1x1 sah untuk menguji jalur gambar. */
const PNG_UJI =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

export async function ujiModel(klien: KlienAi, konf: KonfigurasiAi, jenis: "teks" | "gambar"): Promise<UjiModelHasil> {
  const model = jenis === "teks" ? konf.modelTeks : konf.modelGambar;
  if (!model) {
    return {
      ok: false,
      model: null,
      durasiMs: 0,
      kode: "MODEL_BELUM_DIATUR",
      pesan: `Model ${jenis} belum diatur.`,
    };
  }
  const mulai = Date.now();
  try {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt: jenis === "teks" ? "Balas dengan satu kata saja: ok" : "Gambar kecil ini berwarna apa? Jawab satu kata.",
      ...(jenis === "gambar" ? { gambar: [PNG_UJI] } : {}),
      timeoutMs: 60_000,
    });
    return { ok: true, model, durasiMs: Date.now() - mulai, balasan: balasan.trim().slice(0, 200) };
  } catch (error) {
    const galat = error instanceof AiGalat ? error : new AiGalat("GALAT_INTERNAL", "Terjadi kesalahan saat menguji model.");
    return { ok: false, model, durasiMs: Date.now() - mulai, kode: galat.kode, pesan: galat.message };
  }
}
