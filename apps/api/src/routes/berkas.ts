import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import {
  BATAS_BERKAS,
  HasilEkstraksiStSchema,
  KonfirmasiPasswordSchema,
  JENIS_BERKAS,
  UpdateBerkasPayloadSchema,
  UpdateUsulanBerkasPayloadSchema,
  petakanStKeUsulan,
} from "@spjan/shared";
import { z } from "zod";

import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { HttpError, notFound } from "../errors.js";
import {
  getBerkas,
  hapusLunakBerkas,
  listBerkas,
  metaBerkas,
  stAda,
  tambahBerkas,
  ulangiEkstraksi,
  updateBerkas,
  updateUsulanStatus,
} from "../repositories/berkas.js";
import { wajibPasswordBenar, wajibPemilikAtauAdmin, wajibPemilikBerkasAtauAdmin, penggunaAktif } from "../izin.js";
import { catatAudit } from "../repositories/audit.js";
import { tolakBilaBerkasTerkunci, tolakBilaTerkunci } from "../repositories/surat-tugas.js";
import { listPegawai } from "../repositories/pegawai.js";
import { getPengaturan } from "../repositories/pengaturan.js";
import { getVersiSbm, versiAktifTerbaru } from "../repositories/sbm.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });
const StQuerySchema = z.object({
  stId: z.coerce.number().int().positive().optional(),
  jenis: z.enum(JENIS_BERKAS).optional(),
  keterangan: z.string().max(500).optional(),
});

export async function berkasRoutes(app: FastifyInstance, opts: { db: Db; store: BerkasStore }): Promise<void> {
  // multipart dibaca sebagai aliran sehingga tidak terkena bodyLimit JSON (1 MB) di app.ts.
  await app.register(multipart, { limits: { fileSize: BATAS_BERKAS.maksUkuranMb * 1024 * 1024, files: 1, fields: 0 } });

  app.post("/", async (req, reply) => {
    const { stId, jenis, keterangan } = StQuerySchema.parse(req.query);
    if (stId !== undefined) {
      if (!(await stAda(opts.db, stId))) throw notFound("Surat tugas");
      await wajibPemilikAtauAdmin(opts.db, req, stId);
      await tolakBilaTerkunci(opts.db, stId);
    }
    const file = await req.file();
    if (!file) throw new HttpError(400, "BERKAS_KOSONG", "Tidak ada berkas pada permintaan.");
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        throw new HttpError(413, "BERKAS_TERLALU_BESAR", `Berkas melebihi ${BATAS_BERKAS.maksUkuranMb} MB.`);
      }
      throw error;
    }
    const { dto, duplikat } = await tambahBerkas(opts.db, opts.store, {
      stId: stId ?? null,
      namaAsli: file.filename,
      data,
      jenis,
      keterangan,
    });
    return reply.code(duplikat ? 200 : 201).send({ berkas: dto, duplikat });
  });

  app.get("/", async (req) => {
    const { stId } = StQuerySchema.parse(req.query);
    return listBerkas(opts.db, stId ?? null);
  });

  app.get("/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const b = await getBerkas(opts.db, id);
    if (!b) throw notFound("Berkas");
    return b;
  });

  app.patch("/:id", async (req) => {
    const { id } = IdSchema.parse(req.params);
    await wajibPemilikBerkasAtauAdmin(opts.db, req, id);
    await tolakBilaBerkasTerkunci(opts.db, id);
    const payload = UpdateBerkasPayloadSchema.parse(req.body);
    const ok = await updateBerkas(opts.db, id, payload);
    if (!ok) throw notFound("Berkas");
    return getBerkas(opts.db, id);
  });

  app.get("/:id/isi", async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const meta = await metaBerkas(opts.db, id);
    if (!meta) throw notFound("Berkas");
    let data: Buffer;
    try {
      data = await opts.store.get(meta.sha256);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new HttpError(404, "BERKAS_HILANG", "Isi berkas tidak ada di penyimpanan.");
      }
      throw error;
    }
    return reply
      .header("content-type", meta.mime)
      .header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(meta.namaAsli)}`)
      .header("cache-control", "private, max-age=3600")
      .send(data);
  });

  // Hapus = pindah ke tempat sampah (admin bisa memulihkan); butuh password sendiri.
  app.delete("/:id", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { id } = IdSchema.parse(req.params);
    const { password } = KonfirmasiPasswordSchema.parse(req.body);
    const berkas = await getBerkas(opts.db, id);
    if (!berkas) throw notFound("Berkas");
    await wajibPemilikBerkasAtauAdmin(opts.db, req, id);
    await tolakBilaBerkasTerkunci(opts.db, id);
    await wajibPasswordBenar(opts.db, req, password);
    if (!(await hapusLunakBerkas(opts.db, id, penggunaAktif(req).id))) throw notFound("Berkas");
    await catatAudit(opts.db, penggunaAktif(req), { aksi: "berkas.hapus", entitas: "berkas", entitasId: id, stId: berkas.stId, detail: { nama: berkas.namaAsli } });
    return reply.code(204).send();
  });

  app.post("/:id/ulang", async (req) => {
    const { id } = IdSchema.parse(req.params);
    await wajibPemilikBerkasAtauAdmin(opts.db, req, id);
    await tolakBilaBerkasTerkunci(opts.db, id);
    if (!(await ulangiEkstraksi(opts.db, id))) throw notFound("Berkas");
    return getBerkas(opts.db, id);
  });

  app.patch("/:id/usulan-status", async (req) => {
    const { id } = IdSchema.parse(req.params);
    await wajibPemilikBerkasAtauAdmin(opts.db, req, id);
    await tolakBilaBerkasTerkunci(opts.db, id);
    const { usulanStatus, pelaksanaId } = UpdateUsulanBerkasPayloadSchema.parse(req.body);
    const ok = await updateUsulanStatus(opts.db, id, usulanStatus, pelaksanaId);
    if (!ok) throw notFound("Berkas");
    return getBerkas(opts.db, id);
  });

  app.get("/:id/usulan-st", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const b = await getBerkas(opts.db, id);
    if (!b) throw notFound("Berkas");
    if (!b.ekstraksi) {
      throw new HttpError(400, "BELUM_DIEKSTRAK", "Berkas belum memiliki data ekstraksi.");
    }
    if (b.ekstraksi.status !== "selesai") {
      throw new HttpError(400, "EKSTRAKSI_BELUM_SELESAI", `Ekstraksi berkas masih berstatus "${b.ekstraksi.status}".`);
    }
    if (b.jenis !== "st") {
      throw new HttpError(400, "BUKAN_SURAT_TUGAS", "Berkas ini bukan surat tugas.");
    }
    const hasil = HasilEkstraksiStSchema.safeParse(b.ekstraksi.hasil);
    if (!hasil.success) {
      throw new HttpError(400, "HASIL_INVALID", "Data ekstraksi surat tugas tidak valid.");
    }
    const versiId = await versiAktifTerbaru(opts.db);
    if (versiId === null) throw new HttpError(500, "SBM_KOSONG", "Belum ada versi SBM aktif.");
    const [masterPegawai, sbmDetail, pengaturan] = await Promise.all([
      listPegawai(opts.db, true),
      getVersiSbm(opts.db, versiId),
      getPengaturan(opts.db),
    ]);
    if (!sbmDetail) throw new HttpError(500, "SBM_HILANG", "Data SBM tidak ditemukan.");
    const daftarProvinsi = Object.keys(sbmDetail.data.uangHarian);
    const usulan = petakanStKeUsulan(hasil.data, masterPegawai, daftarProvinsi, pengaturan, sbmDetail.data);
    return { berkas: b, usulan };
  });
}

