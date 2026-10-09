import type { FastifyInstance } from "fastify";
import { BuatPenggunaSchema, ResetPasswordSchema, UbahPenggunaSchema } from "@spjan/shared";
import { z } from "zod";

import { aturPassword, cabutSesi } from "../auth.js";
import type { Db } from "../db.js";
import { notFound } from "../errors.js";
import { penggunaAktif, wajibAdmin } from "../izin.js";
import { catatAudit, daftarAudit } from "../repositories/audit.js";
import { buatPengguna, daftarPengguna, getPengguna, ubahPengguna } from "../repositories/pengguna.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });
const AuditQuery = z.object({ stId: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(500).default(200) });

/** Kelola pengguna dan lihat log audit: khusus admin. */
export async function penggunaRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.addHook("preHandler", async (req) => wajibAdmin(req));

  app.get("/pengguna", async () => daftarPengguna(opts.db));

  app.post("/pengguna", async (req, reply) => {
    const v = BuatPenggunaSchema.parse(req.body);
    const dto = await buatPengguna(opts.db, v);
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "pengguna.buat", entitas: "pengguna", entitasId: dto.id, detail: { username: dto.username, peran: dto.peran } });
    return reply.code(201).send(dto);
  });

  app.patch("/pengguna/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const v = UbahPenggunaSchema.parse(req.body);
    const dto = await ubahPengguna(opts.db, id, v);
    if (!dto) throw notFound("Pengguna");
    if (v.aktif === false) await cabutSesi(opts.db, id);
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "pengguna.ubah", entitas: "pengguna", entitasId: id, detail: v });
    return dto;
  });

  app.post("/pengguna/:id/reset-password", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const { password } = ResetPasswordSchema.parse(req.body);
    if (!(await getPengguna(opts.db, id))) throw notFound("Pengguna");
    await aturPassword(opts.db, id, password);
    await cabutSesi(opts.db, id);
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "pengguna.reset_password", entitas: "pengguna", entitasId: id });
    return reply.code(204).send();
  });

  app.get("/audit", async (req) => {
    const { stId, limit } = AuditQuery.parse(req.query);
    return daftarAudit(opts.db, { ...(stId !== undefined ? { stId } : {}), limit });
  });
}
