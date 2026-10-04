import type { FastifyInstance } from "fastify";
import { StatusKonfigurasiMapSchema } from "@spjan/shared";
import { z } from "zod";

import type { Db } from "../db.js";
import { notFound } from "../errors.js";
import { getVersiSbm, listVersiSbm, simpanStatusKonfigurasi } from "../repositories/sbm.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });

export async function sbmRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.get("/versi", async () => listVersiSbm(opts.db));

  app.get("/versi/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const hasil = await getVersiSbm(opts.db, id);
    if (!hasil) throw notFound("Versi SBM");
    return hasil;
  });

  app.patch("/versi/:id/status-konfigurasi", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const konfigurasi = StatusKonfigurasiMapSchema.parse(req.body);
    if (!(await simpanStatusKonfigurasi(opts.db, id, konfigurasi))) throw notFound("Versi SBM");
    return konfigurasi;
  });
}
