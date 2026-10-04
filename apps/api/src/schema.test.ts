import { afterAll, describe, expect, it } from "vitest";

import { closePool, pool } from "./db.js";
import { seedSbm } from "./seed.js";

afterAll(async () => {
  await closePool();
});

describe("skema basis data", () => {
  it("semua tabel tersedia setelah migrasi", async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    const nama = rows.map((r) => r.table_name);
    for (const tabel of ["berkas", "biaya", "ekstraksi", "etape", "model_ai", "pegawai", "pelaksana", "pengaturan", "pgmigrations", "sbm_versi", "sessions", "surat_tugas", "users"]) {
      expect(nama, tabel).toContain(tabel);
    }
  });

  it("baris pengaturan tunggal tersedia dengan nilai awal", async () => {
    const { rows } = await pool.query("select kota_kedudukan, provinsi_kedudukan, tahun_anggaran from pengaturan");
    expect(rows).toEqual([{ kota_kedudukan: "Jakarta", provinsi_kedudukan: "D.K.I. JAKARTA", tahun_anggaran: 2026 }]);
  });

  it("seed SBM idempoten", async () => {
    await seedSbm(pool);
    expect(await seedSbm(pool)).toBe(false);
    const { rows } = await pool.query("select count(*)::int as n from sbm_versi where tahun_anggaran = 2026");
    expect(rows[0].n).toBe(1);
  });

  it("baris model_ai tunggal berisi model teks bawaan dan URL kosong", async () => {
    const { rows } = await pool.query("select llm_url, model_teks, model_gambar from model_ai");
    expect(rows).toEqual([{ llm_url: null, model_teks: "gpt-oss:120b-cloud", model_gambar: null }]);
  });

  it("berkas unik per ST+sha256, termasuk saat st_id kosong", async () => {
    await pool.query("insert into berkas (nama_asli, mime, ukuran, sha256) values ('a.png','image/png',1,'aa')");
    await expect(
      pool.query("insert into berkas (nama_asli, mime, ukuran, sha256) values ('b.png','image/png',1,'aa')"),
    ).rejects.toMatchObject({ code: "23505" });
    await pool.query("delete from berkas");
  });
});
