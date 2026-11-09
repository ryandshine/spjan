import { z } from "zod";

/** JSON Schema untuk parameter `format` Ollama (tanpa kunci `$schema`). */
export function skemaJson(skema: z.ZodType): object {
  const hasil = { ...(z.toJSONSchema(skema) as Record<string, unknown>) };
  delete hasil.$schema;
  return hasil;
}

/** Ekstrak dan uraikan JSON dari balasan model AI, menangani kemungkinan blok kode markdown (```json ... ```) */
export function uraikanJsonAi(teks: string): unknown {
  const dipangkas = teks.trim();
  try {
    return JSON.parse(dipangkas);
  } catch {
    const match = dipangkas.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match?.[1]) {
      return JSON.parse(match[1].trim());
    }
    const awalObj = dipangkas.indexOf("{");
    const akhirObj = dipangkas.lastIndexOf("}");
    const awalArr = dipangkas.indexOf("[");
    const akhirArr = dipangkas.lastIndexOf("]");

    const adaObj = awalObj >= 0 && akhirObj > awalObj;
    const adaArr = awalArr >= 0 && akhirArr > awalArr;

    if (adaObj && (!adaArr || awalObj < awalArr)) {
      try {
        return JSON.parse(dipangkas.slice(awalObj, akhirObj + 1));
      } catch {}
    }
    if (adaArr) {
      try {
        return JSON.parse(dipangkas.slice(awalArr, akhirArr + 1));
      } catch {}
    }
    if (adaObj) {
      return JSON.parse(dipangkas.slice(awalObj, akhirObj + 1));
    }
    throw new Error("Format JSON tidak ditemukan dalam balasan model");
  }
}

