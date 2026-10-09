import type { PenggunaDto, Peran } from "@spjan/shared";

import { hashPassword } from "../crypto.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

interface Row {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
  aktif: boolean;
  created_at: Date;
}

const map = (r: Row): PenggunaDto => ({ id: r.id, username: r.username, nama: r.nama, peran: r.peran, aktif: r.aktif, createdAt: r.created_at.toISOString() });

export async function daftarPengguna(db: Db): Promise<PenggunaDto[]> {
  const { rows } = await db.query<Row>("select id, username, nama, peran, aktif, created_at from users order by id");
  return rows.map(map);
}

export async function getPengguna(db: Db, id: number): Promise<PenggunaDto | null> {
  const { rows } = await db.query<Row>("select id, username, nama, peran, aktif, created_at from users where id = $1", [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function buatPengguna(db: Db, v: { username: string; nama: string; peran: Peran; password: string }): Promise<PenggunaDto> {
  const { salt, hash } = hashPassword(v.password);
  try {
    const { rows } = await db.query<Row>(
      `insert into users (username, nama, peran, password_salt, password_hash) values ($1, $2, $3, $4, $5)
       returning id, username, nama, peran, aktif, created_at`,
      [v.username, v.nama, v.peran, salt, hash],
    );
    return map(rows[0] as Row);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new HttpError(409, "USERNAME_SUDAH_ADA", `Username "${v.username}" sudah dipakai.`);
    throw error;
  }
}

/** Ubah nama/peran/aktif. Admin aktif terakhir tidak boleh diturunkan atau dinonaktifkan. */
export async function ubahPengguna(db: Db, id: number, v: { nama?: string; peran?: Peran; aktif?: boolean }): Promise<PenggunaDto | null> {
  const lama = await getPengguna(db, id);
  if (!lama) return null;
  const peranBaru = v.peran ?? lama.peran;
  const aktifBaru = v.aktif ?? lama.aktif;
  const kehilanganAdmin = lama.peran === "admin" && lama.aktif && (peranBaru !== "admin" || !aktifBaru);
  if (kehilanganAdmin) {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from users where peran = 'admin' and aktif and id <> $1", [id]);
    if ((rows[0]?.n ?? 0) === 0) throw new HttpError(409, "ADMIN_TERAKHIR", "Harus ada minimal satu admin aktif.");
  }
  const { rows } = await db.query<Row>(
    `update users set nama = $2, peran = $3, aktif = $4 where id = $1 returning id, username, nama, peran, aktif, created_at`,
    [id, v.nama ?? lama.nama, peranBaru, aktifBaru],
  );
  return map(rows[0] as Row);
}
