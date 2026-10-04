import type { Db } from "./db.js";
import { config } from "./config.js";
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from "./crypto.js";

export const SESSION_COOKIE = "spjan_session";

export interface SessionUser {
  id: number;
  username: string;
}

/** Buat akun pertama dari env bila tabel users kosong. Mengembalikan true bila akun dibuat. */
export async function ensureAdmin(db: Db, username = config.ADMIN_USERNAME, password = config.ADMIN_PASSWORD): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from users");
  if ((rows[0]?.n ?? 0) > 0) return false;
  if (!username || !password) return false;
  const { salt, hash } = hashPassword(password);
  await db.query("insert into users (username, password_salt, password_hash) values ($1, $2, $3)", [username, salt, hash]);
  return true;
}

// Hash tiruan agar waktu respons tidak membedakan "pengguna tidak ada" dari "sandi salah".
const TIRUAN = hashPassword("tidak-pernah-dipakai");

export async function login(db: Db, username: string, password: string): Promise<{ token: string; user: SessionUser } | null> {
  const { rows } = await db.query<{ id: number; username: string; password_salt: string; password_hash: string }>(
    "select id, username, password_salt, password_hash from users where username = $1",
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
  return { token, user: { id: row.id, username: row.username } };
}

export async function userFromToken(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await db.query<SessionUser>(
    `select u.id, u.username
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
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
