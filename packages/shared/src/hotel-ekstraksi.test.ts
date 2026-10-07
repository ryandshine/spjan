import { describe, expect, it } from "vitest";

import { SBM_2026 } from "./data/sbm-2026.js";
import {
  HasilEkstraksiHotelSchema,
  cariPlafonHotelSbm,
  petakanHotelKeUsulan,
} from "./hotel-ekstraksi.js";
import type { BerkasDto } from "./berkas.js";
import type { SuratTugasPayload } from "./schemas.js";

describe("HasilEkstraksiHotelSchema", () => {
  it("memvalidasi data ekstraksi hotel yang valid", () => {
    const raw = {
      namaHotel: "The Royal Alana Yogyakarta",
      nomorInvoice: "INV-2026-09-001",
      tamu: "Gunadi Firdaus",
      checkIn: "2026-09-12",
      checkOut: "2026-09-13",
      jumlahMalam: 1,
      tarifPerMalam: 850000,
      totalBiaya: 850000,
    };
    const parsed = HasilEkstraksiHotelSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("menolak jika nama hotel kosong atau tanggal salah format", () => {
    const raw = {
      namaHotel: "",
      nomorInvoice: null,
      tamu: null,
      checkIn: "12-09-2026",
      checkOut: "2026-09-13",
      jumlahMalam: 1,
      tarifPerMalam: null,
      totalBiaya: 850000,
    };
    const parsed = HasilEkstraksiHotelSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});

describe("cariPlafonHotelSbm", () => {
  it("mengambil tarif hotel yang sesuai untuk eselon II di D.I. Yogyakarta", () => {
    // ESELON_II di sbm statusKonfigurasi kolomHotel = 2
    // SBM 2026 DIY penginapan: [5100000, 2695000, ...]
    const plafon = cariPlafonHotelSbm("D.I. YOGYAKARTA", "ESELON_II", SBM_2026);
    expect(plafon).toBe(2695000);
  });

  it("mengembalikan null jika status atau provinsi tidak ada", () => {
    expect(cariPlafonHotelSbm("PROVINSI_FIKTIF", "ESELON_II", SBM_2026)).toBeNull();
    expect(cariPlafonHotelSbm("D.I. YOGYAKARTA", null, SBM_2026)).toBeNull();
  });
});

describe("petakanHotelKeUsulan", () => {
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
            pulang: "2026-09-13",
            malamOverride: null,
            hotelNama: null,
            hotelTarif: null,
            dinasJabatan: false,
          },
        ],
        biaya: [],
      },
      {
        nama: "Riandi Eko",
        nip: "198404212023211020",
        jabatan: "Pranata Komputer",
        status: "ESELON_IV_GOL_III_II_I",
        noSpd: null,
        etape: [
          {
            provinsi: "BALI",
            kota: "Denpasar",
            kegiatan: "Audiensi",
            berangkat: "2026-09-10",
            pulang: "2026-09-12",
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

  it("mencocokkan invoice hotel ke pelaksana berdasarkan nama tamu dan melaporkan status plafon sesuai", () => {
    const berkas: BerkasDto[] = [
      {
        id: 10,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "the_royal_alana.jpg",
        mime: "image/jpeg",
        ukuran: 102400,
        sha256: "abc1234567890",
        jenis: "hotel",
        createdAt: "2026-10-05T00:00:00Z",
        keterangan: null,
        ekstraksi: {
          id: 1,
          berkasId: 10,
          status: "selesai",
          model: "gemma4:cloud",
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-10-05T00:00:00Z",
          selesaiAt: "2026-10-05T00:00:05Z",
          hasil: {
            namaHotel: "The Royal Alana",
            nomorInvoice: "INV-001",
            tamu: "Gunadi Firdaus",
            checkIn: "2026-09-12",
            checkOut: "2026-09-13",
            jumlahMalam: 1,
            tarifPerMalam: 850000,
            totalBiaya: 850000,
          },
        },
      },
    ];

    const usulan = petakanHotelKeUsulan(berkas, dummySt, SBM_2026);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.pelaksanaIndex).toBe(0);
    expect(usulan[0]!.pelaksanaNama).toBe("Gunadi Firdaus, M.Si.");
    expect(usulan[0]!.kota).toBe("Yogyakarta");
    expect(usulan[0]!.statusPlafon).toBe("sesuai");
    expect(usulan[0]!.plafonSbmPerMalam).toBe(2695000);
    expect(usulan[0]!.tarifRiilPerMalam).toBe(850000);
  });

  it("mendeteksi jika tarif riil hotel melebihi batas SBM", () => {
    const berkas: BerkasDto[] = [
      {
        id: 11,
        stId: 1,
        pelaksanaId: null,
        namaAsli: "luxury_hotel.jpg",
        mime: "image/jpeg",
        ukuran: 102400,
        sha256: "abc999",
        jenis: "hotel",
        createdAt: "2026-10-05T00:00:00Z",
        keterangan: null,
        ekstraksi: {
          id: 2,
          berkasId: 11,
          status: "selesai",
          model: "gemma4:cloud",
          kodeGalat: null,
          galat: null,
          usulanStatus: "menunggu",
          createdAt: "2026-10-05T00:00:00Z",
          selesaiAt: "2026-10-05T00:00:05Z",
          hasil: {
            namaHotel: "Luxury Resort Bali",
            nomorInvoice: "INV-002",
            tamu: "Riandi Eko",
            checkIn: "2026-09-10",
            checkOut: "2026-09-12",
            jumlahMalam: 2,
            tarifPerMalam: 2500000,
            totalBiaya: 5000000,
          },
        },
      },
    ];

    const usulan = petakanHotelKeUsulan(berkas, dummySt, SBM_2026);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.pelaksanaIndex).toBe(1);
    expect(usulan[0]!.statusPlafon).toBe("melebihi");
    expect(usulan[0]!.peringatan.some((w) => w.includes("melebihi plafon SBM"))).toBe(true);
  });
});
