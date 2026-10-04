import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureAdmin } from "./auth.js";
import { closePool, pool } from "./db.js";
import { hashSessionToken } from "./crypto.js";
import { loginCookie, siapkanApp } from "./test-support/helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await siapkanApp();
});
afterAll(async () => {
  await app.close();
  await closePool();
});

describe("autentikasi", () => {
  it("endpoint kesehatan terbuka", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("menolak akses tanpa sesi", async () => {
    for (const url of ["/api/pegawai", "/api/pengaturan", "/api/surat-tugas", "/api/sbm/versi", "/api/auth/me"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(401);
      expect(res.json().error).toBe("BELUM_LOGIN");
    }
  });

  it("login salah ditolak, login benar menghasilkan cookie httpOnly", async () => {
    const salah = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "salah" } });
    expect(salah.statusCode).toBe(401);
    const tidakAda = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "tidak-ada", password: "x" } });
    expect(tidakAda.statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "sandi-uji-12345" } });
    expect(ok.statusCode).toBe(200);
    const set = String(ok.headers["set-cookie"]);
    expect(set).toContain("spjan_session=");
    expect(set).toContain("HttpOnly");
    expect(set).toContain("SameSite=Strict");
  });

  it("/me memakai sesi, logout mencabutnya", async () => {
    const cookie = await loginCookie(app);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe("admin");
    const keluar = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(keluar.statusCode).toBe(204);
    const lagi = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(lagi.statusCode).toBe(401);
  });

  it("sesi kedaluwarsa tidak dipakai; token disimpan sebagai hash", async () => {
    const cookie = await loginCookie(app);
    const token = cookie.split("=")[1] as string;
    const { rows } = await pool.query("select token_hash from sessions where token_hash = $1", [hashSessionToken(token)]);
    expect(rows).toHaveLength(1);
    expect(await pool.query("select 1 from sessions where token_hash = $1", [token]).then((r) => r.rowCount)).toBe(0);
    await pool.query("update sessions set expires_at = now() - interval '1 minute' where token_hash = $1", [hashSessionToken(token)]);
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(401);
  });

  it("ensureAdmin tidak membuat akun kedua bila sudah ada pengguna", async () => {
    expect(await ensureAdmin(pool, "lain", "sandi-lain-12345")).toBe(false);
    const { rows } = await pool.query("select count(*)::int as n from users");
    expect(rows[0].n).toBe(1);
  });

  it("menolak mutasi dari origin lain", async () => {
    const cookie = await loginCookie(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie, origin: "https://jahat.example" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("ORIGIN_DITOLAK");
  });
});
