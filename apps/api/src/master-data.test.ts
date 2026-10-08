import type { FastifyInstance } from "fastify";
import { SBM_2026 } from "@spjan/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { closePool } from "./db.js";
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

const pegawai = { nama: "Gunadi Firdaus, S.Hut., M.Si.", nip: "197803101997031001", jabatan: "Kasubdit", status: "ESELON_III_GOL_IV" };

describe("pegawai", () => {
  it("instansi bawaan Direktorat Pengendalian Perhutanan Sosial, dapat diubah, kosong kembali ke bawaan", async () => {
    const dibuat = await call("POST", "/api/pegawai", pegawai);
    expect(dibuat.json().instansi).toBe("Direktorat Pengendalian Perhutanan Sosial");
    const { id } = dibuat.json();
    const ubah = await call("PATCH", `/api/pegawai/${id}`, { instansi: "Balai PS Palembang" });
    expect(ubah.json().instansi).toBe("Balai PS Palembang");
    expect((await call("GET", `/api/pegawai/${id}`)).json().instansi).toBe("Balai PS Palembang");
    const kosong = await call("PATCH", `/api/pegawai/${id}`, { instansi: "" });
    expect(kosong.json().instansi).toBe("Direktorat Pengendalian Perhutanan Sosial");
  });

  it("pelaksana di surat tugas menyimpan instansi; tanpa instansi memakai bawaan", async () => {
    const pel = stResa.pelaksana[0]!;
    const tanpa = await call("POST", "/api/surat-tugas", stResa);
    expect(tanpa.json().pelaksana[0].instansi).toBe("Direktorat Pengendalian Perhutanan Sosial");
    const dengan = await call("POST", "/api/surat-tugas", { ...stResa, nomor: "ST.2", pelaksana: [{ ...pel, instansi: "KPH Wilayah II" }] });
    expect(dengan.json().pelaksana[0].instansi).toBe("KPH Wilayah II");
  });

  it("membuat, membaca, mengubah, dan menonaktifkan", async () => {
    const dibuat = await call("POST", "/api/pegawai", pegawai);
    expect(dibuat.statusCode).toBe(201);
    const { id } = dibuat.json();
    expect(dibuat.json()).toMatchObject({ ...pegawai, aktif: true });

    expect((await call("GET", `/api/pegawai/${id}`)).json().nama).toBe(pegawai.nama);
    const ubah = await call("PATCH", `/api/pegawai/${id}`, { jabatan: "Kepala Subdirektorat", status: "ESELON_II" });
    expect(ubah.json()).toMatchObject({ jabatan: "Kepala Subdirektorat", status: "ESELON_II", nip: pegawai.nip });

    expect((await call("GET", "/api/pegawai")).json()).toHaveLength(1);
    expect((await call("DELETE", `/api/pegawai/${id}`)).statusCode).toBe(204);
    expect((await call("GET", "/api/pegawai")).json()).toHaveLength(0);
    expect((await call("GET", "/api/pegawai?aktif=false")).json()).toHaveLength(1);
  });

  it("NIP kembar ditolak 409, data salah 400, tidak ada 404", async () => {
    await call("POST", "/api/pegawai", pegawai);
    const kembar = await call("POST", "/api/pegawai", { ...pegawai, nama: "Lain" });
    expect(kembar.statusCode).toBe(409);
    const salah = await call("POST", "/api/pegawai", { ...pegawai, nip: "abc" });
    expect(salah.statusCode).toBe(400);
    expect(salah.json().error).toBe("VALIDASI");
    expect((await call("GET", "/api/pegawai/9999")).statusCode).toBe(404);
    expect((await call("GET", "/api/pegawai/abc")).statusCode).toBe(400);
  });
});

describe("pengaturan", () => {
  it("memiliki nilai awal dan dapat diganti", async () => {
    const awal = (await call("GET", "/api/pengaturan")).json();
    expect(awal).toMatchObject({ kotaKedudukan: "Jakarta", provinsiKedudukan: "D.K.I. JAKARTA", tahunAnggaran: 2026 });
    const baru = { ...awal, kodeSatker: "693712", ppkNama: "Priyo Kusumedi, S.Hut., M.P.", pembuatDaftarNama: null };
    const res = await call("PUT", "/api/pengaturan", baru);
    expect(res.statusCode).toBe(200);
    expect((await call("GET", "/api/pengaturan")).json()).toMatchObject({ kodeSatker: "693712", ppkNama: "Priyo Kusumedi, S.Hut., M.P." });
    expect((await call("PUT", "/api/pengaturan", { ...baru, tahunAnggaran: 1 })).statusCode).toBe(400);
  });
});

describe("SBM", () => {
  it("daftar versi memuat SBM 2026 dan data lengkap dapat dibaca", async () => {
    const daftar = (await call("GET", "/api/sbm/versi")).json();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]).toMatchObject({ tahunAnggaran: 2026, dasarHukum: "PMK Nomor 32 Tahun 2025", aktif: true });
    const rinci = (await call("GET", `/api/sbm/versi/${daftar[0].id}`)).json();
    expect(rinci.data.uangHarian["BALI"].luarKota).toBe(480_000);
    expect(rinci.data.tiketPp).toHaveLength(316);
    expect((await call("GET", "/api/sbm/versi/9999")).statusCode).toBe(404);
  });

  it("konfigurasi status dapat diubah dan harus lengkap", async () => {
    const [{ id }] = (await call("GET", "/api/sbm/versi")).json();
    const baru = { ...SBM_2026.statusKonfigurasi, ESELON_II: { kolomHotel: 2, barisRepresentasi: 3, kelasTiket: "Bisnis" } };
    expect((await call("PATCH", `/api/sbm/versi/${id}/status-konfigurasi`, baru)).statusCode).toBe(200);
    const rinci = (await call("GET", `/api/sbm/versi/${id}`)).json();
    expect(rinci.data.statusKonfigurasi.ESELON_II.kelasTiket).toBe("Bisnis");
    expect(rinci.data.uangHarian["BALI"].luarKota).toBe(480_000);
    const { ESELON_I: _x, ...kurang } = baru;
    expect((await call("PATCH", `/api/sbm/versi/${id}/status-konfigurasi`, kurang)).statusCode).toBe(400);
    // kembalikan nilai awal agar tes lain tidak terpengaruh
    await call("PATCH", `/api/sbm/versi/${id}/status-konfigurasi`, SBM_2026.statusKonfigurasi);
  });
});
