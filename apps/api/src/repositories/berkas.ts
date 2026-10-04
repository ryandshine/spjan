import { createHash } from "node:crypto";
import { BATAS_BERKAS, type BerkasDto, type JenisBerkas, type KodeGalatAi, type MimeBerkas, type StatusEkstraksi, type StatusUsulan } from "@spjan/shared";

import { deteksiMime } from "../berkas/deteksi.js";
import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

interface Row {
  id: number;
  st_id: number | null;
  nama_asli: string;
  mime: MimeBerkas;
  ukuran: number;
  sha256: string;
  jenis: JenisBerkas;
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
  select b.id, b.st_id, b.nama_asli, b.mime, b.ukuran, b.sha256, b.jenis, b.created_at,
         e.id as e_id, e.status as e_status, e.model as e_model, e.hasil as e_hasil,
         e.kode_galat as e_kode_galat, e.galat as e_galat, e.usulan_status as e_usulan_status,
         e.created_at as e_created_at, e.selesai_at as e_selesai_at
    from berkas b
    left join lateral (select * from ekstraksi where berkas_id = b.id order by id desc limit 1) e on true`;

function map(r: Row): BerkasDto {
  return {
    id: r.id,
    stId: r.st_id,
    namaAsli: r.nama_asli,
    mime: r.mime,
    ukuran: r.ukuran,
    sha256: r.sha256,
    jenis: r.jenis,
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
  const { rows } = await db.query("select 1 from surat_tugas where id = $1", [stId]);
  return rows.length > 0;
}

export async function getBerkas(db: Db, id: number): Promise<BerkasDto | null> {
  const { rows } = await db.query<Row>(`${SELECT_BERKAS} where b.id = $1`, [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function listBerkas(db: Db, stId: number | null): Promise<BerkasDto[]> {
  const { rows } = await db.query<Row>(`${SELECT_BERKAS} where b.st_id is not distinct from $1 order by b.id`, [stId]);
  return rows.map(map);
}

export async function metaBerkas(
  db: Db,
  id: number,
): Promise<{ id: number; namaAsli: string; mime: MimeBerkas; sha256: string } | null> {
  const { rows } = await db.query<{ id: number; nama_asli: string; mime: MimeBerkas; sha256: string }>(
    "select id, nama_asli, mime, sha256 from berkas where id = $1",
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
  input: { stId: number | null; namaAsli: string; data: Buffer },
): Promise<{ dto: BerkasDto; duplikat: boolean }> {
  const mime = deteksiMime(input.data);
  if (!mime) {
    throw new HttpError(415, "JENIS_TIDAK_DIDUKUNG", "Hanya PDF, JPG, PNG, atau WEBP yang dapat diunggah.");
  }
  const { rows: hitung } = await db.query<{ n: number }>(
    "select count(*)::int as n from berkas where st_id is not distinct from $1",
    [input.stId],
  );
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const { rows: ada } = await db.query<{ id: number }>(
    "select id from berkas where st_id is not distinct from $1 and sha256 = $2",
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
  const { rows } = await db.query<{ id: number }>(
    `with b as (
       insert into berkas (st_id, nama_asli, mime, ukuran, sha256) values ($1, $2, $3, $4, $5) returning id
     ), e as (
       insert into ekstraksi (berkas_id) select id from b returning id
     )
     select id from b`,
    [input.stId, bersihkanNama(input.namaAsli), mime, input.data.length, sha256],
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
    "select id from berkas where st_id = $1 and sha256 = $2 and id <> $3",
    [stId, meta.sha256, berkasId],
  );
  if (ada.length > 0) {
    await hapusBerkas(db, store, berkasId);
    return;
  }
  await db.query("update berkas set st_id = $1 where id = $2", [stId, berkasId]);
}

