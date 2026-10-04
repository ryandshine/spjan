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
    for (const tabel of ["biaya", "etape", "pegawai", "pelaksana", "pengaturan", "pgmigrations", "sbm_versi", "sessions", "surat_tugas", "users"]) {
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
});
