import type { FastifyRequest } from "fastify";

import { cekPasswordPengguna } from "./auth.js";
import type { Db } from "./db.js";
import { HttpError, notFound } from "./errors.js";

export function penggunaAktif(req: FastifyRequest) {
  if (!req.user) throw new HttpError(401, "BELUM_LOGIN", "Silakan login.");
  return req.user;
}

export function wajibAdmin(req: FastifyRequest): void {
  if (penggunaAktif(req).peran !== "admin") throw new HttpError(403, "DILARANG", "Hanya admin yang boleh melakukan ini.");
}

/**
 * Kondisi SQL: surat tugas `alias` terlihat oleh pengguna `$param` (admin dicek terpisah di kode).
 * Terlihat bila pengguna pembuatnya, atau pegawai yang terhubung ke akunnya tercantum sebagai pelaksana
 * (cocok lewat `pelaksana.pegawai_id`, atau NIP bila pelaksana diisi manual tanpa memilih dari data pegawai).
 */
export const kondisiTerlihat = (alias: string, param: string): string =>
  `(${alias}.dibuat_oleh = ${param} or exists (
     select 1 from users uu join pegawai pg on pg.id = uu.pegawai_id join pelaksana pl on pl.st_id = ${alias}.id
      where uu.id = ${param} and (pl.pegawai_id = pg.id or regexp_replace(pl.nip, '\\s', '', 'g') = pg.nip)))`;

/**
 * Melihat dan mengunduh: admin, pembuat, atau pelaksana yang tercantum. Selain itu 404 (bukan 403)
 * supaya keberadaan surat tugas orang lain tidak bocor. Surat tugas tidak ada/terhapus dibiarkan lolos (rute melempar 404).
 */
export async function wajibBolehLihatSt(db: Db, req: FastifyRequest, stId: number): Promise<void> {
  const user = penggunaAktif(req);
  if (user.peran === "admin") return;
  const { rows } = await db.query<{ terlihat: boolean }>(
    `select ${kondisiTerlihat("s", "$2")} as terlihat from surat_tugas s where s.id = $1 and s.dihapus_pada is null`,
    [stId, user.id],
  );
  if (rows[0] && !rows[0].terlihat) throw notFound("Surat tugas");
}

/** Berkas yang tertaut ke surat tugas mengikuti aturan lihat surat tugasnya. Berkas yang belum tertaut tidak dibatasi. */
export async function wajibBolehLihatBerkas(db: Db, req: FastifyRequest, berkasId: number): Promise<void> {
  const { rows } = await db.query<{ st_id: number | null }>("select st_id from berkas where id = $1 and dihapus_pada is null", [berkasId]);
  const stId = rows[0]?.st_id;
  if (stId != null) await wajibBolehLihatSt(db, req, stId);
}

/** Admin boleh semuanya; operator hanya surat tugas miliknya. Surat tugas tidak ada/terhapus dibiarkan lolos (rute melempar 404). */
export async function wajibPemilikAtauAdmin(db: Db, req: FastifyRequest, stId: number): Promise<void> {
  const user = penggunaAktif(req);
  if (user.peran === "admin") return;
  await wajibBolehLihatSt(db, req, stId);
  const { rows } = await db.query<{ dibuat_oleh: number | null; nama: string | null }>(
    `select s.dibuat_oleh, u.nama from surat_tugas s left join users u on u.id = s.dibuat_oleh where s.id = $1 and s.dihapus_pada is null`,
    [stId],
  );
  const row = rows[0];
  if (row && row.dibuat_oleh !== user.id) {
    throw new HttpError(403, "BUKAN_PEMILIK", `Surat tugas ini dibuat oleh ${row.nama ?? "pengguna lain"}; hanya pembuat atau admin yang boleh mengubahnya (Anda hanya dapat melihat dan mengunduh).`);
  }
}

export async function wajibPemilikBerkasAtauAdmin(db: Db, req: FastifyRequest, berkasId: number): Promise<void> {
  const { rows } = await db.query<{ st_id: number | null }>("select st_id from berkas where id = $1 and dihapus_pada is null", [berkasId]);
  const stId = rows[0]?.st_id;
  if (stId != null) await wajibPemilikAtauAdmin(db, req, stId);
}

/** Konfirmasi dengan password pengguna sendiri; salah = 403 PASSWORD_SALAH. */
export async function wajibPasswordBenar(db: Db, req: FastifyRequest, password: string): Promise<void> {
  const user = penggunaAktif(req);
  if (!(await cekPasswordPengguna(db, user.id, password))) {
    throw new HttpError(403, "PASSWORD_SALAH", "Password salah.");
  }
}
