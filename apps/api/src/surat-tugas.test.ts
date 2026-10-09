import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { closePool, pool } from "./db.js";
import { bersihkanData, loginCookie, siapkanApp, stResa } from "./test-support/helpers.js";

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

describe("surat tugas", () => {
  it("menyimpan dan membaca kembali pohon yang sama persis", async () => {
    const res = await call("POST", "/api/surat-tugas", stResa);
    expect(res.statusCode).toBe(201);
    const dto = res.json();
    expect(dto.id).toBeGreaterThan(0);
    expect(dto.versiSbmId).toBeGreaterThan(0);
    const { id, versiSbmId, createdAt, updatedAt, status, dikunciPada, dibukaPada, jumlahDibuka, ...isi } = dto;
    expect({ status, dikunciPada, dibukaPada, jumlahDibuka }).toEqual({ status: "draft", dikunciPada: null, dibukaPada: null, jumlahDibuka: 0 });
    expect(isi).toEqual({
      ...stResa,
      pelaksana: stResa.pelaksana.map((p) => ({ ...p, pangkatGolongan: "", instansi: "Direktorat Pengendalian Perhutanan Sosial" })),
    });
    expect(typeof createdAt).toBe("string");
    expect(typeof updatedAt).toBe("string");
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().versiSbmId).toBe(versiSbmId);
  });

  it("hasil memakai mesin hitung bersama: Resa total Rp6.965.979", async () => {
    const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
    const res = await call("GET", `/api/surat-tugas/${id}/hasil`);
    expect(res.statusCode).toBe(200);
    const { hasil, pengaturan, suratTugas } = res.json();
    expect(suratTugas.id).toBe(id);
    expect(pengaturan.kotaKedudukan).toBe("Jakarta");
    expect(hasil.total).toBe(6_965_979);
    expect(hasil.pelaksana[0].terbilang).toBe(
      "Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah",
    );
    expect(hasil.pelaksana[0].transport.map((r: { uraian: string }) => r.uraian)).toEqual([
      "Tiket Pesawat Jakarta ke Denpasar",
      "Tiket Pesawat Denpasar ke Jakarta",
      "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)",
    ]);
    expect(hasil.teksTanggalSt).toBe("8 September 2026");
  });

  it("PUT mengganti seluruh pohon dan memperbarui hasil", async () => {
    const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
    const tanpaBiaya = { ...stResa, pelaksana: [{ ...stResa.pelaksana[0], biaya: [] }] };
    const put = await call("PUT", `/api/surat-tugas/${id}`, tanpaBiaya);
    expect(put.statusCode).toBe(200);
    expect(put.json().pelaksana[0].biaya).toEqual([]);
    expect((await call("GET", `/api/surat-tugas/${id}/hasil`)).json().hasil.total).toBe(960_000 + 1_021_948);
    const { rows } = await pool.query("select count(*)::int as n from biaya");
    expect(rows[0].n).toBe(0);
  });

  it("draf dengan tanggal kosong tersimpan dan menghasilkan peringatan", async () => {
    const draf = {
      ...stResa,
      pelaksana: [{ ...stResa.pelaksana[0], etape: [{ ...stResa.pelaksana[0]!.etape[0], berangkat: "", pulang: "" }], biaya: [] }],
    };
    const { id } = (await call("POST", "/api/surat-tugas", draf)).json();
    const kode = (await call("GET", `/api/surat-tugas/${id}/hasil`)).json().hasil.pelaksana[0].peringatan.map((p: { kode: string }) => p.kode);
    expect(kode).toContain("DATA_BELUM_LENGKAP");
  });

  it("daftar memuat total dan jumlah peringatan yang sama dengan /hasil", async () => {
    const lengkap = (await call("POST", "/api/surat-tugas", stResa)).json();
    const draf = (
      await call("POST", "/api/surat-tugas", {
        ...stResa,
        nomor: "ST.DRAF/1",
        pelaksana: [{ ...stResa.pelaksana[0], etape: [{ ...stResa.pelaksana[0]!.etape[0], berangkat: "", pulang: "" }], biaya: [] }],
      })
    ).json();
    const daftar = (await call("GET", "/api/surat-tugas")).json();
    for (const { id } of [lengkap, draf]) {
      const { hasil } = (await call("GET", `/api/surat-tugas/${id}/hasil`)).json();
      const baris = daftar.find((d: { id: number }) => d.id === id);
      expect(baris.total).toBe(hasil.total);
      expect(baris.jumlahPeringatan).toBe(hasil.pelaksana.reduce((n: number, p: { peringatan: unknown[] }) => n + p.peringatan.length, 0));
    }
    expect(daftar.find((d: { id: number }) => d.id === draf.id).jumlahPeringatan).toBeGreaterThan(0);
  });

  it("daftar, hapus (cascade), dan galat 404/400", async () => {
    const { id } = (await call("POST", "/api/surat-tugas", stResa)).json();
    const daftar = (await call("GET", "/api/surat-tugas")).json();
    expect(daftar).toEqual([expect.objectContaining({ id, nomor: stResa.nomor, jumlahPelaksana: 1 })]);
    expect((await call("DELETE", `/api/surat-tugas/${id}`)).statusCode).toBe(204);
    for (const tabel of ["pelaksana", "etape", "biaya"]) {
      const { rows } = await pool.query(`select count(*)::int as n from ${tabel}`);
      expect(rows[0].n, tabel).toBe(0);
    }
    expect((await call("GET", `/api/surat-tugas/${id}`)).statusCode).toBe(404);
    expect((await call("PUT", `/api/surat-tugas/${id}`, stResa)).statusCode).toBe(404);
    expect((await call("POST", "/api/surat-tugas", { ...stResa, tanggal: "8/9/2026" })).statusCode).toBe(400);
  });

  it("versi SBM di-pin saat dibuat dan tidak berubah oleh versi baru", async () => {
    const { id, versiSbmId } = (await call("POST", "/api/surat-tugas", stResa)).json();
    await pool.query(
      "insert into sbm_versi (tahun_anggaran, dasar_hukum, aktif, data) select 2027, 'Uji', true, data from sbm_versi limit 1",
    );
    expect((await call("GET", `/api/surat-tugas/${id}`)).json().versiSbmId).toBe(versiSbmId);
    const baru = (await call("POST", "/api/surat-tugas", stResa)).json();
    expect(baru.versiSbmId).not.toBe(versiSbmId);
    await pool.query("delete from surat_tugas");
    await pool.query("delete from sbm_versi where dasar_hukum = 'Uji'");
  });

  it("POST dengan ?berkasId menautkan berkas ke surat tugas baru", async () => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into berkas (nama_asli, mime, ukuran, sha256, jenis) values ('st.pdf', 'application/pdf', 100, 'abcd1234abcd1234', 'st') returning id",
    );
    const berkasId = rows[0]?.id;
    const res = await call("POST", `/api/surat-tugas?berkasId=${berkasId}`, stResa);
    expect(res.statusCode).toBe(201);
    const stId = res.json().id;

    const { rows: rBerkas } = await pool.query<{ st_id: number }>("select st_id from berkas where id = $1", [berkasId]);
    expect(rBerkas[0]?.st_id).toBe(stId);
  });

  it("GET /:id/usulan-hotel mengembalikan daftar usulan hotel yang cocok", async () => {
    const stId = (await call("POST", "/api/surat-tugas", stResa)).json().id as number;
    const { rows: rBerkas } = await pool.query<{ id: number }>(
      "insert into berkas (st_id, nama_asli, mime, ukuran, sha256, jenis) values ($1, 'hotel.jpg', 'image/jpeg', 100, 'aaaa1111bbbb2222cccc3333dddd4444', 'hotel') returning id",
      [stId],
    );
    const bId = rBerkas[0]?.id;
    const hasilHotel = {
      namaHotel: "The Royal Alana",
      nomorInvoice: "INV-123",
      tamu: "Resa Adam",
      checkIn: "2026-09-10",
      checkOut: "2026-09-11",
      jumlahMalam: 1,
      tarifPerMalam: 850000,
      totalBiaya: 850000,
    };
    await pool.query(
      "insert into ekstraksi (berkas_id, status, model, hasil, selesai_at) values ($1, 'selesai', 'gemma4:cloud', $2, now())",
      [bId, JSON.stringify(hasilHotel)],
    );

    const res = await call("GET", `/api/surat-tugas/${stId}/usulan-hotel`);
    expect(res.statusCode).toBe(200);
    const usulan = res.json();
    expect(usulan).toHaveLength(1);
    expect(usulan[0].namaBerkas).toBe("hotel.jpg");
    expect(usulan[0].tarifRiilPerMalam).toBe(850000);
    expect(usulan[0].pelaksanaNama).toContain("Resa Adam");
  });

  it("GET /:id/usulan-transport mengembalikan usulan tiket dan transportasi", async () => {
    const stId = (await call("POST", "/api/surat-tugas", stResa)).json().id as number;
    const { rows: rBerkas } = await pool.query<{ id: number }>(
      "insert into berkas (st_id, nama_asli, mime, ukuran, sha256, jenis) values ($1, 'tiket_garuda.pdf', 'application/pdf', 100, 'ffff1111bbbb2222cccc3333dddd4444', 'tiket') returning id",
      [stId],
    );
    const bId = rBerkas[0]?.id;
    const hasilTiket = {
      maskapai: "Garuda Indonesia",
      kodeBooking: "XYZ999",
      nomorTiket: "126-1122334455",
      penumpang: "Resa Adam",
      asal: "Jakarta (CGK)",
      tujuan: "Denpasar (DPS)",
      tanggal: "2026-09-10",
      tarif: 1650000,
      arah: "pergi",
    };
    await pool.query(
      "insert into ekstraksi (berkas_id, status, model, hasil, selesai_at) values ($1, 'selesai', 'gpt-oss:120b-cloud', $2, now())",
      [bId, JSON.stringify(hasilTiket)],
    );

    const res = await call("GET", `/api/surat-tugas/${stId}/usulan-transport`);
    expect(res.statusCode).toBe(200);
    const usulan = res.json();
    expect(usulan).toHaveLength(1);
    expect(usulan[0].namaBerkas).toBe("tiket_garuda.pdf");
    expect(usulan[0].jenisBiaya).toBe("TIKET_PERGI");
    expect(usulan[0].tarifRiil).toBe(1650000);
    expect(usulan[0].pelaksanaNama).toContain("Resa Adam");
  });
});


