import type { FastifyInstance } from "fastify";
import { hitungSpj, SuratTugasPayloadSchema, toSpjInput } from "@spjan/shared";
import { z } from "zod";

import type { Db } from "../db.js";
import { HttpError, notFound } from "../errors.js";
import { getPengaturan } from "../repositories/pengaturan.js";
import { getVersiSbm, versiAktifTerbaru } from "../repositories/sbm.js";
import {
  createSuratTugas,
  deleteSuratTugas,
  getSuratTugas,
  listSuratTugas,
  replaceSuratTugas,
} from "../repositories/surat-tugas.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });

export async function suratTugasRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.get("/", async () => listSuratTugas(opts.db));

  app.post("/", async (req, reply) => {
    const payload = SuratTugasPayloadSchema.parse(req.body);
    const versiId = await versiAktifTerbaru(opts.db);
    if (versiId === null) throw new HttpError(500, "SBM_KOSONG", "Belum ada versi SBM aktif.");
    const id = await createSuratTugas(payload, versiId);
    return reply.code(201).send(await getSuratTugas(opts.db, id));
  });

  app.get("/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const dto = await getSuratTugas(opts.db, id);
    if (!dto) throw notFound("Surat tugas");
    return dto;
  });

  app.put("/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const payload = SuratTugasPayloadSchema.parse(req.body);
    if (!(await replaceSuratTugas(id, payload))) throw notFound("Surat tugas");
    return getSuratTugas(opts.db, id);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await deleteSuratTugas(opts.db, id))) throw notFound("Surat tugas");
    return reply.code(204).send();
  });

  app.get("/:id/hasil", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const st = await getSuratTugas(opts.db, id);
    if (!st) throw notFound("Surat tugas");
    const [pengaturan, sbm] = await Promise.all([getPengaturan(opts.db), getVersiSbm(opts.db, st.versiSbmId)]);
    if (!sbm) throw new HttpError(500, "SBM_HILANG", "Versi SBM yang di-pin surat tugas tidak ditemukan.");
    return { suratTugas: st, pengaturan, hasil: hitungSpj(toSpjInput(st, pengaturan), sbm.data) };
  });
}
