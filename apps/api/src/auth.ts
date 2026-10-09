import type { Peran } from "@spjan/shared";

import type { Db } from "./db.js";
import { config } from "./config.js";
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from "./crypto.js";

export const SESSION_COOKIE = "spjan_session";

export interface SessionUser {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
}

/** Buat akun pertama dari env bila tabel users kosong. Mengembalikan true bila akun dibuat. */
export async function ensureAdmin(db: Db, username = config.ADMIN_USERNAME, password = config.ADMIN_PASSWORD): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from users");
  if ((rows[0]?.n ?? 0) > 0) return false;
  if (!username || !password) return false;
  const { salt, hash } = hashPassword(password);
  await db.query("insert into users (username, nama, peran, password_salt, password_hash) values ($1, $2, 'admin', $3, $4)", [username, "Administrator", salt, hash]);
  return true;
}

// Hash tiruan agar waktu respons tidak membedakan "pengguna tidak ada" dari "sandi salah".
const TIRUAN = hashPassword("tidak-pernah-dipakai");

export async function login(db: Db, username: string, password: string): Promise<{ token: string; user: SessionUser } | null> {
  const { rows } = await db.query<{ id: number; username: string; nama: string; peran: Peran; password_salt: string; password_hash: string }>(
    "select id, username, nama, peran, password_salt, password_hash from users u where username = $1 and aktif and (pegawai_id is null or exists (select 1 from pegawai p where p.id = u.pegawai_id and p.aktif))",
    [username],
  );
  const row = rows[0];
  const ok = row
    ? verifyPassword(password, row.password_salt, row.password_hash)
    : (verifyPassword(password, TIRUAN.salt, TIRUAN.hash), false);
  if (!row || !ok) return null;
  const token = newSessionToken();
  await db.query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))",
    [hashSessionToken(token), row.id, config.SESSION_TTL_DAYS],
  );
  return { token, user: { id: row.id, username: row.username, nama: row.nama, peran: row.peran } };
}

export async function userFromToken(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await db.query<SessionUser>(
    `select u.id, u.username, u.nama, u.peran
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.aktif
        and (u.pegawai_id is null or exists (select 1 from pegawai p where p.id = u.pegawai_id and p.aktif))`,
    [hashSessionToken(token)],
  );
  return rows[0] ?? null;
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.query("delete from sessions where token_hash = $1", [hashSessionToken(token)]);
}

export async function purgeExpiredSessions(db: Db): Promise<number> {
  const { rowCount } = await db.query("delete from sessions where expires_at <= now()");
  return rowCount ?? 0;
}

/** Cocokkan password dengan akun pengguna (untuk konfirmasi aksi berbahaya dan ganti password). */
export async function cekPasswordPengguna(db: Db, userId: number, password: string): Promise<boolean> {
  const { rows } = await db.query<{ password_salt: string; password_hash: string }>(
    "select password_salt, password_hash from users where id = $1",
    [userId],
  );
  const row = rows[0];
  if (!row) {
    verifyPassword(password, TIRUAN.salt, TIRUAN.hash);
    return false;
  }
  return verifyPassword(password, row.password_salt, row.password_hash);
}

export async function aturPassword(db: Db, userId: number, password: string): Promise<void> {
  const { salt, hash } = hashPassword(password);
  await db.query("update users set password_salt = $2, password_hash = $3 where id = $1", [userId, salt, hash]);
}

/** Cabut semua sesi pengguna (setelah reset password atau penonaktifan). Sesi `kecuali` dipertahankan. */
export async function cabutSesi(db: Db, userId: number, kecualiTokenHash?: string): Promise<void> {
  await db.query("delete from sessions where user_id = $1 and ($2::text is null or token_hash <> $2)", [userId, kecualiTokenHash ?? null]);
}
