import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, pool } from "./db.js";
import { loginCookie, siapkanApp } from "./test-support/helpers.js";

let app: FastifyInstance;
let admin: string;
beforeAll(async () => {
  app = await siapkanApp();
  await pool.query("delete from users where username <> 'admin'");
  await pool.query("delete from pegawai where nip like '9990%'");
  admin = await loginCookie(app);
});
afterAll(async () => {
  await pool.query("delete from users where username <> 'admin'");
  await pool.query("delete from pegawai where nip like '9990%'");
  await app.close();
  await closePool();
});

const PW = "sandi-pegawai-1";
const kirim = (cookie: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const pegawaiBaru = async (nip: string, nama: string) =>
  (await kirim(admin, "POST", "/api/pegawai", { nama, nip, jabatan: "Staf", status: "ESELON_IV_GOL_III_II_I" })).json() as { id: number };

describe("akun dari data pegawai", () => {
  it("username = NIP, nama = nama pegawai; satu pegawai satu akun; ditandai punyaAkun", async () => {
    const p = await pegawaiBaru("999000000000000001", "Citra Dewi, S.Hut");
    const res = await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: p.id, peran: "operator", password: PW });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ username: "999000000000000001", nama: "Citra Dewi, S.Hut", pegawaiId: p.id, nip: "999000000000000001", peran: "operator" });
    const lagi = await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: p.id, peran: "operator", password: PW });
    expect(lagi.statusCode).toBe(409);
    expect(lagi.json().pesan).toContain("sudah punya akun");
    const daftar = (await kirim(admin, "GET", "/api/pegawai")).json() as { id: number; punyaAkun: boolean }[];
    expect(daftar.find((x) => x.id === p.id)?.punyaAkun).toBe(true);
    expect((await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: 999999, peran: "operator", password: PW })).statusCode).toBe(404);
  });

  it("login dengan NIP; nama ikut berubah saat data pegawai diubah", async () => {
    const p = await pegawaiBaru("999000000000000002", "Dedi");
    await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: p.id, peran: "operator", password: PW });
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "999000000000000002", password: PW } });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ nama: "Dedi", peran: "operator" });
    await kirim(admin, "PATCH", `/api/pegawai/${p.id}`, { nama: "Dedi Kurniawan, S.Hut" });
    const raw = login.headers["set-cookie"];
    const cookie = (Array.isArray(raw) ? raw[0] : raw)!.split(";")[0]!;
    expect((await kirim(cookie, "GET", "/api/auth/me")).json().nama).toBe("Dedi Kurniawan, S.Hut");
  });

  it("menonaktifkan pegawai langsung menutup akses login dan sesinya", async () => {
    const p = await pegawaiBaru("999000000000000003", "Eka");
    await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: p.id, peran: "operator", password: PW });
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "999000000000000003", password: PW } });
    const raw = login.headers["set-cookie"];
    const cookie = (Array.isArray(raw) ? raw[0] : raw)!.split(";")[0]!;
    expect((await kirim(cookie, "GET", "/api/auth/me")).statusCode).toBe(200);
    expect((await kirim(admin, "DELETE", `/api/pegawai/${p.id}`)).statusCode).toBe(204);
    expect((await kirim(cookie, "GET", "/api/auth/me")).statusCode).toBe(401);
    const lagi = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "999000000000000003", password: PW } });
    expect(lagi.statusCode).toBe(401);
    // pegawai nonaktif juga tidak bisa diberi akun baru
    const q = await pegawaiBaru("999000000000000004", "Fani");
    await kirim(admin, "DELETE", `/api/pegawai/${q.id}`);
    expect((await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: q.id, peran: "operator", password: PW })).statusCode).toBe(409);
  });

  it("akun sistem tanpa pegawai tetap bisa dibuat; nama akun terhubung tidak bisa diubah manual", async () => {
    const manual = await kirim(admin, "POST", "/api/admin/pengguna", { username: "sistem1", nama: "Akun Sistem", peran: "admin", password: PW });
    expect(manual.statusCode).toBe(201);
    expect(manual.json()).toMatchObject({ pegawaiId: null, nip: null });
    const p = await pegawaiBaru("999000000000000005", "Gita");
    const akun = (await kirim(admin, "POST", "/api/admin/pengguna", { pegawaiId: p.id, peran: "operator", password: PW })).json();
    const ubah = await kirim(admin, "PATCH", `/api/admin/pengguna/${akun.id}`, { nama: "Nama Lain" });
    expect(ubah.json().nama).toBe("Gita");
  });
});
