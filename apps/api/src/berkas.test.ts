import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { FileBerkasStore } from "./berkas/store.js";
import { closePool, pool } from "./db.js";
import { bersihkanData, bodyMultipart, loginCookie, PNG_1X1, pngUnik, siapkanApp, stResa } from "./test-support/helpers.js";

let app: FastifyInstance;
let cookie: string;
let dir: string;
let store: FileBerkasStore;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "spjan-berkas-"));
  store = new FileBerkasStore(dir);
  app = await siapkanApp({ store });
  cookie = await loginCookie(app);
});
afterAll(async () => {
  await app.close();
  await closePool();
  await rm(dir, { recursive: true, force: true });
});
beforeEach(bersihkanData);

const unggah = (nama: string, isi: Buffer, query = "") => {
  const { payload, headers } = bodyMultipart(nama, isi);
  return app.inject({ method: "POST", url: `/api/berkas${query}`, headers: { cookie, ...headers }, payload });
};
const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const buatSt = async () => (await call("POST", "/api/surat-tugas", stResa)).json().id as number;

describe("unggah berkas", () => {
  it("menyimpan berkas, jenis 'belum', dan menjadwalkan ekstraksi", async () => {
    const res = await unggah("invoice.png", pngUnik(1));
    expect(res.statusCode).toBe(201);
    const { berkas, duplikat } = res.json();
    expect(duplikat).toBe(false);
    expect(berkas).toMatchObject({
      stId: null,
      namaAsli: "invoice.png",
      mime: "image/png",
      jenis: "belum",
      ekstraksi: { status: "antre", usulanStatus: "menunggu", hasil: null },
    });
    expect(await store.has(berkas.sha256)).toBe(true);
  });

  it("menerima berkas lebih besar dari bodyLimit JSON (3 MB)", async () => {
    const res = await unggah("besar.png", Buffer.concat([PNG_1X1, Buffer.alloc(3 * 1024 * 1024, 7)]));
    expect(res.statusCode).toBe(201);
  });

  it("mengabaikan berkas yang sama (sha256) pada ST yang sama", async () => {
    const pertama = await unggah("a.png", pngUnik(2));
    const kedua = await unggah("salinan.png", pngUnik(2));
    expect(kedua.statusCode).toBe(200);
    expect(kedua.json().duplikat).toBe(true);
    expect(kedua.json().berkas.id).toBe(pertama.json().berkas.id);
    expect((await call("GET", "/api/berkas")).json()).toHaveLength(1);
    const { rows } = await pool.query("select count(*)::int as n from ekstraksi");
    expect(rows[0].n).toBe(1);
  });

  it("memisahkan daftar berkas per ST dan berkas tanpa ST", async () => {
    const stId = await buatSt();
    await unggah("lepas.png", pngUnik(3));
    await unggah("untuk-st.png", pngUnik(4), `?stId=${stId}`);
    const lepas = (await call("GET", "/api/berkas")).json();
    const milikSt = (await call("GET", `/api/berkas?stId=${stId}`)).json();
    expect(lepas.map((b: { namaAsli: string }) => b.namaAsli)).toEqual(["lepas.png"]);
    expect(milikSt.map((b: { namaAsli: string; stId: number }) => [b.namaAsli, b.stId])).toEqual([["untuk-st.png", stId]]);
  });

  it("berkas yang sama boleh ada di ST berbeda", async () => {
    const a = await buatSt();
    const b = await buatSt();
    expect((await unggah("x.png", pngUnik(5), `?stId=${a}`)).statusCode).toBe(201);
    expect((await unggah("x.png", pngUnik(5), `?stId=${b}`)).statusCode).toBe(201);
  });

  it("404 bila ST tidak ada, 415 bila bukan pdf/gambar, 413 bila lebih dari 10 MB", async () => {
    expect((await unggah("x.png", pngUnik(6), "?stId=999999")).statusCode).toBe(404);
    const salahJenis = await unggah("catatan.png", Buffer.from("ini teks biasa, bukan gambar"));
    expect(salahJenis.statusCode).toBe(415);
    expect(salahJenis.json().error).toBe("JENIS_TIDAK_DIDUKUNG");
    const besar = await unggah("raksasa.png", Buffer.concat([PNG_1X1, Buffer.alloc(10 * 1024 * 1024)]));
    expect(besar.statusCode).toBe(413);
    expect(besar.json().error).toBe("BERKAS_TERLALU_BESAR");
  });

  it("menolak berkas ke-31 pada satu ST (409 BATAS_BERKAS)", async () => {
    const stId = await buatSt();
    for (let i = 0; i < 30; i += 1) {
      expect((await unggah(`b${i}.png`, pngUnik(100 + i), `?stId=${stId}`)).statusCode).toBe(201);
    }
    const res = await unggah("b30.png", pngUnik(200), `?stId=${stId}`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("BATAS_BERKAS");
  });

  it("permintaan tanpa berkas ditolak (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/berkas",
      headers: { cookie, "content-type": "multipart/form-data; boundary=x" },
      payload: "--x--\r\n",
    });
    expect(res.statusCode).toBe(400);
  });

  it("menolak tanpa login (401)", async () => {
    const { payload, headers } = bodyMultipart("x.png", pngUnik(7));
    const res = await app.inject({ method: "POST", url: "/api/berkas", headers, payload });
    expect(res.statusCode).toBe(401);
  });
});

describe("isi, hapus, dan ulang", () => {
  it("GET /:id/isi mengembalikan byte asli dengan tipe dan nama berkas", async () => {
    const isi = pngUnik(8);
    const { berkas } = (await unggah("bukti hotel.png", isi)).json();
    const res = await call("GET", `/api/berkas/${berkas.id}/isi`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toContain("bukti%20hotel.png");
    expect(res.rawPayload.equals(isi)).toBe(true);
    expect((await call("GET", "/api/berkas/999999/isi")).statusCode).toBe(404);
  });

  it("DELETE menghapus baris dan file, tetapi file dipertahankan selama masih dipakai berkas lain", async () => {
    const a = await buatSt();
    const b = await buatSt();
    const satu = (await unggah("x.png", pngUnik(9), `?stId=${a}`)).json().berkas;
    const dua = (await unggah("x.png", pngUnik(9), `?stId=${b}`)).json().berkas;
    expect(satu.sha256).toBe(dua.sha256);
    expect((await call("DELETE", `/api/berkas/${satu.id}`)).statusCode).toBe(204);
    expect(await store.has(satu.sha256)).toBe(true);
    expect((await call("DELETE", `/api/berkas/${dua.id}`)).statusCode).toBe(204);
    expect(await store.has(satu.sha256)).toBe(false);
    expect((await call("DELETE", `/api/berkas/${dua.id}`)).statusCode).toBe(404);
  });

  it("menghapus ST ikut menghapus berkas dan filenya", async () => {
    const stId = await buatSt();
    const { berkas } = (await unggah("x.png", pngUnik(10), `?stId=${stId}`)).json();
    expect((await call("DELETE", `/api/surat-tugas/${stId}`)).statusCode).toBe(204);
    const { rows } = await pool.query("select count(*)::int as n from berkas");
    expect(rows[0].n).toBe(0);
    expect(await store.has(berkas.sha256)).toBe(false);
  });

  it("POST /:id/ulang menambah ekstraksi baru berstatus antre", async () => {
    const { berkas } = (await unggah("x.png", pngUnik(11))).json();
    await pool.query("update ekstraksi set status = 'gagal', kode_galat = 'MODEL_PENSIUN', galat = 'x' where berkas_id = $1", [berkas.id]);
    const res = await call("POST", `/api/berkas/${berkas.id}/ulang`);
    expect(res.statusCode).toBe(200);
    expect(res.json().ekstraksi).toMatchObject({ status: "antre", kodeGalat: null });
    const { rows } = await pool.query("select count(*)::int as n from ekstraksi where berkas_id = $1", [berkas.id]);
    expect(rows[0].n).toBe(2);
    expect((await call("POST", "/api/berkas/999999/ulang")).statusCode).toBe(404);
  });
});
