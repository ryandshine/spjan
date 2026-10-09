import type { FastifyInstance } from "fastify";
import { ModelAiPayloadSchema, type ModelAiDto } from "@spjan/shared";
import { z } from "zod";

import type { KlienAi } from "../ai/klien.js";
import { ujiModel } from "../ai/uji.js";
import { config } from "../config.js";
import type { Db } from "../db.js";
import { wajibAdmin } from "../izin.js";
import { getModelAi, konfigurasiAi, saveModelAi } from "../repositories/model-ai.js";

const UjiSchema = z.object({ jenis: z.enum(["teks", "gambar"]) });

export async function modelAiRoutes(app: FastifyInstance, opts: { db: Db; klien: KlienAi }): Promise<void> {
  const dto = async (): Promise<ModelAiDto> => ({ ...(await getModelAi(opts.db)), bawaanUrl: config.OLLAMA_URL });

  app.get("/", async () => dto());

  app.put("/", async (req) => {
    wajibAdmin(req);
    await saveModelAi(opts.db, ModelAiPayloadSchema.parse(req.body));
    return dto();
  });

  app.post("/uji", async (req) => {
    wajibAdmin(req);
    const { jenis } = UjiSchema.parse(req.body);
    return ujiModel(opts.klien, await konfigurasiAi(opts.db), jenis);
  });
}
