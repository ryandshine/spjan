import type { FastifyInstance } from "fastify";
import { PengaturanSchema } from "@spjan/shared";

import type { Db } from "../db.js";
import { wajibAdmin } from "../izin.js";
import { getPengaturan, savePengaturan } from "../repositories/pengaturan.js";

export async function pengaturanRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.get("/", async () => getPengaturan(opts.db));
  app.put("/", async (req) => {
    wajibAdmin(req);
    return savePengaturan(opts.db, PengaturanSchema.parse(req.body));
  });
}
