// Versi untuk dijalankan DI DALAM kontainer API produksi (DATABASE_URL sudah ada di lingkungan kontainer,
// dan nama host database hanya bisa dijangkau dari jaringan Docker). Tidak perlu tsx atau kode sumber.
// Pakai (dari mesin server Docker):
//   docker exec -i -e PASSWORD_AWAL=1234567890 NAMA_KONTAINER node --input-type=module - < buat-akun-massal-container.mjs
//   (tambahkan -e JALANKAN=1 untuk benar-benar membuat akun; tanpa itu hanya dry-run)
const password = process.env.PASSWORD_AWAL;
if (!password) {
  console.error("PASSWORD_AWAL wajib diisi.");
  process.exit(1);
}
const jalankan = process.env.JALANKAN === "1";

const { pool } = await import("/app/apps/api/dist/db.js");
const { buatPengguna } = await import("/app/apps/api/dist/repositories/pengguna.js");

try {
  const { rows } = await pool.query(
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
      console.error(`gagal: ${p.nip}  ${p.nama}: ${e.message}`);
    }
  }
  if (!jalankan) console.log("Dry-run. Tambahkan -e JALANKAN=1 untuk membuat akun.");
} finally {
  await pool.end();
}
