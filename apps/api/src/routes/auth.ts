import type { FastifyInstance } from "fastify";
import { GantiPasswordSchema, LoginSchema } from "@spjan/shared";

import { SESSION_COOKIE, aturPassword, cabutSesi, cekPasswordPengguna, login, logout } from "../auth.js";
import { hashSessionToken } from "../crypto.js";
import { config } from "../config.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

export async function authRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { username, password } = LoginSchema.parse(req.body);
      const hasil = await login(opts.db, username, password);
      if (!hasil) throw new HttpError(401, "LOGIN_GAGAL", "Nama pengguna atau kata sandi salah.");
      reply.setCookie(SESSION_COOKIE, hasil.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: config.NODE_ENV === "production",
        path: "/",
        maxAge: config.SESSION_TTL_DAYS * 86_400,
      });
      return hasil.user;
    },
  );

  app.get("/me", async (req) => {
    if (!req.user) throw new HttpError(401, "BELUM_LOGIN", "Silakan login.");
    return req.user;
  });

  app.post("/ganti-password", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!req.user) throw new HttpError(401, "BELUM_LOGIN", "Silakan login.");
    const { passwordLama, passwordBaru } = GantiPasswordSchema.parse(req.body);
    if (!(await cekPasswordPengguna(opts.db, req.user.id, passwordLama))) throw new HttpError(403, "PASSWORD_SALAH", "Password lama salah.");
    await aturPassword(opts.db, req.user.id, passwordBaru);
    // Sesi lain milik akun ini dicabut; sesi yang sedang dipakai dipertahankan.
    const token = req.cookies[SESSION_COOKIE];
    await cabutSesi(opts.db, req.user.id, token ? hashSessionToken(token) : undefined);
    return reply.code(204).send();
  });

  app.post("/logout", async (req, reply) => {
    await logout(opts.db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });
}
