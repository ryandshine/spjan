import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AiGalat } from "../ai/klien.js";
import { FileBerkasStore } from "../berkas/store.js";
import { closePool, pool } from "../db.js";
import { saveModelAi } from "../repositories/model-ai.js";
import { tambahBerkas } from "../repositories/berkas.js";
import { bersihkanData, klienPalsu, pdfSederhana, pngUnik } from "../test-support/helpers.js";
import { bikinWorker } from "./worker.js";

let dir: string;
let store: FileBerkasStore;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "spjan-worker-"));
  store = new FileBerkasStore(dir);
});
afterAll(async () => {
  await closePool();
  await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await bersihkanData();
  await saveModelAi(pool, { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" });
});

const hotel = '{"jenis":"hotel","ringkasan":"Invoice hotel"}';
const hotelDetail = JSON.stringify({
  namaHotel: "The Royal Alana",
  nomorInvoice: "INV-001",
  tamu: "Gunadi Firdaus",
  checkIn: "2026-09-12",
  checkOut: "2026-09-13",
  jumlahMalam: 1,
  tarifPerMalam: 850000,
  totalBiaya: 850000,
});
const tiket = '{"jenis":"tiket","ringkasan":"Tiket pesawat"}';
const tiketDetail = JSON.stringify({
  maskapai: "Garuda Indonesia",
  kodeBooking: "XYZ123",
  nomorTiket: "126-1234567890",
  penumpang: "Gunadi Firdaus",
  asal: "Jakarta (CGK)",
  tujuan: "Yogyakarta (YIA)",
  tanggal: "2026-09-12",
  tarif: 1500000,
  arah: "pergi",
});
const transport = '{"jenis":"transport","ringkasan":"Struk taksi"}';
const transportDetail = JSON.stringify({
  kategori: "taksi",
  penyedia: "Blue Bird",
  nomorKuitansi: "KUIT-01",
  tanggal: "2026-09-12",
  uraian: "Taksi Bandara ke Hotel",
  totalBiaya: 175000,
});
const lainnya = '{"jenis":"lainnya","ringkasan":"Dokumen lainnya"}';
const tambah = (data: Buffer, nama = "x") => tambahBerkas(pool, store, { stId: null, namaAsli: nama, data }).then((r) => r.dto);
const ekstraksiTerakhir = async (berkasId: number) =>
  (await pool.query("select * from ekstraksi where berkas_id = $1 order by id desc limit 1", [berkasId])).rows[0];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("worker ekstraksi", () => {
  it("log worker tidak memuat isi galat (pesan, stack, atau properti)", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    for (const s of spies) s.mockImplementation(() => undefined);
    const klien = klienPalsu(() => {
      throw new Error("rahasia internal jangan bocor");
    });
    const worker = bikinWorker({ db: pool, store, klien });
    await tambah(pngUnik(12));
    await worker.jalankanSekali();
    const semua = spies.flatMap((s) => s.mock.calls).map((args) => args.map((a) => JSON.stringify(a) + String(a)).join(" "));
    expect(semua.length).toBeGreaterThan(0);
    expect(semua.join("\n")).not.toContain("rahasia");
  });

  it("gambar: memakai model gambar, menyimpan hasil, dan mengisi jenis berkas", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? hotel : hotelDetail));
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pngUnik(1));
    expect(await worker.jalankanSekali()).toBe(1);
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e).toMatchObject({ status: "selesai", model: "m-gambar", kode_galat: null, percobaan: 1 });
    expect(e.hasil).toMatchObject({ namaHotel: "The Royal Alana", totalBiaya: 850000 });
    expect(e.selesai_at).not.toBeNull();
    expect((await pool.query("select jenis from berkas where id = $1", [berkas.id])).rows[0].jenis).toBe("hotel");
    expect(await worker.jalankanSekali()).toBe(0);
  });

  it("PDF berteks: memakai model teks dan teks dokumen masuk ke prompt", async () => {
    const validSt = JSON.stringify({
      nomor: "ST.226/PPS/2026",
      tanggal: "2026-09-08",
      kegiatan: "Tugas",
      pelaksana: [{ nama: "Resa", nip: null, jabatan: null, etape: [{ tujuan: "Bali", tanggalBerangkat: "2026-09-10", tanggalKembali: "2026-09-11" }] }],
    });
    const klien = klienPalsu((p) =>
      p.prompt.includes("pelaksana") ? validSt : '{"jenis":"st","ringkasan":"Surat tugas"}',
    );
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pdfSederhana("SURAT TUGAS Nomor ST.226 Direktur Pengendalian Perhutanan Sosial memberi tugas"));
    await worker.jalankanSekali();
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e.status).toBe("selesai");
    expect(e.model).toBe("m-teks");
    expect(e.hasil).toMatchObject({ nomor: "ST.226/PPS/2026" });
    expect(klien.panggilan[0]?.prompt).toContain("ST.226");
  });

  it("model gambar belum diatur: gagal MODEL_BELUM_DIATUR tanpa ulang", async () => {
    await saveModelAi(pool, { llmUrl: null, modelTeks: "m-teks", modelGambar: null });
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel) });
    const berkas = await tambah(pngUnik(2));
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "gagal", kode_galat: "MODEL_BELUM_DIATUR", percobaan: 1 });
  });

  it("MODEL_TIDAK_TERSEDIA dijadwalkan ulang sekali, lalu gagal", async () => {
    const klien = klienPalsu(() => {
      throw new AiGalat("MODEL_TIDAK_TERSEDIA", "Ollama tidak terjangkau.");
    });
    const worker = bikinWorker({ db: pool, store, klien, paralel: 1 });
    const berkas = await tambah(pngUnik(3));
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "antre", percobaan: 1 });
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "gagal", kode_galat: "MODEL_TIDAK_TERSEDIA", percobaan: 2 });
  });

  it("galat tak terduga menjadi GALAT_INTERNAL dengan pesan umum (tanpa membocorkan detail)", async () => {
    const klien = klienPalsu(() => {
      throw new Error("rahasia internal jangan bocor");
    });
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pngUnik(4));
    await worker.jalankanSekali();
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e).toMatchObject({ status: "gagal", kode_galat: "GALAT_INTERNAL" });
    expect(e.galat).not.toContain("rahasia");
  });

  it("isi berkas hilang dari penyimpanan menjadi BERKAS_TIDAK_TERBACA", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel) });
    const berkas = await tambah(pngUnik(5));
    await store.delete(berkas.sha256);
    await worker.jalankanSekali();
    expect(await ekstraksiTerakhir(berkas.id)).toMatchObject({ status: "gagal", kode_galat: "BERKAS_TIDAK_TERBACA" });
  });

  it("memproses sampai `paralel` pekerjaan per putaran", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => hotel), paralel: 2 });
    for (const n of [6, 7, 8]) await tambah(pngUnik(n));
    expect(await worker.jalankanSekali()).toBe(2);
    expect(await worker.jalankanSekali()).toBe(1);
    expect(await worker.jalankanSekali()).toBe(0);
  });

  it("tiket: otomatis menjalankan ekstrakTiket bila klasifikasi berkas adalah tiket", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? tiket : tiketDetail));
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pngUnik(90));
    expect(await worker.jalankanSekali()).toBe(1);
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e).toMatchObject({ status: "selesai", model: "m-gambar", kode_galat: null });
    expect(e.hasil).toMatchObject({ maskapai: "Garuda Indonesia", tarif: 1500000 });
  });

  it("transport: otomatis menjalankan ekstrakTransport bila klasifikasi berkas adalah transport", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? transport : transportDetail));
    const worker = bikinWorker({ db: pool, store, klien });
    const berkas = await tambah(pngUnik(91));
    expect(await worker.jalankanSekali()).toBe(1);
    const e = await ekstraksiTerakhir(berkas.id);
    expect(e).toMatchObject({ status: "selesai", model: "m-gambar", kode_galat: null });
    expect(e.hasil).toMatchObject({ kategori: "taksi", totalBiaya: 175000 });
  });

  it("pulihkan mengembalikan pekerjaan 'berjalan' yang macet ke antrean", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => lainnya) });
    const berkas = await tambah(pngUnik(9));
    await pool.query("update ekstraksi set status = 'berjalan' where berkas_id = $1", [berkas.id]);
    expect(await worker.jalankanSekali()).toBe(0);
    await worker.pulihkan();
    expect((await ekstraksiTerakhir(berkas.id)).status).toBe("antre");
    expect(await worker.jalankanSekali()).toBe(1);
  });

  it("dua worker tidak memproses pekerjaan yang sama (SKIP LOCKED)", async () => {
    const klien = klienPalsu(() => lainnya);
    const a = bikinWorker({ db: pool, store, klien, paralel: 1 });
    const b = bikinWorker({ db: pool, store, klien, paralel: 1 });
    await tambah(pngUnik(10));
    const [x, y] = await Promise.all([a.jalankanSekali(), b.jalankanSekali()]);
    expect(x + y).toBe(1);
    expect(klien.panggilan).toHaveLength(1);
  });

  it("mulai/henti menjalankan putaran latar dan berhenti bersih", async () => {
    const worker = bikinWorker({ db: pool, store, klien: klienPalsu(() => lainnya), jedaMs: 20 });
    const berkas = await tambah(pngUnik(11));
    worker.mulai();
    for (let i = 0; i < 100 && (await ekstraksiTerakhir(berkas.id)).status !== "selesai"; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    await worker.henti();
    expect((await ekstraksiTerakhir(berkas.id)).status).toBe("selesai");
  });
});
