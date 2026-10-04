import { describe, expect, it } from "vitest";
import { SuratTugasPayloadSchema } from "./schemas.js";
import {
  biayaKosong,
  etapeKosong,
  indeksBarisTransport,
  jenisButuhEtape,
  jenisButuhProvinsi,
  jenisButuhUraian,
  pelaksanaDariPegawai,
  payloadDariDto,
  pelaksanaKosong,
  ringkasEtape,
  stKosong,
} from "./st-model.js";

describe("nilai awal", () => {
  it("stKosong dan pelaksanaKosong lolos skema (draf boleh kosong)", () => {
    const st = { ...stKosong("7288.QDD.001.052.A.524111"), nomor: "ST.1", tanggal: "2026-09-08", pelaksana: [pelaksanaKosong()] };
    // nama pelaksana wajib terisi saat disimpan
    expect(SuratTugasPayloadSchema.safeParse(st).success).toBe(false);
    st.pelaksana[0]!.nama = "A";
    expect(SuratTugasPayloadSchema.safeParse(st).success).toBe(true);
  });

  it("biayaKosong dan etapeKosong", () => {
    expect(biayaKosong("TIKET_PERGI")).toMatchObject({ jenis: "TIKET_PERGI", tarif: 0, qty: null, etapeIndex: null });
    expect(etapeKosong()).toMatchObject({ berangkat: "", pulang: "", dinasJabatan: false });
    expect(pelaksanaKosong().etape).toHaveLength(1);
  });
});

describe("klasifikasi jenis biaya", () => {
  it("provinsi, etape, dan uraian", () => {
    expect(jenisButuhProvinsi("TRANSPORT_DARAT")).toBe(true);
    expect(jenisButuhProvinsi("TAKSI_TERMINAL")).toBe(true);
    expect(jenisButuhProvinsi("SEWA_RODA4")).toBe(true);
    expect(jenisButuhProvinsi("TIKET_PERGI")).toBe(false);
    expect(jenisButuhEtape("TIKET_PERGI")).toBe(true);
    expect(jenisButuhEtape("TIKET_KEMBALI")).toBe(true);
    expect(jenisButuhEtape("TAKSI_KEDUDUKAN")).toBe(false);
    expect(jenisButuhUraian("LAINNYA")).toBe(true);
    expect(jenisButuhUraian("TAKSI_KEDUDUKAN")).toBe(false);
  });
});

describe("ringkasEtape", () => {
  it("hari dan malam, termasuk lintas bulan dan override", () => {
    expect(ringkasEtape({ berangkat: "2026-09-10", pulang: "2026-09-13" })).toEqual({ hari: 4, malam: 3 });
    expect(ringkasEtape({ berangkat: "2026-09-10", pulang: "2026-09-10" })).toEqual({ hari: 1, malam: 0 });
    expect(ringkasEtape({ berangkat: "2026-09-30", pulang: "2026-10-02" })).toEqual({ hari: 3, malam: 2 });
    expect(ringkasEtape({ berangkat: "2026-09-30", pulang: "2026-10-02", malamOverride: 1 })).toEqual({ hari: 3, malam: 1 });
  });

  it("tanggal tidak valid atau terbalik memberi null", () => {
    expect(ringkasEtape({ berangkat: "", pulang: "2026-09-13" })).toEqual({ hari: null, malam: null });
    expect(ringkasEtape({ berangkat: "2026-09-13", pulang: "2026-09-10" })).toEqual({ hari: null, malam: null });
  });
});

describe("indeksBarisTransport", () => {
  it("melewati biaya bertarif nol agar sejajar dengan baris hasil", () => {
    expect(indeksBarisTransport([{ tarif: 100 }, { tarif: 0 }, { tarif: 50 }, { tarif: 0 }, { tarif: 1 }])).toEqual([0, null, 1, null, 2]);
    expect(indeksBarisTransport([])).toEqual([]);
  });
});

describe("pelaksanaDariPegawai", () => {
  it("mengisi data pegawai dan mempertahankan etape serta biaya", () => {
    const awal = { ...pelaksanaKosong(), noSpd: "403/SPD/PPS/2026", biaya: [biayaKosong("TAKSI_KEDUDUKAN")] };
    const hasil = pelaksanaDariPegawai(awal, { id: 7, nama: "R Resa", nip: "199508222023211008", jabatan: "Surveyor", status: "ESELON_IV_GOL_III_II_I" });
    expect(hasil).toMatchObject({ pegawaiId: 7, nama: "R Resa", nip: "199508222023211008", status: "ESELON_IV_GOL_III_II_I", noSpd: "403/SPD/PPS/2026" });
    expect(hasil.biaya).toHaveLength(1);
    expect(hasil.etape).toHaveLength(1);
  });
});

describe("payloadDariDto", () => {
  it("membuang kolom server dan menjaga isian", () => {
    const dto = {
      id: 3,
      versiSbmId: 1,
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
      nomor: "ST.1",
      tanggal: "2026-09-08",
      tanggalSpj: null,
      kodeAkun: "A",
      catatan: "",
      pelaksana: [pelaksanaKosong()],
    };
    const payload = payloadDariDto(dto);
    expect(Object.keys(payload).sort()).toEqual(["catatan", "kodeAkun", "nomor", "pelaksana", "tanggal", "tanggalSpj"]);
    expect(payload.pelaksana).toHaveLength(1);
  });
});
