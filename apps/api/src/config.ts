import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const kosongJadiUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  // compose menyetel variabel kosong ("") bila tidak diisi di Dokploy; perlakukan sebagai tidak ada.
  ADMIN_USERNAME: z.preprocess(kosongJadiUndefined, z.string().trim().min(1).optional()),
  ADMIN_PASSWORD: z.preprocess(kosongJadiUndefined, z.string().min(1).optional()),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  STARTUP_DB_MAX_RETRIES: z.coerce.number().int().min(0).default(10),
  STARTUP_DB_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(3000),
  BERKAS_DIR: z.string().min(1).default("./data/berkas"),
  OLLAMA_URL: z.string().min(1).default("http://172.17.0.1:11434"),
  // Qwen lewat Alibaba Model Studio (DashScope) region Singapura, format OpenAI-compatible.
  QWEN_URL: z.string().min(1).default("https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
  QWEN_API_KEY: z.preprocess(kosongJadiUndefined, z.string().trim().min(1).optional()),
  DASHSCOPE_API_KEY: z.preprocess(kosongJadiUndefined, z.string().trim().min(1).optional()),
});

const env = envSchema.parse(process.env);
export const config = {
  ...env,
  QWEN_API_KEY: env.QWEN_API_KEY ?? env.DASHSCOPE_API_KEY,
  /** Alamat model bila Pengaturan tidak mengisinya: Qwen bila ada API key, selain itu Ollama. */
  get LLM_URL_BAWAAN(): string {
    return this.QWEN_API_KEY ? env.QWEN_URL : env.OLLAMA_URL;
  },
};
export type Config = typeof config;
