import type { UjiModelHasil } from "@spjan/shared";

import sharp from "sharp";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "./klien.js";

/** PNG merah 64x64 untuk menguji jalur gambar (Qwen menolak sisi <= 10 px). */
let pngUji: Promise<string> | null = null;
export const gambarUji = () =>
  (pngUji ??= sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff0000" } })
    .png()
    .toBuffer()
    .then((b) => b.toString("base64")));

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
      ...(jenis === "gambar" ? { gambar: [await gambarUji()] } : {}),
      timeoutMs: 60_000,
    });
    return { ok: true, model, durasiMs: Date.now() - mulai, balasan: balasan.trim().slice(0, 200) };
  } catch (error) {
    const galat = error instanceof AiGalat ? error : new AiGalat("GALAT_INTERNAL", "Terjadi kesalahan saat menguji model.");
    return { ok: false, model, durasiMs: Date.now() - mulai, kode: galat.kode, pesan: galat.message };
  }
}
