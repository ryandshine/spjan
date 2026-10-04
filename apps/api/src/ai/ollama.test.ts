import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { AiGalat } from "./klien.js";
import { klienOllama } from "./ollama.js";

let server: http.Server | null = null;
afterEach(() => new Promise<void>((selesai) => (server ? server.close(() => selesai()) : selesai())));

async function mulai(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((ok) => server?.listen(0, "127.0.0.1", ok));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("klienOllama", () => {
  it("mengirim model, skema, suhu 0, dan gambar; mengembalikan isi pesan", async () => {
    let diterima: Record<string, unknown> = {};
    const baseUrl = await mulai((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        diterima = { url: req.url, ...JSON.parse(body) };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: { content: '{"jenis":"hotel"}' } }));
      });
    });
    const skema = { type: "object", properties: { jenis: { type: "string" } } };
    const balasan = await klienOllama.chat({ baseUrl: `${baseUrl}/`, model: "m1", prompt: "baca", gambar: ["QUJD"], skema });
    expect(balasan).toBe('{"jenis":"hotel"}');
    expect(diterima).toMatchObject({
      url: "/api/chat",
      model: "m1",
      stream: false,
      format: skema,
      options: { temperature: 0 },
      messages: [{ role: "user", content: "baca", images: ["QUJD"] }],
    });
  });

  it("tanpa skema dan gambar, kedua kunci itu tidak dikirim", async () => {
    let diterima: Record<string, unknown> = {};
    const baseUrl = await mulai((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        diterima = JSON.parse(body);
        res.end(JSON.stringify({ message: { content: "ok" } }));
      });
    });
    await klienOllama.chat({ baseUrl, model: "m", prompt: "p" });
    expect(diterima).not.toHaveProperty("format");
    expect((diterima.messages as Array<Record<string, unknown>>)[0]).not.toHaveProperty("images");
  });

  it("410 menjadi MODEL_PENSIUN dengan nama model", async () => {
    const baseUrl = await mulai((_req, res) => {
      res.statusCode = 410;
      res.end(JSON.stringify({ error: "kimi-k2.5 was retired" }));
    });
    const galat = await klienOllama.chat({ baseUrl, model: "kimi-k2.5:cloud", prompt: "p" }).catch((e) => e);
    expect(galat).toBeInstanceOf(AiGalat);
    expect(galat).toMatchObject({ kode: "MODEL_PENSIUN" });
    expect(galat.message).toContain("kimi-k2.5:cloud");
  });

  it("status galat lain dan server tidak terjangkau menjadi MODEL_TIDAK_TERSEDIA", async () => {
    const baseUrl = await mulai((_req, res) => {
      res.statusCode = 500;
      res.end("boom");
    });
    expect(await klienOllama.chat({ baseUrl, model: "m", prompt: "p" }).catch((e) => e)).toMatchObject({ kode: "MODEL_TIDAK_TERSEDIA" });
    await new Promise<void>((selesai) => server?.close(() => selesai()));
    server = null;
    expect(await klienOllama.chat({ baseUrl, model: "m", prompt: "p" }).catch((e) => e)).toMatchObject({ kode: "MODEL_TIDAK_TERSEDIA" });
  });

  it("tidak menjawab dalam batas waktu menjadi WAKTU_HABIS", async () => {
    const baseUrl = await mulai(() => {
      /* sengaja tidak menjawab */
    });
    const galat = await klienOllama.chat({ baseUrl, model: "m", prompt: "p", timeoutMs: 150 }).catch((e) => e);
    expect(galat).toMatchObject({ kode: "WAKTU_HABIS" });
  });

  it("balasan tanpa message.content menjadi HASIL_TIDAK_VALID", async () => {
    const baseUrl = await mulai((_req, res) => res.end(JSON.stringify({ lain: 1 })));
    expect(await klienOllama.chat({ baseUrl, model: "m", prompt: "p" }).catch((e) => e)).toMatchObject({ kode: "HASIL_TIDAK_VALID" });
  });
});
