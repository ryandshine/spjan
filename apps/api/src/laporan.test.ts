import type { FastifyInstance } from "fastify";
import { buatLaporanAwal } from "@spjan/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { closePool, pool } from "./db.js";
import { bersihkanData, loginCookie, siapkanApp, stResa } from "./test-support/helpers.js";

let app: FastifyInstance;
let cookie: string;
beforeAll(async () => {
  app = await siapkanApp();
  cookie = await loginCookie(app);
});
afterAll(async () => {
  await app.close();
  await closePool();
});
beforeEach(bersihkanData);

const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const buatSt = async () => (await call("POST", "/api/surat-tugas", stResa)).json().id as number;

describe("laporan perjalanan dinas", () => {
  it("GET sebelum pernah disimpan mengembalikan isi null", async () => {
    const id = await buatSt();
    const res = await call("GET", `/api/surat-tugas/${id}/laporan`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ isi: null, updatedAt: null });
  });

  it("PUT menyimpan, GET membacanya, PUT kedua menimpa", async () => {
    const id = await buatSt();
    const awal = buatLaporanAwal();
    const put = await call("PUT", `/api/surat-tugas/${id}/laporan`, awal);
    expect(put.statusCode).toBe(200);
    expect(put.json().isi).toEqual(awal);
    expect(typeof put.json().updatedAt).toBe("string");

    const ubah = { ...awal, bagian: awal.bagian.map((b) => (b.id === "hasil" && b.jenis === "teks" ? { ...b, judul: "Hasil Lapangan" } : b)) };
    await call("PUT", `/api/surat-tugas/${id}/laporan`, ubah);
    const get = await call("GET", `/api/surat-tugas/${id}/laporan`);
    expect(get.json().isi).toEqual(ubah);
    const { rows } = await pool.query("select count(*)::int as n from laporan where st_id = $1", [id]);
    expect(rows[0].n).toBe(1);
  });

  it("menolak isi tidak valid dengan 400", async () => {
    const id = await buatSt();
    const res = await call("PUT", `/api/surat-tugas/${id}/laporan`, { versi: 1, bagian: [] });
    expect(res.statusCode).toBe(400);
  });

  it("404 untuk surat tugas yang tidak ada", async () => {
    expect((await call("GET", "/api/surat-tugas/99999/laporan")).statusCode).toBe(404);
    expect((await call("PUT", "/api/surat-tugas/99999/laporan", buatLaporanAwal())).statusCode).toBe(404);
  });

  it("menghapus ST ikut menghapus laporan", async () => {
    const id = await buatSt();
    await call("PUT", `/api/surat-tugas/${id}/laporan`, buatLaporanAwal());
    await call("DELETE", `/api/surat-tugas/${id}`);
    const { rows } = await pool.query("select count(*)::int as n from laporan");
    expect(rows[0].n).toBe(0);
  });
});
