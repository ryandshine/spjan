import type { FastifyInstance } from "fastify";
import { PegawaiPayloadSchema } from "@spjan/shared";
import { z } from "zod";

import type { Db } from "../db.js";
import { notFound } from "../errors.js";
import { createPegawai, getPegawai, listPegawai, nonaktifkanPegawai, updatePegawai } from "../repositories/pegawai.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });
const QuerySchema = z.object({ aktif: z.enum(["true", "false"]).optional() });

export async function pegawaiRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.get("/", async (req) => {
    const { aktif } = QuerySchema.parse(req.query);
    return listPegawai(opts.db, aktif !== "false");
  });

  app.post("/", async (req, reply) => {
    const dto = await createPegawai(opts.db, PegawaiPayloadSchema.parse(req.body));
    return reply.code(201).send(dto);
  });

  app.get("/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const dto = await getPegawai(opts.db, id);
    if (!dto) throw notFound("Pegawai");
    return dto;
  });

  app.patch("/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const dto = await updatePegawai(opts.db, id, PegawaiPayloadSchema.partial().parse(req.body));
    if (!dto) throw notFound("Pegawai");
    return dto;
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await nonaktifkanPegawai(opts.db, id))) throw notFound("Pegawai");
    return reply.code(204).send();
  });
}
