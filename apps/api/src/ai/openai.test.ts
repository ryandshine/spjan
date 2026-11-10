import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { AiGalat } from "./klien.js";
import { buatKlienOpenAi, mimeGambar } from "./openai.js";
import { formatOpenAi } from "./pilih.js";

let server: http.Server | null = null;
afterEach(() => new Promise<void>((selesai) => (server ? server.close(() => selesai()) : selesai())));

async function mulai(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((ok) => server?.listen(0, "127.0.0.1", ok));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("klien OpenAI-compatible (Qwen)", () => {
  it("mengirim key, model, gambar data URL, skema di prompt, dan json_object; mengembalikan isi", async () => {
    let diterima: Record<string, unknown> = {};
    const baseUrl = await mulai((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        diterima = { url: req.url, auth: req.headers.authorization, ...JSON.parse(body) };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: '{"jenis":"hotel"}' }, finish_reason: "stop" }] }));
      });
    });
    const skema = { type: "object", properties: { jenis: { type: "string" } } };
    const balasan = await buatKlienOpenAi("kunci-uji").chat({
      baseUrl: `${baseUrl}/v1/`,
      model: "qwen-vl-max",
      prompt: "baca",
      gambar: ["/9j/AAA"],
      skema,
      maksToken: 100,
    });
    expect(balasan).toBe('{"jenis":"hotel"}');
    expect(diterima).toMatchObject({
      url: "/v1/chat/completions",
      auth: "Bearer kunci-uji",
      model: "qwen-vl-max",
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });
    const pesan = (diterima.messages as { content: { type: string; text?: string; image_url?: { url: string } }[] }[])[0];
    expect(pesan?.content[0]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,/9j/AAA" } });
    expect(pesan?.content[1]?.text).toContain(JSON.stringify(skema));
  });

  it("tanpa API key dan key ditolak menjadi MODEL_TIDAK_TERSEDIA", async () => {
    await expect(buatKlienOpenAi(undefined).chat({ baseUrl: "http://x/v1", model: "m", prompt: "p" })).rejects.toMatchObject({
      kode: "MODEL_TIDAK_TERSEDIA",
    });
    const baseUrl = await mulai((_req, res) => {
      res.statusCode = 401;
      res.end("invalid key");
    });
    const galat = await buatKlienOpenAi("salah").chat({ baseUrl: `${baseUrl}/v1`, model: "m", prompt: "p" }).catch((e: unknown) => e);
    expect(galat).toBeInstanceOf(AiGalat);
    expect((galat as AiGalat).message).toContain("API key ditolak");
  });

  it("memilih format dari alamat dan menebak jenis gambar", () => {
    expect(formatOpenAi("https://dashscope-intl.aliyuncs.com/compatible-mode/v1")).toBe(true);
    expect(formatOpenAi("https://openrouter.ai/api/v1/")).toBe(true);
    expect(formatOpenAi("http://172.17.0.1:11434")).toBe(false);
    expect(mimeGambar("iVBORw0")).toBe("image/png");
    expect(mimeGambar("/9j/4AAQ")).toBe("image/jpeg");
  });
});
