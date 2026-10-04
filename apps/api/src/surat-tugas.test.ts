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

const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe("surat tugas", () => {
  it("menyimpan dan membaca kembali pohon yang sama persis", async () => {
    const res = await call("POST", "/api/surat-tugas", stResa);
    expect(res.statusCode).toBe(201);
    const dto = res.json();
    expect(dto.id).toBeGreaterThan(0);
    expect(dto.versiSbmId).toBeGreaterThan(0);
    const { id, versiSbmId, createdAt, updatedAt, ...isi } = dto;
    expect(isi).toEqual(stResa);
    expect(typeof createdAt).toBe("string");
    expect(typeof updatedAt).toBe("string");
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().versiSbmId).toBe(versiSbmId);
  });

  it("hasil memakai mesin hitung bersama: Resa total Rp6.965.979", async () => {
    const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
    const res = await call("GET", `/api/surat-tugas/${id}/hasil`);
    expect(res.statusCode).toBe(200);
    const { hasil, pengaturan, suratTugas } = res.json();
    expect(suratTugas.id).toBe(id);
    expect(pengaturan.kotaKedudukan).toBe("Jakarta");
    expect(hasil.total).toBe(6_965_979);
    expect(hasil.pelaksana[0].terbilang).toBe(
      "Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah",
    );
    expect(hasil.pelaksana[0].transport.map((r: { uraian: string }) => r.uraian)).toEqual([
      "Tiket Pesawat Jakarta ke Denpasar",
      "Tiket Pesawat Denpasar ke Jakarta",
      "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)",
    ]);
    expect(hasil.teksTanggalSt).toBe("8 September 2026");
  });

  it("PUT mengganti seluruh pohon dan memperbarui hasil", async () => {
    const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
    const tanpaBiaya = { ...stResa, pelaksana: [{ ...stResa.pelaksana[0], biaya: [] }] };
    const put = await call("PUT", `/api/surat-tugas/${id}`, tanpaBiaya);
    expect(put.statusCode).toBe(200);
    expect(put.json().pelaksana[0].biaya).toEqual([]);
    expect((await call("GET", `/api/surat-tugas/${id}/hasil`)).json().hasil.total).toBe(960_000 + 1_021_948);
    const { rows } = await pool.query("select count(*)::int as n from biaya");
    expect(rows[0].n).toBe(0);
  });

  it("draf dengan tanggal kosong tersimpan dan menghasilkan peringatan", async () => {
    const draf = {
      ...stResa,
      pelaksana: [{ ...stResa.pelaksana[0], etape: [{ ...stResa.pelaksana[0]!.etape[0], berangkat: "", pulang: "" }], biaya: [] }],
    };
    const { id } = (await call("POST", "/api/surat-tugas", draf)).json();
    const kode = (await call("GET", `/api/surat-tugas/${id}/hasil`)).json().hasil.pelaksana[0].peringatan.map((p: { kode: string }) => p.kode);
    expect(kode).toContain("DATA_BELUM_LENGKAP");
  });

  it("daftar, hapus (cascade), dan galat 404/400", async () => {
    const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
    const daftar = (await call("GET", "/api/surat-tugas")).json();
    expect(daftar).toEqual([expect.objectContaining({ id, nomor: stResa.nomor, jumlahPelaksana: 1 })]);
    expect((await call("DELETE", `/api/surat-tugas/${id}`)).statusCode).toBe(204);
    for (const tabel of ["pelaksana", "etape", "biaya"]) {
      const { rows } = await pool.query(`select count(*)::int as n from ${tabel}`);
      expect(rows[0].n, tabel).toBe(0);
    }
    expect((await call("GET", `/api/surat-tugas/${id}`)).statusCode).toBe(404);
    expect((await call("PUT", `/api/surat-tugas/${id}`, stResa)).statusCode).toBe(404);
    expect((await call("POST", "/api/surat-tugas", { ...stResa, tanggal: "8/9/2026" })).statusCode).toBe(400);
  });

  it("versi SBM di-pin saat dibuat dan tidak berubah oleh versi baru", async () => {
    const { id, versiSbmId } = (await call("POST", "/api/surat-tugas", stResa)).json();
    await pool.query(
      "insert into sbm_versi (tahun_anggaran, dasar_hukum, aktif, data) select 2027, 'Uji', true, data from sbm_versi limit 1",
    );
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().versiSbmId).toBe(versiSbmId);
    const baru = (await call("POST", "/api/surat-tugas", stResa)).json();
    expect(baru.versiSbmId).not.toBe(versiSbmId);
    await pool.query("delete from surat_tugas");
    await pool.query("delete from sbm_versi where dasar_hukum = 'Uji'");
  });

  it("POST dengan ?berkasId menautkan berkas ke surat tugas baru", async () => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into berkas (nama_asli, mime, ukuran, sha256, jenis) values ('st.pdf', 'application/pdf', 100, 'abcd1234abcd1234', 'st') returning id",
    );
    const berkasId = rows[0]?.id;
    const res = await call("POST", `/api/surat-tugas?berkasId=${berkasId}`, stResa);
    expect(res.statusCode).toBe(201);
    const stId = res.json().id;

    const { rows: rBerkas } = await pool.query<{ st_id: number }>("select st_id from berkas where id = $1", [berkasId]);
    expect(rBerkas[0]?.st_id).toBe(stId);
  });
});

