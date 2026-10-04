import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_USERNAME: z.string().trim().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  STARTUP_DB_MAX_RETRIES: z.coerce.number().int().min(0).default(10),
  STARTUP_DB_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(3000),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
