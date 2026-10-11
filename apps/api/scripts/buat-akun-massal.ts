// Membuat akun operator untuk semua pegawai aktif yang belum punya akun (username = NIP).
// Pakai: DATABASE_URL=postgres://... PASSWORD_AWAL=... npx tsx scripts/buat-akun-massal.ts [--jalankan]
// Tanpa --jalankan hanya menampilkan daftar (dry-run).
import pg from "pg";

import { buatPengguna } from "../src/repositories/pengguna.js";

const url = process.env.DATABASE_URL;
const password = process.env.PASSWORD_AWAL;
if (!url || !password) {
  console.error("DATABASE_URL dan PASSWORD_AWAL wajib diisi.");
  process.exit(1);
}
const jalankan = process.argv.includes("--jalankan");

const pool = new pg.Pool({ connectionString: url, max: 2 });
try {
  const { rows } = await pool.query<{ id: number; nama: string; nip: string }>(
    `select p.id, p.nama, p.nip from pegawai p
     where p.aktif and not exists (select 1 from users u where u.pegawai_id = p.id) order by p.nama`,
  );
  console.log(`${rows.length} pegawai aktif belum punya akun.`);
  for (const p of rows) {
    if (!jalankan) {
      console.log(`- ${p.nip}  ${p.nama}`);
      continue;
    }
    try {
      await buatPengguna(pool, { pegawaiId: p.id, peran: "operator", password });
      console.log(`dibuat: ${p.nip}  ${p.nama}`);
    } catch (e) {
      console.error(`gagal: ${p.nip}  ${p.nama}: ${(e as Error).message}`);
    }
  }
  if (!jalankan) console.log("Dry-run. Tambahkan --jalankan untuk membuat akun.");
} finally {
  await pool.end();
}
