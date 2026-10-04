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

  it("BERKAS_DIR dan OLLAMA_URL punya nilai bawaan dan dapat diganti", async () => {
    let config = await muatConfig();
    expect(config.BERKAS_DIR).toBe("./data/berkas");
    expect(config.OLLAMA_URL).toBe("http://172.17.0.1:11434");
    vi.stubEnv("BERKAS_DIR", "/data/berkas");
    vi.stubEnv("OLLAMA_URL", "http://ollama:11434");
    config = await muatConfig();
    expect(config.BERKAS_DIR).toBe("/data/berkas");
    expect(config.OLLAMA_URL).toBe("http://ollama:11434");
  });
});
