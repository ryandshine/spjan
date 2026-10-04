import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import type { KlienAi } from "./ai/klien.js";
import { SESSION_COOKIE, type SessionUser, userFromToken } from "./auth.js";
import { FileBerkasStore, type BerkasStore } from "./berkas/store.js";
import { config } from "./config.js";
import type { Db } from "./db.js";
import { HttpError } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { berkasRoutes } from "./routes/berkas.js";
import { pegawaiRoutes } from "./routes/pegawai.js";
import { pengaturanRoutes } from "./routes/pengaturan.js";
import { sbmRoutes } from "./routes/sbm.js";
import { suratTugasRoutes } from "./routes/surat-tugas.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

const PUBLIC_PATHS = new Set(["/api/health", "/api/auth/login"]);

export async function buildApp(db: Db, opts: { logger?: boolean; store?: BerkasStore; klien?: KlienAi } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? config.NODE_ENV !== "test",
    trustProxy: true,
    bodyLimit: 1_000_000,
  });
  const store = opts.store ?? new FileBerkasStore(config.BERKAS_DIR);

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((error: unknown, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "VALIDASI", pesan: "Data tidak valid.", rincian: error.issues });
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, pesan: error.message });
    }
    const err = error as { code?: string; statusCode?: number; message?: string };
    if (err.code === "23505") {
      return reply.code(409).send({ error: "DUPLIKAT", pesan: "Data dengan nilai unik yang sama sudah ada." });
    }
    if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: "PERMINTAAN_SALAH", pesan: err.message ?? "Permintaan tidak valid." });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "GALAT_SERVER", pesan: "Terjadi kesalahan pada server." });
  });

  app.addHook("onRequest", async (req) => {
    const path = req.url.split("?")[0] ?? "";
    if (!path.startsWith("/api/")) return;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== config.FRONTEND_ORIGIN) {
        throw new HttpError(403, "ORIGIN_DITOLAK", "Asal permintaan tidak diizinkan.");
      }
    }
    if (PUBLIC_PATHS.has(path)) return;
    const user = await userFromToken(db, req.cookies[SESSION_COOKIE]);
    if (!user) throw new HttpError(401, "BELUM_LOGIN", "Silakan login.");
    req.user = user;
  });

  app.get("/api/health", async () => {
    await db.query("select 1");
    return { status: "ok" };
  });
  await app.register(authRoutes, { prefix: "/api/auth", db });
  await app.register(pengaturanRoutes, { prefix: "/api/pengaturan", db });
  await app.register(pegawaiRoutes, { prefix: "/api/pegawai", db });
  await app.register(sbmRoutes, { prefix: "/api/sbm", db });
  await app.register(suratTugasRoutes, { prefix: "/api/surat-tugas", db, store });
  await app.register(berkasRoutes, { prefix: "/api/berkas", db, store });
  return app;
}
