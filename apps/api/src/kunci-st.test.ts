import type { FastifyInstance } from "fastify";
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

const call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function stFinal() {
  const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
  const kunci = await call("POST", `/api/surat-tugas/${id}/kunci`);
  expect(kunci.statusCode).toBe(200);
  return id as number;
}

describe("kunci surat tugas", () => {
  it("mengunci mencatat status final dan waktu kunci", async () => {
    const id = await stFinal();
    const dto = (await call("GET", `/api/surat-tugas/${id}`)).json();
    expect(dto.status).toBe("final");
    expect(typeof dto.dikunciPada).toBe("string");
    expect(dto.jumlahDibuka).toBe(0);
  });

  it("PUT dan DELETE ditolak 409 ST_TERKUNCI, data tidak berubah", async () => {
    const id = await stFinal();
    const put = await call("PUT", `/api/surat-tugas/${id}`, { ...stResa, nomor: "UBAH" });
    expect(put.statusCode).toBe(409);
    expect(put.json().error).toBe("ST_TERKUNCI");
    const del = await call("DELETE", `/api/surat-tugas/${id}`);
    expect(del.statusCode).toBe(409);
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().nomor).toBe(stResa.nomor);
  });

  it("laporan dan berkas milik ST terkunci tidak bisa diubah, berkas tanpa ST tetap bisa", async () => {
    const id = await stFinal();
    const { rows } = await pool.query<{ id: number }>(
      `insert into berkas (st_id, nama_asli, mime, ukuran, sha256, jenis) values ($1, 'a.pdf', 'application/pdf', 1, 'aa', 'tiket'), (null, 'b.pdf', 'application/pdf', 1, 'bb', 'tiket') returning id`,
      [id],
    );
    const [terkait, lepas] = [rows[0]!.id, rows[1]!.id];
    expect((await call("PATCH", `/api/berkas/${terkait}`, { keterangan: "x" })).statusCode).toBe(409);
    expect((await call("DELETE", `/api/berkas/${terkait}`)).statusCode).toBe(409);
    expect((await call("POST", `/api/berkas/${terkait}/ulang`)).statusCode).toBe(409);
    expect((await call("PATCH", `/api/berkas/${terkait}/usulan-status`, { usulanStatus: "diabaikan" })).statusCode).toBe(409);
    expect((await call("PATCH", `/api/berkas/${lepas}`, { keterangan: "x" })).statusCode).toBe(200);
    const laporan = await call("PUT", `/api/surat-tugas/${id}/laporan`, { versi: 2, bagian: [] });
    expect(laporan.statusCode).toBe(409);
  });

  it("buka kunci mengembalikan ke draft, menambah hitungan, dan mengizinkan ubah lagi", async () => {
    const id = await stFinal();
    const buka = await call("POST", `/api/surat-tugas/${id}/buka-kunci`);
    expect(buka.json()).toMatchObject({ status: "draft", jumlahDibuka: 1 });
    expect(typeof buka.json().dibukaPada).toBe("string");
    expect((await call("PUT", `/api/surat-tugas/${id}`, { ...stResa, nomor: "UBAH" })).statusCode).toBe(200);
  });

  it("kunci dan buka kunci idempoten; ST tidak ada 404; daftar memuat status", async () => {
    const id = await stFinal();
    await call("POST", `/api/surat-tugas/${id}/kunci`);
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().jumlahDibuka).toBe(0);
    await call("POST", `/api/surat-tugas/${id}/buka-kunci`);
    await call("POST", `/api/surat-tugas/${id}/buka-kunci`);
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().jumlahDibuka).toBe(1);
    expect((await call("POST", "/api/surat-tugas/99999/kunci")).statusCode).toBe(404);
    await call("POST", `/api/surat-tugas/${id}/kunci`);
    expect((await call("GET", "/api/surat-tugas")).json()[0].status).toBe("final");
  });

  it("ST yang sudah dibuka kuncinya bisa dihapus", async () => {
    const id = await stFinal();
    await call("POST", `/api/surat-tugas/${id}/buka-kunci`);
    expect((await call("DELETE", `/api/surat-tugas/${id}`)).statusCode).toBe(204);
  });
});
