import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AiGalat } from "./ai/klien.js";
import { closePool, pool } from "./db.js";
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
    // Qwen menolak gambar dengan sisi <= 10 px.
    const meta = await sharp(Buffer.from(klien.panggilan[0]?.gambar?.[0] ?? "", "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([64, 64]);
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

  it("pemakaian: dijumlahkan per bulan dan model, hanya yang memanggil model; operator ditolak 403", async () => {
    await pool.query("truncate surat_tugas restart identity cascade");
    const { rows } = await pool.query<{ id: number }>(
      "insert into berkas (nama_asli, mime, ukuran, sha256) values ('a.png','image/png',1,'a1'), ('b.png','image/png',1,'b2'), ('c.png','image/png',1,'c3') returning id",
    );
    const [a, b, c] = rows.map((r) => r.id);
    await pool.query(
      `insert into ekstraksi (berkas_id, status, model, token_masuk, token_keluar, jumlah_panggilan, created_at) values
         ($1, 'selesai', 'qwen3-vl-plus', 2500, 100, 2, now()),
         ($2, 'gagal', 'qwen3-vl-plus', 500, 0, 1, now()),
         ($3, 'selesai', 'qwen-plus', 0, 0, 0, now())`,
      [a, b, c],
    );
    const res = await call("GET", "/api/model-ai/pemakaian");
    expect(res.statusCode).toBe(200);
    const bulan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
    expect(res.json()).toEqual([{ bulan, model: "qwen3-vl-plus", berkas: 2, panggilan: 3, tokenMasuk: 3000, tokenKeluar: 100 }]);

    await call("POST", "/api/admin/pengguna", { username: "opr-pakai", nama: "Operator", peran: "operator", password: "sandi-operator-1" });
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "opr-pakai", password: "sandi-operator-1" } });
    const raw = login.headers["set-cookie"];
    const cookieOpr = (Array.isArray(raw) ? raw[0] : raw)!.split(";")[0]!;
    const ditolak = await app.inject({ method: "GET", url: "/api/model-ai/pemakaian", headers: { cookie: cookieOpr } });
    expect(ditolak.statusCode).toBe(403);
    await pool.query("delete from users where username = 'opr-pakai'");
  });
});
