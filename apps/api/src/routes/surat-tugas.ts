import type { FastifyInstance } from "fastify";
import {
  BukaKunciSchema,
  hitungSpj,
  KonfirmasiPasswordSchema,
  petakanHotelKeUsulan,
  petakanTransportKeUsulan,
  SuratTugasPayloadSchema,
  toSpjInput,
  type SuratTugasRingkasDto,
} from "@spjan/shared";
import { z } from "zod";

import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { HttpError, notFound } from "../errors.js";
import { penggunaAktif, wajibPasswordBenar, wajibPemilikAtauAdmin } from "../izin.js";
import { catatAudit } from "../repositories/audit.js";
import { listBerkas, tautkanBerkasKeSt } from "../repositories/berkas.js";
import { getPengaturan } from "../repositories/pengaturan.js";
import { getVersiSbm, versiAktifTerbaru } from "../repositories/sbm.js";
import {
  aturKunciSt,
  createSuratTugas,
  getSuratTugas,
  hapusLunakSt,
  listSuratTugas,
  replaceSuratTugas,
} from "../repositories/surat-tugas.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });
const PostQuerySchema = z.object({ berkasId: z.coerce.number().int().positive().optional() });

export async function suratTugasRoutes(app: FastifyInstance, opts: { db: Db; store: BerkasStore }): Promise<void> {
  app.get("/", async () => {
    const [daftar, pengaturan] = await Promise.all([listSuratTugas(opts.db), getPengaturan(opts.db)]);
    const sbmPerVersi = new Map<number, Awaited<ReturnType<typeof getVersiSbm>>>();
    const hasil: SuratTugasRingkasDto[] = [];
    for (const ringkas of daftar) {
      const st = await getSuratTugas(opts.db, ringkas.id);
      if (!st) continue;
      if (!sbmPerVersi.has(st.versiSbmId)) sbmPerVersi.set(st.versiSbmId, await getVersiSbm(opts.db, st.versiSbmId));
      const sbm = sbmPerVersi.get(st.versiSbmId);
      // Versi SBM yang hilang tidak boleh membuat seluruh daftar gagal; baris itu tampil tanpa angka.
      const spj = sbm ? hitungSpj(toSpjInput(st, pengaturan), sbm.data) : null;
      hasil.push({
        ...ringkas,
        total: spj?.total ?? 0,
        jumlahPeringatan: spj ? spj.pelaksana.reduce((n, p) => n + p.peringatan.length, 0) : 0,
      });
    }
    return hasil;
  });

  app.post("/", async (req, reply) => {
    const { berkasId } = PostQuerySchema.parse(req.query);
    const payload = SuratTugasPayloadSchema.parse(req.body);
    const versiId = await versiAktifTerbaru(opts.db);
    if (versiId === null) throw new HttpError(500, "SBM_KOSONG", "Belum ada versi SBM aktif.");
    const user = penggunaAktif(req);
    const id = await createSuratTugas(payload, versiId, user.id);
    await catatAudit(opts.db, user, { aksi: "st.buat", entitas: "surat_tugas", entitasId: id, stId: id, detail: { nomor: payload.nomor } });
    if (berkasId) {
      await tautkanBerkasKeSt(opts.db, opts.store, berkasId, id);
    }
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
    await wajibPemilikAtauAdmin(opts.db, req, id);
    if (!(await replaceSuratTugas(id, payload))) throw notFound("Surat tugas");
    return getSuratTugas(opts.db, id);
  });

  app.post("/:id/kunci", async (req) => {
    const { id } = IdSchema.parse(req.params);
    await wajibPemilikAtauAdmin(opts.db, req, id);
    const hasil = await aturKunciSt(opts.db, id, true);
    if (!hasil) throw notFound("Surat tugas");
    if (hasil === "berubah") await catatAudit(opts.db, penggunaAktif(req), { aksi: "st.kunci", entitas: "surat_tugas", entitasId: id, stId: id });
    return getSuratTugas(opts.db, id);
  });

  // Buka kunci: alasan wajib dan konfirmasi password sendiri; dicatat di log audit.
  app.post("/:id/buka-kunci", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const { id } = IdSchema.parse(req.params);
    const { password, alasan } = BukaKunciSchema.parse(req.body);
    await wajibPemilikAtauAdmin(opts.db, req, id);
    await wajibPasswordBenar(opts.db, req, password);
    const hasil = await aturKunciSt(opts.db, id, false);
    if (!hasil) throw notFound("Surat tugas");
    if (hasil === "berubah") await catatAudit(opts.db, penggunaAktif(req), { aksi: "st.buka_kunci", entitas: "surat_tugas", entitasId: id, stId: id, alasan });
    return getSuratTugas(opts.db, id);
  });

  // Hapus = pindah ke tempat sampah (admin bisa memulihkan); butuh password sendiri.
  app.delete("/:id", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const { password } = KonfirmasiPasswordSchema.parse(req.body);
    await wajibPemilikAtauAdmin(opts.db, req, id);
    await wajibPasswordBenar(opts.db, req, password);
    if (!(await hapusLunakSt(opts.db, id, penggunaAktif(req).id))) throw notFound("Surat tugas");
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "st.hapus", entitas: "surat_tugas", entitasId: id, stId: id });
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

  app.get("/:id/usulan-hotel", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const st = await getSuratTugas(opts.db, id);
    if (!st) throw notFound("Surat tugas");
    const [berkasList, sbm] = await Promise.all([
      listBerkas(opts.db, id),
      getVersiSbm(opts.db, st.versiSbmId),
    ]);
    if (!sbm) throw new HttpError(500, "SBM_HILANG", "Versi SBM yang di-pin surat tugas tidak ditemukan.");
    return petakanHotelKeUsulan(berkasList, st, sbm.data);
  });

  app.get("/:id/usulan-transport", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const st = await getSuratTugas(opts.db, id);
    if (!st) throw notFound("Surat tugas");
    const [berkasList, sbm] = await Promise.all([
      listBerkas(opts.db, id),
      getVersiSbm(opts.db, st.versiSbmId),
    ]);
    if (!sbm) throw new HttpError(500, "SBM_HILANG", "Versi SBM yang di-pin surat tugas tidak ditemukan.");
    return petakanTransportKeUsulan(berkasList, st, sbm.data);
  });
}

