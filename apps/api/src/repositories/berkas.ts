import { createHash } from "node:crypto";
import { BATAS_BERKAS, type BerkasDto, type JenisBerkas, type KodeGalatAi, type MimeBerkas, type StatusEkstraksi, type StatusUsulan } from "@spjan/shared";

import { deteksiMime } from "../berkas/deteksi.js";
import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

interface Row {
  id: number;
  st_id: number | null;
  pelaksana_id: number | null;
  nama_asli: string;
  mime: MimeBerkas;
  ukuran: number;
  sha256: string;
  jenis: JenisBerkas;
  keterangan: string | null;
  created_at: Date;
  e_id: number | null;
  e_status: StatusEkstraksi | null;
  e_model: string | null;
  e_hasil: unknown;
  e_kode_galat: KodeGalatAi | null;
  e_galat: string | null;
  e_usulan_status: StatusUsulan | null;
  e_created_at: Date | null;
  e_selesai_at: Date | null;
}

const SELECT_BERKAS = `
  select b.id, b.st_id, b.pelaksana_id, b.nama_asli, b.mime, b.ukuran, b.sha256, b.jenis, b.keterangan, b.created_at,
         e.id as e_id, e.status as e_status, e.model as e_model, e.hasil as e_hasil,
         e.kode_galat as e_kode_galat, e.galat as e_galat, e.usulan_status as e_usulan_status,
         e.created_at as e_created_at, e.selesai_at as e_selesai_at
    from berkas b
    left join lateral (select * from ekstraksi where berkas_id = b.id order by id desc limit 1) e on true`;

function map(r: Row): BerkasDto {
  return {
    id: r.id,
    stId: r.st_id,
    pelaksanaId: r.pelaksana_id,
    namaAsli: r.nama_asli,
    mime: r.mime,
    ukuran: r.ukuran,
    sha256: r.sha256,
    jenis: r.jenis,
    keterangan: r.keterangan ?? null,
    createdAt: r.created_at.toISOString(),
    ekstraksi:
      r.e_id === null || r.e_status === null || r.e_usulan_status === null || r.e_created_at === null
        ? null
        : {
            id: r.e_id,
            berkasId: r.id,
            status: r.e_status,
            model: r.e_model,
            hasil: r.e_hasil ?? null,
            kodeGalat: r.e_kode_galat,
            galat: r.e_galat,
            usulanStatus: r.e_usulan_status,
            createdAt: r.e_created_at.toISOString(),
            selesaiAt: r.e_selesai_at ? r.e_selesai_at.toISOString() : null,
          },
  };
}

export async function stAda(db: Db, stId: number): Promise<boolean> {
  const { rows } = await db.query("select 1 from surat_tugas where id = $1 and dihapus_pada is null", [stId]);
  return rows.length > 0;
}

export async function getBerkas(db: Db, id: number): Promise<BerkasDto | null> {
  const { rows } = await db.query<Row>(`${SELECT_BERKAS} where b.id = $1 and b.dihapus_pada is null`, [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function listBerkas(db: Db, stId: number | null): Promise<BerkasDto[]> {
  const { rows } = await db.query<Row>(`${SELECT_BERKAS} where b.st_id is not distinct from $1 and b.dihapus_pada is null order by b.id`, [stId]);
  return rows.map(map);
}

export async function metaBerkas(
  db: Db,
  id: number,
): Promise<{ id: number; namaAsli: string; mime: MimeBerkas; sha256: string } | null> {
  const { rows } = await db.query<{ id: number; nama_asli: string; mime: MimeBerkas; sha256: string }>(
    "select id, nama_asli, mime, sha256 from berkas where id = $1 and dihapus_pada is null",
    [id],
  );
  const r = rows[0];
  return r ? { id: r.id, namaAsli: r.nama_asli, mime: r.mime, sha256: r.sha256 } : null;
}

function bersihkanNama(nama: string): string {
  const bersih = nama.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 200);
  return bersih === "" ? "berkas" : bersih;
}

export async function tambahBerkas(
  db: Db,
  store: BerkasStore,
  input: { stId: number | null; namaAsli: string; data: Buffer; jenis?: JenisBerkas; keterangan?: string | null },
): Promise<{ dto: BerkasDto; duplikat: boolean }> {
  const mime = deteksiMime(input.data);
  if (!mime) {
    throw new HttpError(415, "JENIS_TIDAK_DIDUKUNG", "Hanya PDF, JPG, PNG, atau WEBP yang dapat diunggah.");
  }
  const { rows: hitung } = await db.query<{ n: number }>(
    "select count(*)::int as n from berkas where st_id is not distinct from $1 and dihapus_pada is null",
    [input.stId],
  );
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const { rows: ada } = await db.query<{ id: number }>(
    "select id from berkas where st_id is not distinct from $1 and sha256 = $2 and dihapus_pada is null",
    [input.stId, sha256],
  );
  if (ada[0]) {
    const dto = await getBerkas(db, ada[0].id);
    return { dto: dto as BerkasDto, duplikat: true };
  }
  if ((hitung[0]?.n ?? 0) >= BATAS_BERKAS.maksPerSt) {
    throw new HttpError(409, "BATAS_BERKAS", `Satu surat tugas maksimal ${BATAS_BERKAS.maksPerSt} berkas.`);
  }
  await store.put(sha256, input.data);

  const jenisAwal = input.jenis ?? "belum";
  const keteranganAwal = input.keterangan ?? null;
  const tanpaAi = jenisAwal === "dokumentasi" || jenisAwal === "laporan";

  const { rows } = await db.query<{ id: number }>(
    `with b as (
       insert into berkas (st_id, nama_asli, mime, ukuran, sha256, jenis, keterangan)
       values ($1, $2, $3, $4, $5, $6, $7) returning id
     ), e as (
       insert into ekstraksi (berkas_id, status, hasil)
       select id,
              ${tanpaAi ? "'selesai'" : "'antre'"},
              ${tanpaAi ? "'{\"ringkasan\":\"Berkas laporan, tanpa ekstraksi\"}'::jsonb" : "null"}
       from b returning id
     )
     select id from b`,
    [input.stId, bersihkanNama(input.namaAsli), mime, input.data.length, sha256, jenisAwal, keteranganAwal],
  );
  const dto = await getBerkas(db, (rows[0] as { id: number }).id);
  return { dto: dto as BerkasDto, duplikat: false };
}

/** Hapus file dari penyimpanan bila sha256 sudah tidak dipakai berkas mana pun. */
export async function hapusFileYatim(db: Db, store: BerkasStore, shas: string[]): Promise<void> {
  for (const sha of new Set(shas)) {
    const { rows } = await db.query("select 1 from berkas where sha256 = $1 limit 1", [sha]);
    if (rows.length === 0) await store.delete(sha);
  }
}

/** Hapus lunak berkas (ke tempat sampah); fisiknya tetap tersimpan sampai dihapus permanen. */
export async function hapusLunakBerkas(db: Db, id: number, userId: number): Promise<boolean> {
  const { rowCount } = await db.query("update berkas set dihapus_pada = now(), dihapus_oleh = $2 where id = $1 and dihapus_pada is null", [id, userId]);
  return (rowCount ?? 0) > 0;
}

export async function pulihkanBerkas(db: Db, id: number): Promise<boolean> {
  try {
    const { rowCount } = await db.query("update berkas set dihapus_pada = null, dihapus_oleh = null where id = $1 and dihapus_pada is not null", [id]);
    return (rowCount ?? 0) > 0;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "BERKAS_DUPLIKAT", "Berkas yang sama sudah diunggah ulang pada surat tugas ini; hapus yang baru dulu untuk memulihkan yang lama.");
    }
    throw error;
  }
}

/** Hapus permanen berkas yang ada di tempat sampah, termasuk file fisik bila tidak dipakai berkas lain. */
export async function hapusPermanenBerkas(db: Db, store: BerkasStore, id: number): Promise<boolean> {
  const { rows } = await db.query<{ sha256: string }>("delete from berkas where id = $1 and dihapus_pada is not null returning sha256", [id]);
  if (!rows[0]) return false;
  await hapusFileYatim(db, store, [rows[0].sha256]);
  return true;
}

/** Dipakai internal (mis. menggabungkan duplikat saat menautkan berkas): hapus langsung tanpa tempat sampah. */
export async function hapusBerkas(db: Db, store: BerkasStore, id: number): Promise<boolean> {
  const { rows } = await db.query<{ sha256: string }>("delete from berkas where id = $1 returning sha256", [id]);
  if (!rows[0]) return false;
  await hapusFileYatim(db, store, [rows[0].sha256]);
  return true;
}

export async function shaBerkasSt(db: Db, stId: number): Promise<string[]> {
  const { rows } = await db.query<{ sha256: string }>("select distinct sha256 from berkas where st_id = $1", [stId]);
  return rows.map((r) => r.sha256);
}

export async function ulangiEkstraksi(db: Db, berkasId: number): Promise<boolean> {
  const { rowCount } = await db.query("insert into ekstraksi (berkas_id) select id from berkas where id = $1", [berkasId]);
  return (rowCount ?? 0) > 0;
}

/** Tautkan berkas yang semula tanpa ST ke suatu ST (menghindari duplikasi sha256). */
export async function tautkanBerkasKeSt(db: Db, store: BerkasStore, berkasId: number, stId: number): Promise<void> {
  const meta = await metaBerkas(db, berkasId);
  if (!meta) return;
  const { rows: ada } = await db.query<{ id: number }>(
    "select id from berkas where st_id = $1 and sha256 = $2 and id <> $3 and dihapus_pada is null",
    [stId, meta.sha256, berkasId],
  );
  if (ada.length > 0) {
    await hapusBerkas(db, store, berkasId);
    return;
  }
  await db.query("update berkas set st_id = $1 where id = $2", [stId, berkasId]);
}

export async function updateUsulanStatus(
  db: Db,
  berkasId: number,
  usulanStatus: StatusUsulan,
  pelaksanaId?: number | null,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `update ekstraksi set usulan_status = $1
      where id = (select id from ekstraksi where berkas_id = $2 order by id desc limit 1)`,
    [usulanStatus, berkasId],
  );
  if (pelaksanaId !== undefined) {
    await db.query("update berkas set pelaksana_id = $1 where id = $2", [pelaksanaId, berkasId]);
  }
  return (rowCount ?? 0) > 0;
}

export async function updateBerkas(
  db: Db,
  id: number,
  payload: { jenis?: JenisBerkas; keterangan?: string | null; pelaksanaId?: number | null; usulanStatus?: StatusUsulan },
): Promise<boolean> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (payload.jenis !== undefined) {
    updates.push(`jenis = $${idx++}`);
    values.push(payload.jenis);
  }
  if (payload.keterangan !== undefined) {
    updates.push(`keterangan = $${idx++}`);
    values.push(payload.keterangan);
  }
  if (payload.pelaksanaId !== undefined) {
    updates.push(`pelaksana_id = $${idx++}`);
    values.push(payload.pelaksanaId);
  }

  if (updates.length > 0) {
    values.push(id);
    const { rowCount } = await db.query(
      `update berkas set ${updates.join(", ")} where id = $${idx}`,
      values,
    );
    if (!rowCount) return false;
  }

  if (payload.usulanStatus !== undefined) {
    await db.query(
      `update ekstraksi set usulan_status = $1
        where id = (select id from ekstraksi where berkas_id = $2 order by id desc limit 1)`,
      [payload.usulanStatus, id],
    );
  }

  return true;
}

