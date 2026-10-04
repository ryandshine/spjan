import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { hitungSpj } from "./hitung.js";
import {
  PegawaiPayloadSchema,
  StatusKonfigurasiMapSchema,
  SuratTugasPayloadSchema,
  toSpjInput,
} from "./schemas.js";

const payload = {
  nomor: "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026",
  tanggal: "2026-09-08",
  tanggalSpj: null,
  kodeAkun: "7288.QDD.001.052.A.524111",
  catatan: "",
  pelaksana: [
    {
      pegawaiId: 7,
      nama: "R Resa Adam Gunawan, S.T.",
      nip: "199508222023211008",
      jabatan: "Surveyor Pemetaan Ahli Pertama",
      status: "ESELON_IV_GOL_III_II_I" as const,
      noSpd: "403/SPD/PPS/2026",
      etape: [
        {
          provinsi: "BALI",
          kota: "Denpasar",
          kegiatan: "Audiensi",
          berangkat: "2026-09-10",
          pulang: "2026-09-11",
          hotelNama: "Kuto Paradiso Hotel",
          hotelTarif: 1_021_948,
        },
      ],
      biaya: [{ jenis: "TIKET_PERGI" as const, tarif: 2_260_940 }],
    },
  ],
};

describe("SuratTugasPayloadSchema", () => {
  it("menerima payload valid dan menolak yang salah", () => {
    expect(SuratTugasPayloadSchema.safeParse(payload).success).toBe(true);
    expect(SuratTugasPayloadSchema.safeParse({ ...payload, tanggal: "8/9/2026" }).success).toBe(false);
    expect(SuratTugasPayloadSchema.safeParse({ ...payload, nomor: "" }).success).toBe(false);
    const jenisSalah = { ...payload, pelaksana: [{ ...payload.pelaksana[0], biaya: [{ jenis: "XYZ", tarif: 1 }] }] };
    expect(SuratTugasPayloadSchema.safeParse(jenisSalah).success).toBe(false);
    const tarifNegatif = { ...payload, pelaksana: [{ ...payload.pelaksana[0], biaya: [{ jenis: "LAINNYA", tarif: -5 }] }] };
    expect(SuratTugasPayloadSchema.safeParse(tarifNegatif).success).toBe(false);
  });

  it("tanggal etape boleh kosong untuk draf", () => {
    const draf = { ...payload, pelaksana: [{ ...payload.pelaksana[0], etape: [{ provinsi: "", kota: "", kegiatan: "", berangkat: "", pulang: "" }] }] };
    expect(SuratTugasPayloadSchema.safeParse(draf).success).toBe(true);
  });
});

describe("toSpjInput", () => {
  it("menyusun masukan mesin hitung yang menghasilkan total yang benar", () => {
    const parsed = SuratTugasPayloadSchema.parse(payload);
    const input = toSpjInput(parsed, { kotaKedudukan: "Jakarta", provinsiKedudukan: "D.K.I. JAKARTA" });
    expect(input.nomorSt).toBe(payload.nomor);
    const hasil = hitungSpj(input, SBM_2026);
    expect(hasil.pelaksana[0]?.total).toBe(2_260_940 + 960_000 + 1_021_948);
  });
});

describe("skema pegawai dan konfigurasi status", () => {
  it("NIP wajib angka", () => {
    const ok = { nama: "A", nip: "199508222023211008", jabatan: "", status: null };
    expect(PegawaiPayloadSchema.safeParse(ok).success).toBe(true);
    expect(PegawaiPayloadSchema.safeParse({ ...ok, nip: "12 34" }).success).toBe(false);
    expect(PegawaiPayloadSchema.safeParse({ ...ok, status: "LAIN" }).success).toBe(false);
  });

  it("konfigurasi status harus memuat kelima status", () => {
    expect(StatusKonfigurasiMapSchema.safeParse(SBM_2026.statusKonfigurasi).success).toBe(true);
    const { ESELON_I: _dibuang, ...kurang } = SBM_2026.statusKonfigurasi;
    expect(StatusKonfigurasiMapSchema.safeParse(kurang).success).toBe(false);
  });
});
