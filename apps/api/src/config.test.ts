import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function muatConfig() {
  vi.resetModules();
  return (await import("./config.js")).config;
}

describe("config", () => {
  it("ADMIN_USERNAME dan ADMIN_PASSWORD kosong dianggap tidak ada (compose Dokploy)", async () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    const config = await muatConfig();
    expect(config.ADMIN_USERNAME).toBeUndefined();
    expect(config.ADMIN_PASSWORD).toBeUndefined();
  });

  it("nilai terisi dipertahankan dan SESSION_TTL_DAYS default 7", async () => {
    vi.stubEnv("ADMIN_USERNAME", " admin ");
    vi.stubEnv("ADMIN_PASSWORD", "rahasia-panjang-123");
    const config = await muatConfig();
    expect(config.ADMIN_USERNAME).toBe("admin");
    expect(config.ADMIN_PASSWORD).toBe("rahasia-panjang-123");
    expect(config.SESSION_TTL_DAYS).toBe(7);
  });
});
