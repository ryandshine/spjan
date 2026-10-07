import { describe, expect, it } from "vitest";

import type { BerkasDto } from "./berkas.js";
import type { SuratTugasPayload } from "./schemas.js";
import {
  HasilEkstraksiTiketSchema,
  HasilEkstraksiTransportSchema,
  petakanTransportKeUsulan,
} from "./transport-ekstraksi.js";

describe("HasilEkstraksiTiketSchema", () => {
  it("memvalidasi data tiket pesawat yang valid", () => {
    const raw = {
      maskapai: "Garuda Indonesia",
      kodeBooking: "ABCDEF",
      nomorTiket: "126-2134567890",
      penumpang: "GUNADI FIRDAUS MR",
      asal: "Jakarta (CGK)",
      tujuan: "Yogyakarta (YIA)",
      tanggal: "2026-09-12",
      jam: "08:30",
      nomorPenerbangan: "GA 204",
      tarif: 1450000,
      arah: "pergi",
    };
    const res = HasilEkstraksiTiketSchema.safeParse(raw);
    expect(res.success).toBe(true);
  });

  it("menolak bila tanggal salah format atau tarif negatif", () => {
    const raw = {
      maskapai: "Batik Air",
      kodeBooking: null,
      nomorTiket: null,
      penumpang: null,
      asal: "CGK",
      tujuan: "DPS",
      tanggal: "12-09-2026",
      tarif: -5000,
    };
    const res = HasilEkstraksiTiketSchema.safeParse(raw);
    expect(res.success).toBe(false);
  });
});

describe("HasilEkstraksiTransportSchema", () => {
  it("memvalidasi bukti transportasi lokal / taksi", () => {
    const raw = {
      kategori: "taksi",
      penyedia: "Blue Bird",
      nomorKuitansi: "BB-987123",
      tanggal: "2026-09-12",
      uraian: "Taksi Bandara YIA ke Hotel",
      totalBiaya: 175000,
    };
    const res = HasilEkstraksiTransportSchema.safeParse(raw);
    expect(res.success).toBe(true);
  });
});

describe("petakanTransportKeUsulan", () => {
  const dummySt: SuratTugasPayload = {
    nomor: "ST.226/PPS/2026",
    tanggal: "2026-09-08",
    tanggalSpj: null,
    kodeAkun: "524111",
    catatan: "",
    pelaksana: [
      {
        nama: "Gunadi Firdaus, M.Si.",
        nip: "197803101997031001",
        jabatan: "Kasubdit",
        status: "ESELON_II",
        noSpd: null,
        etape: [
          {
            provinsi: "D.I. YOGYAKARTA",
            kota: "Yogyakarta",
            kegiatan: "Rakor",
            berangkat: "2026-09-12",
            pulang: "2026-09-14",
            malamOverride: null,
            hotelNama: null,
            hotelTarif: null,
            dinasJabatan: false,
          },
        ],
        biaya: [],
      },
    ],
  };

  it("memetakan tiket penerbangan pergi ke TIKET_PERGI dengan pelaksana yang sesuai", () => {
    const berkas: BerkasDto[] = [
      {
        id: 21,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "tiket_garuda_pergi.pdf",
        mime: "application/pdf",
        ukuran: 54321,
        sha256: "aabbcc11223344",
        jenis: "tiket",
        createdAt: "2026-09-08T10:00:00.000Z",
        keterangan: null,
        ekstraksi: {
          id: 21,
          berkasId: 21,
          status: "selesai",
          model: "gpt-oss:120b-cloud",
          hasil: {
            maskapai: "Garuda Indonesia",
            kodeBooking: "GA1234",
            nomorTiket: "126-9876543210",
            penumpang: "Gunadi Firdaus",
            asal: "Jakarta (CGK)",
            tujuan: "Yogyakarta (YIA)",
            tanggal: "2026-09-12",
            nomorPenerbangan: "GA 204",
            tarif: 1520000,
            arah: "pergi",
          },
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-09-08T10:00:00.000Z",
          selesaiAt: "2026-09-08T10:00:03.000Z",
        },
      },
    ];

    const usulan = petakanTransportKeUsulan(berkas, dummySt);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.kategoriBerkas).toBe("tiket");
    expect(usulan[0]!.jenisBiaya).toBe("TIKET_PERGI");
    expect(usulan[0]!.pelaksanaIndex).toBe(0);
    expect(usulan[0]!.tarifRiil).toBe(1520000);
    expect(usulan[0]!.uraianBiaya).toContain("Tiket Pesawat");
  });

  it("memetakan tiket penerbangan kembali ke TIKET_KEMBALI berdasarkan tanggal kepulangan", () => {
    const berkas: BerkasDto[] = [
      {
        id: 22,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "tiket_batik_pulang.pdf",
        mime: "application/pdf",
        ukuran: 43210,
        sha256: "ccbbaa44332211",
        jenis: "tiket",
        createdAt: "2026-09-08T10:00:00.000Z",
        keterangan: null,
        ekstraksi: {
          id: 22,
          berkasId: 22,
          status: "selesai",
          model: "gpt-oss:120b-cloud",
          hasil: {
            maskapai: "Batik Air",
            kodeBooking: "BTK567",
            nomorTiket: "990-1234567890",
            penumpang: "Gunadi Firdaus",
            asal: "Yogyakarta (YIA)",
            tujuan: "Jakarta (CGK)",
            tanggal: "2026-09-14",
            nomorPenerbangan: "ID 6371",
            tarif: 1250000,
            arah: "lainnya",
          },
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-09-08T10:00:00.000Z",
          selesaiAt: "2026-09-08T10:00:04.000Z",
        },
      },
    ];

    const usulan = petakanTransportKeUsulan(berkas, dummySt);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.jenisBiaya).toBe("TIKET_KEMBALI");
    expect(usulan[0]!.tarifRiil).toBe(1250000);
  });

  it("memetakan struk taksi ke TAKSI_TERMINAL", () => {
    const berkas: BerkasDto[] = [
      {
        id: 23,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "struk_taksi.jpg",
        mime: "image/jpeg",
        ukuran: 81920,
        sha256: "ffeedd00998877",
        jenis: "transport",
        createdAt: "2026-09-08T10:00:00.000Z",
        keterangan: null,
        ekstraksi: {
          id: 23,
          berkasId: 23,
          status: "selesai",
          model: "gemma4:cloud",
          hasil: {
            kategori: "taksi",
            penyedia: "Blue Bird",
            nomorKuitansi: "KUIT-0912-1",
            tanggal: "2026-09-12",
            uraian: "Taksi Bandara YIA ke Hotel",
            totalBiaya: 185000,
          },
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-09-08T10:00:00.000Z",
          selesaiAt: "2026-09-08T10:00:05.000Z",
        },
      },
    ];

    const usulan = petakanTransportKeUsulan(berkas, dummySt);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.kategoriBerkas).toBe("transport");
    expect(usulan[0]!.jenisBiaya).toBe("TAKSI_TERMINAL");
    expect(usulan[0]!.tarifRiil).toBe(185000);
  });

  it("memetakan tiket kepulangan ke Jakarta sebagai TIKET_KEMBALI meskipun model menghasilkan arah 'pergi'", () => {
    const berkas: BerkasDto[] = [
      {
        id: 24,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "WTCWQA_AirAsia.pdf",
        mime: "application/pdf",
        ukuran: 54321,
        sha256: "11223344556677",
        jenis: "tiket",
        createdAt: "2026-09-08T10:00:00.000Z",
        keterangan: null,
        ekstraksi: {
          id: 24,
          berkasId: 24,
          status: "selesai",
          model: "gpt-oss:120b-cloud",
          hasil: {
            maskapai: "AirAsia Indonesia",
            kodeBooking: "WTCWQA",
            nomorTiket: "9902149382524",
            penumpang: "MR Riandi Eko Priantoro",
            asal: "Yogyakarta (YIA)",
            tujuan: "Jakarta (CGK)",
            tanggal: "2026-09-13",
            nomorPenerbangan: "IU 313",
            tarif: 1297149,
            arah: "pergi", // AI keliru mengembalikan arah pergi
          },
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-09-08T10:00:00.000Z",
          selesaiAt: "2026-09-08T10:00:03.000Z",
        },
      },
    ];

    const stDuaPelaksana: SuratTugasPayload = {
      ...dummySt,
      pelaksana: [
        ...dummySt.pelaksana,
        {
          nama: "Riandi Eko Priantoro, S.Kom.",
          nip: "198404212023211020",
          jabatan: "Pranata Komputer",
          status: "ESELON_IV_GOL_III_II_I",
          noSpd: null,
          etape: [
            {
              provinsi: "D.I. YOGYAKARTA",
              kota: "Yogyakarta",
              kegiatan: "Rakor",
              berangkat: "2026-09-10",
              pulang: "2026-09-13",
              malamOverride: null,
              hotelNama: null,
              hotelTarif: null,
              dinasJabatan: false,
            },
          ],
          biaya: [],
        },
      ],
    };

    const usulan = petakanTransportKeUsulan(berkas, stDuaPelaksana);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.jenisBiaya).toBe("TIKET_KEMBALI");
    expect(usulan[0]!.pelaksanaIndex).toBe(1);
    expect(usulan[0]!.pelaksanaNama).toBe("Riandi Eko Priantoro, S.Kom.");
  });

  it("mencocokkan nama penumpang dengan gelar depan 'Mr' dan variasi ejaan nama 'Ekko'", () => {
    const berkas: BerkasDto[] = [
      {
        id: 25,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "garuda_ekko.jpg",
        mime: "image/jpeg",
        ukuran: 54321,
        sha256: "99887766554433",
        jenis: "tiket",
        createdAt: "2026-09-08T10:00:00.000Z",
        keterangan: null,
        ekstraksi: {
          id: 25,
          berkasId: 25,
          status: "selesai",
          model: "gemma4:cloud",
          hasil: {
            maskapai: "Garuda Indonesia",
            kodeBooking: "DKA3NH",
            nomorTiket: "126-4854411617",
            penumpang: "Mr Riandi Ekko Priantoro",
            asal: "Jakarta (CGK)",
            tujuan: "Yogyakarta (YIA)",
            tanggal: "2026-09-10",
            nomorPenerbangan: "GA 208",
            tarif: 1749292,
            arah: "pergi",
          },
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-09-08T10:00:00.000Z",
          selesaiAt: "2026-09-08T10:00:03.000Z",
        },
      },
    ];

    const stDuaPelaksana: SuratTugasPayload = {
      ...dummySt,
      pelaksana: [
        ...dummySt.pelaksana,
        {
          nama: "Riandi Eko Priantoro, S.Kom.",
          nip: "198404212023211020",
          jabatan: "Pranata Komputer",
          status: "ESELON_IV_GOL_III_II_I",
          noSpd: null,
          etape: [
            {
              provinsi: "D.I. YOGYAKARTA",
              kota: "Yogyakarta",
              kegiatan: "Rakor",
              berangkat: "2026-09-10",
              pulang: "2026-09-13",
              malamOverride: null,
              hotelNama: null,
              hotelTarif: null,
              dinasJabatan: false,
            },
          ],
          biaya: [],
        },
      ],
    };

    const usulan = petakanTransportKeUsulan(berkas, stDuaPelaksana);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.pelaksanaIndex).toBe(1);
    expect(usulan[0]!.jenisBiaya).toBe("TIKET_PERGI");
  });
});
