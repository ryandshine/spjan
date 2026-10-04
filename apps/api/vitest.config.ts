import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/spjan_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      FRONTEND_ORIGIN: "http://localhost:5173",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "sandi-uji-12345",
    },
  },
});
