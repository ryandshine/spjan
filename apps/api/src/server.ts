import { klienAi } from "./ai/pilih.js";
import { buildApp } from "./app.js";
import { ensureAdmin, purgeExpiredSessions } from "./auth.js";
import { config } from "./config.js";
import { FileBerkasStore } from "./berkas/store.js";
import { closePool, pool } from "./db.js";
import { bikinWorker } from "./ekstraksi/worker.js";
import { runMigrations } from "./migrate.js";
import { seedSbm } from "./seed.js";

function tunggu(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ulangi tugas sampai STARTUP_DB_MAX_RETRIES agar container yang start sebelum Postgres siap tidak crash-loop. */
async function denganRetry(nama: string, tugas: () => Promise<unknown>): Promise<void> {
  for (let percobaan = 0; ; percobaan += 1) {
    try {
      await tugas();
      return;
    } catch (error) {
      if (percobaan >= config.STARTUP_DB_MAX_RETRIES) throw error;
      console.error(`[startup] ${nama} gagal (percobaan ${percobaan + 1}), mengulang...`, (error as Error).message);
      await tunggu(config.STARTUP_DB_RETRY_DELAY_MS);
    }
  }
}

async function start() {
  await denganRetry("migrasi database", () => runMigrations(config.DATABASE_URL));
  await seedSbm(pool);
  if (await ensureAdmin(pool)) console.log("[startup] akun pertama dibuat dari ADMIN_USERNAME/ADMIN_PASSWORD");
  const { rows: pengguna } = await pool.query<{ n: number }>("select count(*)::int as n from users");
  if ((pengguna[0]?.n ?? 0) === 0) {
    console.warn("[startup] PERINGATAN: belum ada akun. Isi ADMIN_USERNAME dan ADMIN_PASSWORD lalu mulai ulang api.");
  }
  await purgeExpiredSessions(pool);
  const store = new FileBerkasStore(config.BERKAS_DIR);
  const app = await buildApp(pool, { store, klien: klienAi });
  const worker = bikinWorker({ db: pool, store, klien: klienAi });
  worker.mulai();
  await app.listen({ host: config.HOST, port: config.PORT });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await worker.henti();
      await app.close();
      await closePool();
      process.exit(0);
    });
  }
}

// Penolakan promise yang terlewat dicatat saja; satu galat sesaat tidak boleh mematikan layanan.
process.on("unhandledRejection", (alasan) => {
  console.error("[proses] unhandledRejection:", alasan);
});

// Setelah uncaughtException keadaan proses tidak bisa dipercaya (sumber daya setengah jadi),
// jadi catat lalu keluar dengan kode 1 agar container di-restart bersih oleh orkestrator.
process.on("uncaughtException", (error) => {
  console.error("[proses] uncaughtException, proses dihentikan:", error);
  process.exit(1);
});

start().catch((error) => {
  console.error("aplikasi gagal start", error);
  process.exit(1);
});
