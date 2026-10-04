import type { FastifyInstance } from "fastify";
import { LoginSchema } from "@spjan/shared";

import { SESSION_COOKIE, login, logout } from "../auth.js";
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
      return { id: hasil.user.id, username: hasil.user.username };
    },
  );

  app.get("/me", async (req) => {
    if (!req.user) throw new HttpError(401, "BELUM_LOGIN", "Silakan login.");
    return req.user;
  });

  app.post("/logout", async (req, reply) => {
    await logout(opts.db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });
}
