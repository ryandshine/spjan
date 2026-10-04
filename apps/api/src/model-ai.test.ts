import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AiGalat } from "./ai/klien.js";
import { closePool } from "./db.js";
import { bersihkanData, klienPalsu, loginCookie, siapkanApp } from "./test-support/helpers.js";

let app: FastifyInstance;
let cookie: string;
let balas: (model: string) => string = () => "ok";
const klien = klienPalsu((p) => {
  if (p.model === "pensiun") throw new AiGalat("MODEL_PENSIUN", 'Model "pensiun" sudah dipensiunkan.');
  return balas(p.model);
});
beforeAll(async () => {
  app = await siapkanApp({ klien });
  cookie = await loginCookie(app);
});
afterAll(async () => {
  await app.close();
  await closePool();
});
beforeEach(async () => {
  await bersihkanData();
  klien.panggilan.length = 0;
  balas = () => "ok";
});

const call = (method: "GET" | "PUT" | "POST", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe("model AI", () => {
  it("GET: nilai awal model teks bawaan, URL kosong, dan URL bawaan dari env", async () => {
    const res = await call("GET", "/api/model-ai");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      llmUrl: null,
      modelTeks: "gpt-oss:120b-cloud",
      modelGambar: null,
      bawaanUrl: "http://172.17.0.1:11434",
    });
  });

  it("PUT menyimpan, GET membaca kembali; nilai tidak valid ditolak 400", async () => {
    const baru = { llmUrl: "http://ollama:11434", modelTeks: "gpt-oss:20b-cloud", modelGambar: "kimi-k3:cloud" };
    expect((await call("PUT", "/api/model-ai", baru)).statusCode).toBe(200);
    expect((await call("GET", "/api/model-ai")).json()).toMatchObject(baru);
    expect((await call("PUT", "/api/model-ai", { ...baru, llmUrl: "bukan url" })).statusCode).toBe(400);
    expect((await call("PUT", "/api/model-ai", { ...baru, modelTeks: "" })).statusCode).toBe(400);
  });

  it("uji model teks: memakai model teks dan URL efektif, melaporkan durasi", async () => {
    await call("PUT", "/api/model-ai", { llmUrl: null, modelTeks: "m-teks", modelGambar: null });
    balas = () => "ok";
    const res = await call("POST", "/api/model-ai/uji", { jenis: "teks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, model: "m-teks", balasan: "ok" });
    expect(res.json().durasiMs).toBeGreaterThanOrEqual(0);
    expect(klien.panggilan[0]).toMatchObject({ baseUrl: "http://172.17.0.1:11434", model: "m-teks" });
    expect(klien.panggilan[0]?.gambar).toBeUndefined();
  });

  it("uji model gambar mengirim gambar kecil; model gambar belum diatur dilaporkan jelas", async () => {
    const belum = await call("POST", "/api/model-ai/uji", { jenis: "gambar" });
    expect(belum.json()).toMatchObject({ ok: false, kode: "MODEL_BELUM_DIATUR", model: null });
    expect(klien.panggilan).toHaveLength(0);

    await call("PUT", "/api/model-ai", { llmUrl: "http://x:1", modelTeks: null, modelGambar: "m-gambar" });
    const res = await call("POST", "/api/model-ai/uji", { jenis: "gambar" });
    expect(res.json()).toMatchObject({ ok: true, model: "m-gambar" });
    expect(klien.panggilan[0]?.baseUrl).toBe("http://x:1");
    expect(klien.panggilan[0]?.gambar?.length).toBe(1);
  });

  it("galat model (pensiun) dilaporkan sebagai ok:false dengan kode dan pesan, bukan 500", async () => {
    await call("PUT", "/api/model-ai", { llmUrl: null, modelTeks: "pensiun", modelGambar: null });
    const res = await call("POST", "/api/model-ai/uji", { jenis: "teks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false, kode: "MODEL_PENSIUN", model: "pensiun" });
    expect(res.json().pesan).toContain("dipensiunkan");
  });

  it("jenis uji tidak dikenal ditolak 400", async () => {
    expect((await call("POST", "/api/model-ai/uji", { jenis: "suara" })).statusCode).toBe(400);
  });
});
