import type { FastifyInstance } from "fastify";
import { KonfirmasiPasswordSchema } from "@spjan/shared";
import { z } from "zod";

import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { notFound } from "../errors.js";
import { penggunaAktif, wajibAdmin, wajibPasswordBenar } from "../izin.js";
import { catatAudit } from "../repositories/audit.js";
import { hapusFileYatim, hapusPermanenBerkas, pulihkanBerkas, shaBerkasSt } from "../repositories/berkas.js";
import { daftarSampah } from "../repositories/sampah.js";
import { hapusPermanenSt, pulihkanSt } from "../repositories/surat-tugas.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });

/** Tempat sampah: lihat, pulihkan, dan hapus permanen. Khusus admin. */
export async function sampahRoutes(app: FastifyInstance, opts: { db: Db; store: BerkasStore }): Promise<void> {
  app.addHook("preHandler", async (req) => wajibAdmin(req));

  app.get("/", async () => daftarSampah(opts.db));

  app.post("/surat-tugas/:id/pulihkan", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await pulihkanSt(opts.db, id))) throw notFound("Surat tugas di tempat sampah");
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "st.pulihkan", entitas: "surat_tugas", entitasId: id, stId: id });
    return reply.code(204).send();
  });

  app.delete("/surat-tugas/:id", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const { password } = KonfirmasiPasswordSchema.parse(req.body);
    await wajibPasswordBenar(opts.db, req, password);
    const shas = await shaBerkasSt(opts.db, id);
    if (!(await hapusPermanenSt(opts.db, id))) throw notFound("Surat tugas di tempat sampah");
    await hapusFileYatim(opts.db, opts.store, shas);
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "st.hapus_permanen", entitas: "surat_tugas", entitasId: id, stId: id });
    return reply.code(204).send();
  });

  app.post("/berkas/:id/pulihkan", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await pulihkanBerkas(opts.db, id))) throw notFound("Berkas di tempat sampah");
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "berkas.pulihkan", entitas: "berkas", entitasId: id });
    return reply.code(204).send();
  });

  app.delete("/berkas/:id", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const { password } = KonfirmasiPasswordSchema.parse(req.body);
    await wajibPasswordBenar(opts.db, req, password);
    if (!(await hapusPermanenBerkas(opts.db, opts.store, id))) throw notFound("Berkas di tempat sampah");
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "berkas.hapus_permanen", entitas: "berkas", entitasId: id });
    return reply.code(204).send();
  });
}
