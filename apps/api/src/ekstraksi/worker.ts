import type { JenisBerkas, MimeBerkas } from "@spjan/shared";

import { AiGalat, pemakaianKosong, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import type { BerkasStore } from "../berkas/store.js";
import type { Db } from "../db.js";
import { konfigurasiAi } from "../repositories/model-ai.js";
import { bacaIsi, type IsiBerkas } from "./baca-berkas.js";
import { cariHasilSama } from "./pakai-ulang.js";
import { klasifikasiBerkas } from "./klasifikasi.js";
import { ekstrakSt } from "./st.js";
import { ekstrakHotel } from "./hotel.js";
import { ekstrakTiket } from "./tiket.js";
import { ekstrakTransport } from "./transport.js";

export type Ekstraktor = (ctx: {
  berkas: { id: number; mime: MimeBerkas; sha256: string; jenis?: JenisBerkas };
  isi: IsiBerkas;
  /** Nama pelaksana surat tugas berkas ini (bila tertaut), untuk mencocokkan penumpang tiket. */
  namaPelaksana?: string[];
  konf: KonfigurasiAi;
  klien: KlienAi;
}) => Promise<{ model: string; hasil: unknown; jenis?: JenisBerkas }>;

/** Ekstraktor cerdas: jalankan ekstraksi detail sesuai jenis berkas (ST, Hotel, Tiket, atau Transport). */
export const ekstraktorOtomatis: Ekstraktor = async ({ berkas, klien, konf, isi, namaPelaksana }) => {
  if (berkas.jenis === "st") {
    const { model, hasil } = await ekstrakSt(klien, konf, isi);
    return { model, hasil, jenis: "st" };
  }
  if (berkas.jenis === "hotel") {
    const { model, hasil } = await ekstrakHotel(klien, konf, isi);
    return { model, hasil, jenis: "hotel" };
  }
  if (berkas.jenis === "tiket") {
    const { model, hasil } = await ekstrakTiket(klien, konf, isi, { namaPelaksana });
    return { model, hasil, jenis: "tiket" };
  }
  if (berkas.jenis === "transport") {
    const { model, hasil } = await ekstrakTransport(klien, konf, isi);
    return { model, hasil, jenis: "transport" };
  }
  const { model: mKlas, hasil: hKlas } = await klasifikasiBerkas(klien, konf, isi);
  if (hKlas.jenis === "st" && ((isi.teks && isi.teks.trim().length > 0) || isi.gambar.length > 0)) {
    const { model, hasil } = await ekstrakSt(klien, konf, isi);
    return { model, hasil, jenis: "st" };
  }
  if (hKlas.jenis === "hotel") {
    const { model, hasil } = await ekstrakHotel(klien, konf, isi);
    return { model, hasil, jenis: "hotel" };
  }
  if (hKlas.jenis === "tiket") {
    const { model, hasil } = await ekstrakTiket(klien, konf, isi, { namaPelaksana });
    return { model, hasil, jenis: "tiket" };
  }
  if (hKlas.jenis === "transport") {
    const { model, hasil } = await ekstrakTransport(klien, konf, isi);
    return { model, hasil, jenis: "transport" };
  }
  return { model: mKlas, hasil: hKlas, jenis: hKlas.jenis };
};

export interface WorkerOpsi {
  db: Db;
  store: BerkasStore;
  klien: KlienAi;
  ekstrak?: Ekstraktor;
  paralel?: number;
  jedaMs?: number;
}

interface Klaim {
  id: number;
  berkasId: number;
  percobaan: number;
}

const DAPAT_DIULANG = new Set(["WAKTU_HABIS", "MODEL_TIDAK_TERSEDIA", "BATAS_PERMINTAAN"]);
const MAKS_PERCOBAAN = 2;

/** Hanya nama jenis galat yang boleh dilog; pesan/stack/properti bisa memuat isi dokumen. */
const namaGalat = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

export function bikinWorker(opsi: WorkerOpsi) {
  const { db, store, klien } = opsi;
  const ekstrak = opsi.ekstrak ?? ekstraktorOtomatis;
  const paralel = opsi.paralel ?? 2;
  const jedaMs = opsi.jedaMs ?? 2000;

  async function namaPelaksanaSt(stId: number | null): Promise<string[]> {
    if (stId === null) return [];
    const { rows } = await db.query<{ nama: string }>("select nama from pelaksana where st_id = $1 order by urutan", [stId]);
    return rows.map((r) => r.nama);
  }

  async function klaim(): Promise<Klaim | null> {
    const { rows } = await db.query<Klaim>(
      `update ekstraksi set status = 'berjalan', mulai_at = now(), percobaan = percobaan + 1
        where id = (select id from ekstraksi where status = 'antre' order by id for update skip locked limit 1)
        returning id, berkas_id as "berkasId", percobaan`,
    );
    return rows[0] ?? null;
  }

  async function proses(k: Klaim): Promise<void> {
    const mulai = Date.now();
    let model: string | null = null;
    // Semua panggilan model untuk pekerjaan ini (klasifikasi, ekstraksi, coba ulang JSON) dijumlahkan di sini.
    const pemakaian = pemakaianKosong();
    const klienHitung: KlienAi = { chat: (p) => klien.chat({ ...p, pemakaian }) };
    try {
      const { rows } = await db.query<{ id: number; mime: MimeBerkas; sha256: string; jenis: JenisBerkas; st_id: number | null }>(
        "select id, mime, sha256, jenis, st_id from berkas where id = $1",
        [k.berkasId],
      );
      const berkas = rows[0];
      if (!berkas) throw new AiGalat("BERKAS_TIDAK_TERBACA", "Berkas sudah dihapus.");
      const data = await store.get(berkas.sha256).catch(() => {
        throw new AiGalat("BERKAS_TIDAK_TERBACA", "Isi berkas tidak ada di penyimpanan.");
      });
      const konf = await konfigurasiAi(db);
      // Isi berkas yang sama persis sudah pernah diekstrak: pakai hasilnya, tanpa membaca ulang dan tanpa memanggil model.
      const dipakaiUlang = await cariHasilSama(db, berkas, konf);
      if (dipakaiUlang) console.log(`[ekstraksi] berkas=${k.berkasId} memakai hasil berkas identik (tanpa panggilan model)`);
      const hasil = dipakaiUlang ?? (await ekstrak({ berkas, isi: await bacaIsi(berkas.mime, data), konf, klien: klienHitung, namaPelaksana: await namaPelaksanaSt(berkas.st_id) }));
      model = hasil.model;
      if ("connect" in db && typeof (db as any).connect === "function") {
        const client = await (db as any).connect();
        try {
          await client.query("begin");
          await client.query(
            `update ekstraksi set status = 'selesai', model = $2, hasil = $3, kode_galat = null, galat = null, selesai_at = now()
              where id = $1`,
            [k.id, hasil.model, JSON.stringify(hasil.hasil)],
          );
          if (hasil.jenis) await client.query("update berkas set jenis = $2 where id = $1 and jenis not in ('dokumentasi', 'laporan')", [berkas.id, hasil.jenis]);
          await client.query("commit");
        } catch (txErr) {
          await client.query("rollback");
          throw txErr;
        } finally {
          client.release();
        }
      } else {
        await db.query(
          `update ekstraksi set status = 'selesai', model = $2, hasil = $3, kode_galat = null, galat = null, selesai_at = now()
            where id = $1`,
          [k.id, hasil.model, JSON.stringify(hasil.hasil)],
        );
        if (hasil.jenis) await db.query("update berkas set jenis = $2 where id = $1 and jenis not in ('dokumentasi', 'laporan')", [berkas.id, hasil.jenis]);
      }
      console.log(`[ekstraksi] berkas=${k.berkasId} model=${model} status=selesai durasi=${Date.now() - mulai}ms`);
    } catch (error) {
      const galat = error instanceof AiGalat ? error : new AiGalat("GALAT_INTERNAL", "Terjadi kesalahan saat membaca dokumen.");
      if (!(error instanceof AiGalat)) {
        console.error(`[ekstraksi] berkas=${k.berkasId} kode=GALAT_INTERNAL jenis=${namaGalat(error)} durasi=${Date.now() - mulai}ms`);
      }
      const ulang = DAPAT_DIULANG.has(galat.kode) && k.percobaan < MAKS_PERCOBAAN;
      await db.query(
        `update ekstraksi set status = $2::text, kode_galat = $3, galat = $4,
                selesai_at = case when $2::text = 'gagal' then now() else null end
          where id = $1`,
        [k.id, ulang ? "antre" : "gagal", galat.kode, galat.message],
      );
      console.warn(`[ekstraksi] berkas=${k.berkasId} status=${ulang ? "antre" : "gagal"} kode=${galat.kode} durasi=${Date.now() - mulai}ms`);
    } finally {
      // Token tetap ditagih walau ekstraksi gagal; dijumlahkan lintas percobaan.
      if (pemakaian.panggilan > 0) {
        await db
          .query(
            `update ekstraksi set token_masuk = token_masuk + $2, token_keluar = token_keluar + $3,
                    jumlah_panggilan = jumlah_panggilan + $4, model = coalesce(model, $5)
              where id = $1`,
            [k.id, pemakaian.tokenMasuk, pemakaian.tokenKeluar, pemakaian.panggilan, pemakaian.model],
          )
          .catch((error: unknown) => console.error(`[ekstraksi] berkas=${k.berkasId} gagal mencatat pemakaian jenis=${namaGalat(error)}`));
      }
    }
  }

  async function jalankanSekali(): Promise<number> {
    const diklaim: Klaim[] = [];
    for (let i = 0; i < paralel; i += 1) {
      const k = await klaim();
      if (!k) break;
      diklaim.push(k);
    }
    await Promise.allSettled(diklaim.map(proses));
    return diklaim.length;
  }

  /** Pekerjaan 'berjalan' sisa proses sebelumnya dikembalikan ke antrean (semua saat boot, atau yang macet > 10 menit). */
  async function pulihkan(semua = true): Promise<void> {
    if (semua) {
      await db.query("update ekstraksi set status = 'antre' where status = 'berjalan'");
    } else {
      await db.query("update ekstraksi set status = 'antre' where status = 'berjalan' and mulai_at < now() - interval '10 minutes'");
    }
  }

  let berhenti = false;
  let lari: Promise<void> | null = null;

  function mulai(): void {
    if (lari) return;
    berhenti = false;
    lari = (async () => {
      try {
        await pulihkan(true);
      } catch (error) {
        console.error(`[ekstraksi] pulihkan saat boot gagal jenis=${namaGalat(error)}`);
      }
      let pemulihanTerakhir = Date.now();
      while (!berhenti) {
        let n = 0;
        try {
          if (Date.now() - pemulihanTerakhir > 5 * 60 * 1000) {
            await pulihkan(false);
            pemulihanTerakhir = Date.now();
          }
          n = await jalankanSekali();
        } catch (error) {
          console.error(`[ekstraksi] putaran worker gagal jenis=${namaGalat(error)}`);
        }
        if (n === 0 && !berhenti) await new Promise((r) => setTimeout(r, jedaMs));
      }
    })();
  }

  async function henti(): Promise<void> {
    berhenti = true;
    await lari;
    lari = null;
  }

  return { jalankanSekali, pulihkan, mulai, henti };
}
