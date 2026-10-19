import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { closePool } from "./db.js";
import { bersihkanData, loginCookie, siapkanApp } from "./test-support/helpers.js";

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

const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe("naskah surat tugas api", () => {
  const dummyPayload = {
    nomor: "${nomor_naskah}",
    modeNomor: "srikandi" as const,
    tanggal: null,
    tempatNaskah: "Jakarta",
    maksudTugas: "Rapat Koordinasi Perhutanan Sosial di Jawa Barat",
    lokasiTugas: "Kota Bandung, Jawa Barat",
    tanggalMulai: "2026-10-20",
    tanggalSelesai: "2026-10-22",
    lamaHari: 3,
    dasarHukum: ["Dasar hukum 1", "Dasar hukum 2"],
    dasarSpesifik: "Undangan No. 123 tanggal 15 Oktober 2026",
    pelaporanHari: 5,
    pembebananAnggaran: "DIPA Kantor Pusat 2026",
    penandatanganJabatan: "Direktur Pengendalian Perhutanan Sosial,",
    penandatanganNama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
    penandatanganNip: "196810191998031001",
    tembusan: ["Sekretaris Ditjen PS", "Yang Bersangkutan"],
    pelaksana: [
      { nama: "Sukardi, S.Hut., M.Si.", nip: "197501012000031001", jabatan: "PEH Ahli Madya" },
      { nama: "Irwan Hermawan, S.Hut., M.Si.", nip: "198002022005011002", jabatan: "PEH Ahli Muda" },
    ],
  };

  it("membuat dan mengambil detail naskah ST", async () => {
    const res = await call("POST", "/api/naskah-st", dummyPayload);
    expect(res.statusCode).toBe(201);
    const dto = res.json();
    expect(dto.id).toBeGreaterThan(0);
    expect(dto.maksudTugas).toBe(dummyPayload.maksudTugas);
    expect(dto.pelaksana.length).toBe(2);

    const getRes = await call("GET", `/api/naskah-st/${dto.id}`);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().lokasiTugas).toBe(dummyPayload.lokasiTugas);
  });

  it("menampilkan daftar ringkas naskah ST", async () => {
    await call("POST", "/api/naskah-st", dummyPayload);
    const listRes = await call("GET", "/api/naskah-st");
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].jumlahPelaksana).toBe(2);
  });

  it("memperbarui naskah ST dengan PUT", async () => {
    const createRes = await call("POST", "/api/naskah-st", dummyPayload);
    const id = createRes.json().id;

    const updatePayload = {
      ...dummyPayload,
      lokasiTugas: "Kota Cirebon, Jawa Barat",
      lamaHari: 2,
    };
    const putRes = await call("PUT", `/api/naskah-st/${id}`, updatePayload);
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().lokasiTugas).toBe("Kota Cirebon, Jawa Barat");
  });

  it("mengunduh berkas DOCX naskah ST", async () => {
    const createRes = await call("POST", "/api/naskah-st", dummyPayload);
    const id = createRes.json().id;

    const docxRes = await call("GET", `/api/naskah-st/${id}/docx`);
    expect(docxRes.statusCode).toBe(200);
    expect(docxRes.headers["content-type"]).toContain("officedocument.wordprocessingml.document");
    expect(docxRes.rawPayload.length).toBeGreaterThan(1000);
  });

  it("membuat SPJ otomatis dari naskah ST", async () => {
    const createRes = await call("POST", "/api/naskah-st", dummyPayload);
    const id = createRes.json().id;

    const spjRes = await call("POST", `/api/naskah-st/${id}/buat-spj`);
    expect(spjRes.statusCode).toBe(201);
    const { spjId } = spjRes.json();
    expect(spjId).toBeGreaterThan(0);

    // Periksa bahwa SPJ telah dibuat di modul keuangan
    const getSpj = await call("GET", `/api/surat-tugas/${spjId}`);
    expect(getSpj.statusCode).toBe(200);
    expect(getSpj.json().pelaksana.length).toBe(2);
    expect(getSpj.json().pelaksana[0].nama).toBe("Sukardi, S.Hut., M.Si.");
    expect(getSpj.json().pelaksana[0].etape[0].kota).toBe(dummyPayload.lokasiTugas);

    // Periksa bahwa naskah ST tertaut ke SPJ ID
    const getNaskah = await call("GET", `/api/naskah-st/${id}`);
    expect(getNaskah.json().spjId).toBe(spjId);
  });

  it("menghapus naskah ST", async () => {
    const createRes = await call("POST", "/api/naskah-st", dummyPayload);
    const id = createRes.json().id;

    const delRes = await call("DELETE", `/api/naskah-st/${id}`);
    expect(delRes.statusCode).toBe(204);

    const getRes = await call("GET", `/api/naskah-st/${id}`);
    expect(getRes.statusCode).toBe(404);
  });
});
