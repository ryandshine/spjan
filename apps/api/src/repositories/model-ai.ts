import type { ModelAiPayload } from "@spjan/shared";

import type { KonfigurasiAi } from "../ai/klien.js";
import { config } from "../config.js";
import type { Db } from "../db.js";

interface Row {
  llm_url: string | null;
  model_teks: string | null;
  model_gambar: string | null;
}

const map = (r: Row): ModelAiPayload => ({ llmUrl: r.llm_url, modelTeks: r.model_teks, modelGambar: r.model_gambar });

export async function getModelAi(db: Db): Promise<ModelAiPayload> {
  const { rows } = await db.query<Row>("select llm_url, model_teks, model_gambar from model_ai where id = 1");
  const row = rows[0];
  if (!row) throw new Error("Baris model_ai tidak ada (migrasi belum dijalankan?)");
  return map(row);
}

export async function saveModelAi(db: Db, p: ModelAiPayload): Promise<ModelAiPayload> {
  const { rows } = await db.query<Row>(
    `update model_ai set llm_url = $1, model_teks = $2, model_gambar = $3, updated_at = now()
      where id = 1 returning llm_url, model_teks, model_gambar`,
    [p.llmUrl, p.modelTeks, p.modelGambar],
  );
  return map(rows[0] as Row);
}

/** Konfigurasi yang benar-benar dipakai: URL dari DB, jika kosong dari env OLLAMA_URL. */
export async function konfigurasiAi(db: Db): Promise<KonfigurasiAi> {
  const p = await getModelAi(db);
  return { llmUrl: p.llmUrl ?? config.OLLAMA_URL, modelTeks: p.modelTeks, modelGambar: p.modelGambar };
}
