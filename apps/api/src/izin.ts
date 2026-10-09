import type { FastifyRequest } from "fastify";

import { cekPasswordPengguna } from "./auth.js";
import type { Db } from "./db.js";
import { HttpError } from "./errors.js";

export function penggunaAktif(req: FastifyRequest) {
  if (!req.user) throw new HttpError(401, "BELUM_LOGIN", "Silakan login.");
  return req.user;
}

export function wajibAdmin(req: FastifyRequest): void {
  if (penggunaAktif(req).peran !== "admin") throw new HttpError(403, "DILARANG", "Hanya admin yang boleh melakukan ini.");
}

/** Admin boleh semuanya; operator hanya surat tugas miliknya. Surat tugas tidak ada/terhapus dibiarkan lolos (rute melempar 404). */
export async function wajibPemilikAtauAdmin(db: Db, req: FastifyRequest, stId: number): Promise<void> {
  const user = penggunaAktif(req);
  if (user.peran === "admin") return;
  const { rows } = await db.query<{ dibuat_oleh: number | null; nama: string | null }>(
    `select s.dibuat_oleh, u.nama from surat_tugas s left join users u on u.id = s.dibuat_oleh where s.id = $1 and s.dihapus_pada is null`,
    [stId],
  );
  const row = rows[0];
  if (row && row.dibuat_oleh !== user.id) {
    throw new HttpError(403, "BUKAN_PEMILIK", `Surat tugas ini dibuat oleh ${row.nama ?? "pengguna lain"}; hanya pembuat atau admin yang boleh mengubahnya.`);
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
