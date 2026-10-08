import type { FastifyInstance } from "fastify";
import { LaporanIsiSchema } from "@spjan/shared";
import { z } from "zod";

import type { Db } from "../db.js";
import { notFound } from "../errors.js";
import { getLaporan, simpanLaporan, stAda } from "../repositories/laporan.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });

export async function laporanRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.get("/:id/laporan", async (req) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await stAda(opts.db, id))) throw notFound("Surat tugas");
    return getLaporan(opts.db, id);
  });

  app.put("/:id/laporan", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const isi = LaporanIsiSchema.parse(req.body);
    if (!(await stAda(opts.db, id))) throw notFound("Surat tugas");
    return simpanLaporan(opts.db, id, isi);
  });
}
