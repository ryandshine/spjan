import type { FastifyInstance } from "fastify";
import { NaskahStPayloadSchema, type SuratTugasPayload } from "@spjan/shared";
import { z } from "zod";

import type { Db } from "../db.js";
import { notFound, HttpError } from "../errors.js";
import { penggunaAktif } from "../izin.js";
import { catatAudit } from "../repositories/audit.js";
import { getPengaturan } from "../repositories/pengaturan.js";
import { getPegawai } from "../repositories/pegawai.js";
import { versiAktifTerbaru } from "../repositories/sbm.js";
import { createSuratTugas } from "../repositories/surat-tugas.js";
import {
  createNaskahSt,
  deleteNaskahSt,
  getNaskahSt,
  listNaskahSt,
  tautkanNaskahStKeSpj,
  updateNaskahSt,
  wajibBolehLihatNaskahSt,
  wajibPemilikNaskahStAtauAdmin,
} from "../repositories/naskah-st.js";
import { generateNaskahStDocx } from "../docx/generator.js";

const IdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function naskahStRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  // 1. Daftar naskah ST
  app.get("/", async (req) => {
    return listNaskahSt(opts.db, penggunaAktif(req));
  });

  // 2. Buat naskah ST baru
  app.post("/", async (req, reply) => {
    const payload = NaskahStPayloadSchema.parse(req.body);
    const user = penggunaAktif(req);
    const id = await createNaskahSt(payload, user.id);
    await catatAudit(opts.db, user, {
      aksi: "st.buat",
      entitas: "naskah_st",
      entitasId: id,
      detail: { nomor: payload.nomor, maksud: payload.maksudTugas },
    });
    const created = await getNaskahSt(opts.db, id);
    return reply.code(201).send(created);
  });

  // 3. Detail naskah ST
  app.get("/:id", async (req) => {
    const { id } = IdParamsSchema.parse(req.params);
    await wajibBolehLihatNaskahSt(opts.db, req, id);
    const st = await getNaskahSt(opts.db, id);
    if (!st) throw notFound("Naskah surat tugas");
    return st;
  });

  // 4. Update naskah ST
  app.put("/:id", async (req) => {
    const { id } = IdParamsSchema.parse(req.params);
    await wajibPemilikNaskahStAtauAdmin(opts.db, req, id);
    const payload = NaskahStPayloadSchema.parse(req.body);
    await updateNaskahSt(id, payload);
    const updated = await getNaskahSt(opts.db, id);
    return updated;
  });


  // 5. Hapus naskah ST
  app.delete("/:id", async (req, reply) => {
    const { id } = IdParamsSchema.parse(req.params);
    await wajibPemilikNaskahStAtauAdmin(opts.db, req, id);
    await deleteNaskahSt(opts.db, id);
    return reply.code(204).send();
  });

  // 6. Unduh DOCX naskah ST
  app.get("/:id/docx", async (req, reply) => {
    const { id } = IdParamsSchema.parse(req.params);
    await wajibBolehLihatNaskahSt(opts.db, req, id);
    const st = await getNaskahSt(opts.db, id);
    if (!st) throw notFound("Naskah surat tugas");

    const docxBuffer = await generateNaskahStDocx(st);
    const namaFile = `Surat-Tugas-${(st.nomor || "Draft").replace(/[^A-Za-z0-9._-]+/g, "_")}.docx`;

    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("Content-Disposition", `attachment; filename="${namaFile}"`)
      .send(docxBuffer);
  });

  // 7. Preview DOCX dari payload langsung (tanpa harus simpan DB)
  app.post("/preview-docx", async (req, reply) => {
    const payload = NaskahStPayloadSchema.parse(req.body);
    const docxBuffer = await generateNaskahStDocx(payload);
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("Content-Disposition", 'attachment; filename="Pratinjau-Surat-Tugas.docx"')
      .send(docxBuffer);
  });

  // 8. Buat SPJ dari naskah ST ini
  app.post("/:id/buat-spj", async (req, reply) => {
    const { id } = IdParamsSchema.parse(req.params);
    await wajibBolehLihatNaskahSt(opts.db, req, id);
    const st = await getNaskahSt(opts.db, id);
    if (!st) throw notFound("Naskah surat tugas");

    const versiId = await versiAktifTerbaru(opts.db);
    if (versiId === null) throw new HttpError(500, "SBM_KOSONG", "Belum ada versi SBM aktif.");

    const pengaturan = await getPengaturan(opts.db);
    const user = penggunaAktif(req);

    // Siapkan data pelaksana untuk SPJ
    const pelaksanaSpj = await Promise.all(
      st.pelaksana.map(async (pel) => {
        let statusPegawai = null;
        let pangkatGolongan = "";
        let instansi = "Direktorat Pengendalian Perhutanan Sosial";

        if (pel.pegawaiId) {
          const peg = await getPegawai(opts.db, pel.pegawaiId);
          if (peg) {
            statusPegawai = peg.status;
            pangkatGolongan = peg.pangkatGolongan || "";
            instansi = peg.instansi || instansi;
          }
        }

        return {
          pegawaiId: pel.pegawaiId || null,
          nama: pel.nama,
          nip: pel.nip || "",
          jabatan: pel.jabatan || "",
          instansi,
          pangkatGolongan,
          status: statusPegawai,
          etape: [
            {
              provinsi: "D.K.I. JAKARTA",
              kota: st.lokasiTugas,
              kegiatan: st.maksudTugas,
              berangkat: st.tanggalMulai,
              pulang: st.tanggalSelesai,
              dinasJabatan: false,
            },
          ],
          biaya: [],
        };
      }),
    );

    const spjPayload: SuratTugasPayload = {
      nomor: st.modeNomor === "manual" && st.nomor ? st.nomor : `ST.${st.id}/PPS/${new Date().getFullYear()}`,
      tanggal: st.tanggal || st.tanggalMulai,
      tanggalSpj: null,
      kodeAkun: pengaturan.kodeAkunDefault || "524111",
      catatan: `Dibuat dari Naskah Surat Tugas ID #${st.id}`,
      tahunAnggaran: pengaturan.tahunAnggaran || new Date().getFullYear(),
      sumberDana: "RM",
      pjNama: st.penandatanganNama || pengaturan.pjNama,
      pjNip: st.penandatanganNip || pengaturan.pjNip,
      pjJabatan: st.penandatanganJabatan || pengaturan.pjJabatan,
      pelaksana: pelaksanaSpj,
    };

    const spjId = await createSuratTugas(spjPayload, versiId, user.id);
    await tautkanNaskahStKeSpj(opts.db, st.id, spjId);

    await catatAudit(opts.db, user, {
      aksi: "st.buat",
      entitas: "surat_tugas",
      entitasId: spjId,
      stId: spjId,
      detail: { dariNaskahId: st.id, nomor: spjPayload.nomor },
    });

    return reply.code(201).send({ spjId });
  });
}
