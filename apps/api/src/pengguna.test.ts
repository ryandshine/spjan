import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { closePool, pool } from "./db.js";
import { bersihkanData, loginCookie, siapkanApp, stResa } from "./test-support/helpers.js";

let app: FastifyInstance;
let admin: string;
let ani: { id: number; cookie: string };
let budi: { id: number; cookie: string };
beforeAll(async () => {
  app = await siapkanApp();
  await pool.query("delete from users where username <> 'admin'");
  admin = await loginCookie(app);
  // Login dibatasi 10/menit, jadi operator dibuat dan login sekali saja untuk seluruh berkas tes.
  ani = await buatOperator("ani");
  budi = await buatOperator("budi");
});
afterAll(async () => {
  await pool.query("delete from users where username <> 'admin'");
  await app.close();
  await closePool();
});
beforeEach(bersihkanData);

const PW = "sandi-operator-1";
const kirim = (cookie: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function buatOperator(username: string): Promise<{ id: number; cookie: string }> {
  const res = await kirim(admin, "POST", "/api/admin/pengguna", { username, nama: `Operator ${username}`, peran: "operator", password: PW });
  expect(res.statusCode).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PW } });
  expect(login.statusCode).toBe(200);
  const raw = login.headers["set-cookie"];
  return { id: res.json().id, cookie: (Array.isArray(raw) ? raw[0] : raw)!.split(";")[0]! };
}

describe("pengguna dan peran", () => {
  it("admin membuat operator; login mengembalikan peran; username ganda 409", async () => {
    expect((await kirim(budi.cookie, "GET", "/api/auth/me")).json()).toMatchObject({ username: "budi", peran: "operator" });
    const lagi = await kirim(admin, "POST", "/api/admin/pengguna", { username: "budi", nama: "B", peran: "operator", password: PW });
    expect(lagi.statusCode).toBe(409);
    expect((await kirim(admin, "POST", "/api/admin/pengguna", { username: "x", nama: "B", peran: "operator", password: "pendek" })).statusCode).toBe(400);
  });

  it("operator tidak bisa mengelola pengguna, tempat sampah, audit, dan pengaturan", async () => {
    const op = budi;
    for (const [m, u] of [
      ["GET", "/api/admin/pengguna"],
      ["GET", "/api/admin/audit"],
      ["GET", "/api/sampah"],
    ] as const) {
      expect((await kirim(op.cookie, m, u)).statusCode, u).toBe(403);
    }
    const pengaturan = (await kirim(op.cookie, "GET", "/api/pengaturan")).json();
    expect((await kirim(op.cookie, "PUT", "/api/pengaturan", pengaturan)).statusCode).toBe(403);
    expect((await kirim(admin, "PUT", "/api/pengaturan", pengaturan)).statusCode).toBe(200);
  });

  it("admin terakhir tidak bisa diturunkan atau dinonaktifkan", async () => {
    const { rows } = await pool.query<{ id: number }>("select id from users where username = 'admin'");
    const id = rows[0]!.id;
    expect((await kirim(admin, "PATCH", `/api/admin/pengguna/${id}`, { peran: "operator" })).statusCode).toBe(409);
    expect((await kirim(admin, "PATCH", `/api/admin/pengguna/${id}`, { aktif: false })).statusCode).toBe(409);
  });

  it("menonaktifkan akun mencabut sesinya dan menolak login baru", async () => {
    const op = await buatOperator("sementara1");
    expect((await kirim(admin, "PATCH", `/api/admin/pengguna/${op.id}`, { aktif: false })).statusCode).toBe(200);
    expect((await kirim(op.cookie, "GET", "/api/auth/me")).statusCode).toBe(401);
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "sementara1", password: PW } });
    expect(login.statusCode).toBe(401);
  });

  it("reset password oleh admin dan ganti password sendiri", async () => {
    const op = await buatOperator("sementara2");
    expect((await kirim(admin, "POST", `/api/admin/pengguna/${op.id}/reset-password`, { password: "sandi-baru-9999" })).statusCode).toBe(204);
    expect((await kirim(op.cookie, "GET", "/api/auth/me")).statusCode).toBe(401);
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "sementara2", password: "sandi-baru-9999" } });
    const raw = login.headers["set-cookie"];
    const cookie = (Array.isArray(raw) ? raw[0] : raw)!.split(";")[0]!;
    expect((await kirim(cookie, "POST", "/api/auth/ganti-password", { passwordLama: "salah-salah", passwordBaru: "sandi-lain-12345" })).statusCode).toBe(403);
    expect((await kirim(cookie, "POST", "/api/auth/ganti-password", { passwordLama: "sandi-baru-9999", passwordBaru: "sandi-lain-12345" })).statusCode).toBe(204);
    expect((await kirim(cookie, "GET", "/api/auth/me")).statusCode).toBe(200);
  });
});

describe("kepemilikan surat tugas", () => {
  it("operator hanya mengubah miliknya; operator lain 403; admin boleh semua", async () => {
    const a = ani;
    const b = budi;
    const dto = (await kirim(a.cookie, "POST", "/api/surat-tugas", stResa)).json();
    expect(dto).toMatchObject({ dibuatOleh: a.id, dibuatOlehNama: "Operator ani" });
    // operator lain boleh melihat
    expect((await kirim(b.cookie, "GET", `/api/surat-tugas/${dto.id}`)).statusCode).toBe(200);
    expect((await kirim(b.cookie, "GET", "/api/surat-tugas")).json()).toHaveLength(1);
    const ubah = { ...stResa, nomor: "UBAH" };
    const tolak = await kirim(b.cookie, "PUT", `/api/surat-tugas/${dto.id}`, ubah);
    expect(tolak.statusCode).toBe(403);
    expect(tolak.json().pesan).toContain("Operator ani");
    expect((await kirim(b.cookie, "POST", `/api/surat-tugas/${dto.id}/kunci`)).statusCode).toBe(403);
    expect((await kirim(b.cookie, "DELETE", `/api/surat-tugas/${dto.id}`, { password: PW })).statusCode).toBe(403);
    expect((await kirim(b.cookie, "PUT", `/api/surat-tugas/${dto.id}/laporan`, { versi: 2, bagian: [] })).statusCode).toBe(403);
    expect((await kirim(a.cookie, "PUT", `/api/surat-tugas/${dto.id}`, ubah)).statusCode).toBe(200);
    expect((await kirim(admin, "PUT", `/api/surat-tugas/${dto.id}`, { ...stResa, nomor: "ADMIN" })).statusCode).toBe(200);
  });

  it("buka kunci butuh alasan dan password sendiri, dan tercatat di audit", async () => {
    const a = ani;
    const { id } = (await kirim(a.cookie, "POST", "/api/surat-tugas", stResa)).json();
    await kirim(a.cookie, "POST", `/api/surat-tugas/${id}/kunci`);
    const buka = (body: unknown) => kirim(a.cookie, "POST", `/api/surat-tugas/${id}/buka-kunci`, body);
    expect((await buka({ password: PW })).statusCode).toBe(400);
    expect((await buka({ password: PW, alasan: "abc" })).statusCode).toBe(400);
    expect((await buka({ password: "salah", alasan: "revisi nominal" })).statusCode).toBe(403);
    expect((await kirim(admin, "GET", `/api/surat-tugas/${id}`)).json().status).toBe("final");
    const ok = await buka({ password: PW, alasan: "revisi nominal tiket" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: "draft", jumlahDibuka: 1 });
    const audit = (await kirim(admin, "GET", `/api/admin/audit?stId=${id}`)).json() as { aksi: string; username: string; alasan: string | null }[];
    expect(audit.map((x) => x.aksi)).toEqual(["st.buka_kunci", "st.kunci", "st.buat"]);
    expect(audit[0]).toMatchObject({ username: "ani", alasan: "revisi nominal tiket" });
  });
});

describe("tempat sampah", () => {
  it("hapus butuh password, menyembunyikan ST, admin bisa memulihkan; ST final tidak bisa dihapus", async () => {
    const a = ani;
    const { id } = (await kirim(a.cookie, "POST", "/api/surat-tugas", stResa)).json();
    expect((await kirim(a.cookie, "DELETE", `/api/surat-tugas/${id}`, { password: "salah" })).statusCode).toBe(403);
    expect((await kirim(a.cookie, "DELETE", `/api/surat-tugas/${id}`, { password: PW })).statusCode).toBe(204);
    expect((await kirim(a.cookie, "GET", `/api/surat-tugas/${id}`)).statusCode).toBe(404);
    expect((await kirim(a.cookie, "GET", "/api/surat-tugas")).json()).toEqual([]);
    const sampah = (await kirim(admin, "GET", "/api/sampah")).json();
    expect(sampah.suratTugas).toEqual([expect.objectContaining({ id, dihapusOleh: "Operator ani" })]);
    expect((await kirim(a.cookie, "POST", `/api/sampah/surat-tugas/${id}/pulihkan`)).statusCode).toBe(403);
    expect((await kirim(admin, "POST", `/api/sampah/surat-tugas/${id}/pulihkan`)).statusCode).toBe(204);
    expect((await kirim(a.cookie, "GET", `/api/surat-tugas/${id}`)).statusCode).toBe(200);
    await kirim(a.cookie, "POST", `/api/surat-tugas/${id}/kunci`);
    expect((await kirim(a.cookie, "DELETE", `/api/surat-tugas/${id}`, { password: PW })).statusCode).toBe(409);
    const aksi = ((await kirim(admin, "GET", `/api/admin/audit?stId=${id}`)).json() as { aksi: string }[]).map((x) => x.aksi);
    expect(aksi).toEqual(expect.arrayContaining(["st.hapus", "st.pulihkan", "st.kunci"]));
  });
});
