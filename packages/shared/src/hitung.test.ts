import { describe, expect, it } from "vitest";
import { SBM_2026 } from "./data/sbm-2026.js";
import { hitungSpj } from "./hitung.js";
import type { BiayaInput, EtapeInput, PelaksanaInput, SpjInput } from "./types.js";

const NOMOR_ST = "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026";
const KEG_BALI =
  "Pendampingan Audiensi terkait Rencana Pembongkaran Homestay pada areal kerja Persetujuan Pengelolaan Perhutanan Sosial di Kota Denpasar Provinsi Bali";
const KEG_YOGYA = "Rapat Koordinasi Teknis Pengelolaan Perhutanan Sosial di KHDPK di Provinsi D.I. Yogyakarta";

function spj(pelaksana: PelaksanaInput[], over: Partial<SpjInput> = {}): SpjInput {
  return {
    nomorSt: NOMOR_ST,
    tanggalSt: "2026-09-08",
    tanggalSpj: null,
    kotaKedudukan: "Jakarta",
    provinsiKedudukan: "D.K.I. JAKARTA",
    pelaksana,
    ...over,
  };
}

const etapeBali = (over: Partial<EtapeInput> = {}): EtapeInput => ({
  provinsi: "BALI",
  kota: "Denpasar",
  kegiatan: KEG_BALI,
  berangkat: "2026-09-10",
  pulang: "2026-09-11",
  ...over,
});
const etapeYogya = (over: Partial<EtapeInput> = {}): EtapeInput => ({
  provinsi: "D.I. YOGYAKARTA",
  kota: "Yogyakarta",
  kegiatan: KEG_YOGYA,
  berangkat: "2026-09-10",
  pulang: "2026-09-13",
  ...over,
});

const resa: PelaksanaInput = {
  nama: "R Resa Adam Gunawan, S.T.",
  nip: "199508222023211008",
  jabatan: "Surveyor Pemetaan Ahli Pertama",
  status: "ESELON_IV_GOL_III_II_I",
  noSpd: "403/SPD/PPS/2026",
  etape: [etapeBali({ hotelNama: "Kuto Paradiso Hotel", hotelTarif: 1_021_948 })],
  biaya: [
    { jenis: "TIKET_PERGI", tarif: 2_260_940 },
    { jenis: "TIKET_KEMBALI", tarif: 2_223_091 },
    { jenis: "TAKSI_KEDUDUKAN", qty: 2, tarif: 250_000 },
  ],
};

describe("hitungSpj - kasus emas", () => {
  it("Resa: Bali 10-11 September, total 6.965.979", () => {
    const h = hitungSpj(spj([resa]), SBM_2026).pelaksana[0]!;
    expect(h.totalTransport).toBe(4_984_031);
    expect(h.totalUangHarian).toBe(960_000);
    expect(h.totalPenginapan).toBe(1_021_948);
    expect(h.total).toBe(6_965_979);
    expect(h.terbilang).toBe("Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah");
    expect(h.peringatan).toEqual([]);
    expect(h.transport.map((r) => r.uraian)).toEqual([
      "Tiket Pesawat Jakarta ke Denpasar",
      "Tiket Pesawat Denpasar ke Jakarta",
      "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)",
    ]);
    expect(h.transport[2]).toMatchObject({ qty: 2, satuan: "kali", tarif: 250_000, jumlah: 500_000 });
    expect(h.transport[0]).toMatchObject({ qty: null, satuan: null, tarif: null, keterangan: "Bukti terlampir" });
    expect(h.uangHarian[0]).toMatchObject({
      qty: 2,
      tarif: 480_000,
      keterangan: "Lumpsum/Prov. Bali Tanggal 10-11 September 2026",
    });
    expect(h.penginapan[0]).toMatchObject({ qty: 1, satuan: "malam", keterangan: "Tanggal 10-11 September 2026, Bukti terlampir" });
    expect(h.uraianSptb).toBe(
      `Biaya Perjalanan dinas dalam rangka ${KEG_BALI} selama 2 (dua) hari pada tanggal 10 s.d. 11 September 2026 sesuai Surat Tugas Nomor: ${NOMOR_ST} tanggal 8 September 2026 dan SPD terlampir.`,
    );
  });

  it("Resa: catatan tiket melebihi pagu SBM ekonomi Rp3.262.000", () => {
    const h = hitungSpj(spj([resa]), SBM_2026).pelaksana[0]!;
    expect(h.catatan).toContain("Kelas tiket: Ekonomi.");
    expect(h.catatan).toContain("Tiket PP Rp4.484.031 melebihi pagu SBM Rp3.262.000 (biaya riil, lampirkan bukti).");
    expect(h.transport[2]?.catatan).toBe("Tarif dalam pagu PMK Rp250.000.");
  });

  it("Riandi: Yogyakarta 10-13 September, hotel 3 malam sesuai batas, belum ada transport", () => {
    const riandi: PelaksanaInput = {
      nama: "Riandi Eko Priantoro, S.Kom.",
      nip: "198404212023211020",
      jabatan: "Pranata Komputer Ahli Pertama",
      status: "ESELON_IV_GOL_III_II_I",
      noSpd: "404/SPD/PPS/2026",
      etape: [etapeYogya({ hotelNama: "The Royal Alana Yogyakarta Hotel & Convention Center", hotelTarif: 845_000 })],
      biaya: [],
    };
    const h = hitungSpj(spj([riandi]), SBM_2026).pelaksana[0]!;
    expect(h.totalUangHarian).toBe(1_680_000);
    expect(h.totalPenginapan).toBe(2_535_000);
    expect(h.total).toBe(4_215_000);
    expect(h.peringatan).toEqual([]);
    expect(h.uangHarian[0]?.keterangan).toBe("Lumpsum/Prov. D.I. Yogyakarta Tanggal 10-13 September 2026");
  });

  it("Riandi: tarif hotel di atas batas SBM memberi peringatan", () => {
    const p: PelaksanaInput = { ...resa, etape: [etapeYogya({ hotelNama: "H", hotelTarif: 900_000 })] };
    const h = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!;
    expect(h.peringatan).toEqual([
      {
        kode: "HOTEL_MELEBIHI_BATAS",
        pesan: "Etape 1: tarif hotel Rp900.000 melebihi batas SBM Rp845.000.",
        etape: 0,
      },
    ]);
  });

  it("Direktur Manado: Eselon II dinas jabatan, total 11.909.784", () => {
    const direktur: PelaksanaInput = {
      nama: "Dr. Marcus Octavianus Susatyo, S.Hut., M.P.",
      nip: "196810191998031001",
      jabatan: "Direktur",
      status: "ESELON_II",
      noSpd: "45/SPD/PPS/2026",
      etape: [
        {
          provinsi: "SULAWESI UTARA",
          kota: "Manado",
          kegiatan: "Pelaksanaan Pemantauan Izin Perhutanan Sosial",
          berangkat: "2026-04-07",
          pulang: "2026-04-10",
          hotelNama: "Manado Quality Hotel",
          hotelTarif: 650_000,
          dinasJabatan: true,
        },
      ],
      biaya: [
        { jenis: "TIKET_PERGI", tarif: 3_689_972 },
        { jenis: "TIKET_KEMBALI", tarif: 4_189_812 },
      ],
    };
    const h = hitungSpj(spj([direktur]), SBM_2026).pelaksana[0]!;
    expect(h.totalUangHarian).toBe(1_480_000);
    expect(h.totalRepresentasi).toBe(600_000);
    expect(h.representasi[0]).toMatchObject({ qty: 4, tarif: 150_000 });
    expect(h.totalPenginapan).toBe(1_950_000);
    expect(h.totalTransport).toBe(7_879_784);
    expect(h.total).toBe(11_909_784);
    expect(h.terbilang).toBe("Sebelas Juta Sembilan Ratus Sembilan Ribu Tujuh Ratus Delapan Puluh Empat Rupiah");
  });

  it("Eselon II tanpa tanda dinas jabatan: tidak ada representasi, ada catatan hak", () => {
    const p: PelaksanaInput = {
      nama: "X",
      nip: "1",
      jabatan: "Direktur",
      status: "ESELON_II",
      noSpd: "1",
      etape: [{ provinsi: "SULAWESI UTARA", kota: "Manado", kegiatan: "K", berangkat: "2026-04-07", pulang: "2026-04-10" }],
      biaya: [],
    };
    const h = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!;
    expect(h.representasi).toEqual([]);
    expect(h.catatan).toContain("Berhak uang representasi: tandai dinas jabatan bila perjalanan dinas jabatan.");
  });

  it("Gunadi: dua etape, tiga tiket, uraian SPTB dua kegiatan", () => {
    const gunadi: PelaksanaInput = {
      nama: "Gunadi Firdaus, S.Hut., M.Si.",
      nip: "197803101997031001",
      jabatan: "Kasubdit Pemantauan Perhutanan Sosial",
      status: "ESELON_III_GOL_IV",
      noSpd: "401/SPD/PPS/2026",
      etape: [
        etapeBali({ hotelNama: "Hotel Bali", hotelTarif: 1_500_000 }),
        etapeYogya({ berangkat: "2026-09-12", pulang: "2026-09-13", hotelNama: "Hotel Yogya", hotelTarif: 1_000_000 }),
      ],
      biaya: [
        { jenis: "TIKET_PERGI", etapeIndex: 0, tarif: 1_500_000 },
        { jenis: "TAKSI_KEDUDUKAN", tarif: 250_000 },
        { jenis: "TIKET_PERGI", etapeIndex: 1, tarif: 1_200_000 },
        { jenis: "TIKET_KEMBALI", tarif: 1_900_000 },
      ],
    };
    const h = hitungSpj(spj([gunadi]), SBM_2026).pelaksana[0]!;
    expect(h.transport.map((r) => r.uraian)).toEqual([
      "Tiket Pesawat Jakarta ke Denpasar",
      "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)",
      "Tiket Pesawat Denpasar ke Yogyakarta",
      "Tiket Pesawat Yogyakarta ke Jakarta",
    ]);
    expect(h.totalUangHarian).toBe(1_800_000);
    expect(h.totalPenginapan).toBe(2_500_000);
    expect(h.total).toBe(9_150_000);
    expect(h.uraianSptb).toBe(
      `Biaya Perjalanan dinas dalam rangka ${KEG_BALI} selama 2 (dua) hari pada tanggal 10 s.d. 11 September 2026 dan ${KEG_YOGYA} selama 2 (dua) hari pada tanggal 12 s.d. 13 September 2026 sesuai Surat Tugas Nomor: ${NOMOR_ST} tanggal 8 September 2026 dan SPD terlampir.`,
    );
    expect(h.catatan.some((c) => c.startsWith("Tiket PP"))).toBe(false);
  });

  it("total SPTB menjumlahkan semua pelaksana", () => {
    const hasil = hitungSpj(spj([resa, resa]), SBM_2026);
    expect(hasil.total).toBe(13_931_958);
    expect(hasil.terbilang).toBe("Tiga Belas Juta Sembilan Ratus Tiga Puluh Satu Ribu Sembilan Ratus Lima Puluh Delapan Rupiah");
    expect(hasil.teksTanggalSt).toBe("8 September 2026");
    expect(hasil.teksTanggalSpj).toBe("");
  });
});

describe("hitungSpj - pagu biaya tambahan", () => {
  const dasar: PelaksanaInput = { ...resa, etape: [etapeBali()], biaya: [] };
  const dengan = (b: BiayaInput) => hitungSpj(spj([{ ...dasar, biaya: [b] }]), SBM_2026).pelaksana[0]!.transport[0]!;

  it("transport darat: Kab. Gianyar pagu Rp225.000", () => {
    const r = dengan({ jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian: "Kab. Gianyar", qty: 2, tarif: 200_000 });
    expect(r.uraian).toBe("Transport darat ibukota ke kab/kota - Kab. Gianyar");
    expect(r.jumlah).toBe(400_000);
    expect(r.catatan).toBe("Tarif dalam pagu PMK Rp225.000.");
  });

  it("sewa kendaraan roda 4 Bali di atas pagu Rp1.275.000", () => {
    const r = dengan({ jenis: "SEWA_RODA4", provinsi: "BALI", uraian: "Sewa mobil di Bali", qty: 2, tarif: 1_500_000 });
    expect(r).toMatchObject({ satuan: "hari", jumlah: 3_000_000 });
    expect(r.catatan).toBe(
      "Tarif Rp1.500.000 melebihi pagu PMK Rp1.275.000 per satuan (dapat dilampaui bila riil; lampirkan bukti).",
    );
  });

  it("taksi terminal Bali di atas pagu Rp219.000", () => {
    expect(dengan({ jenis: "TAKSI_TERMINAL", provinsi: "BALI", qty: 2, tarif: 300_000 }).catatan).toBe(
      "Tarif Rp300.000 melebihi pagu PMK Rp219.000 per satuan (dapat dilampaui bila riil; lampirkan bukti).",
    );
  });

  it("transport kegiatan dalam kab/kota PP Rp170.000", () => {
    expect(dengan({ jenis: "TRANSPORT_KEGIATAN_PP", tarif: 170_000 }).catatan).toBe("Tarif dalam pagu PMK Rp170.000.");
  });

  it("jenis tanpa pagu dan tujuan tidak ditemukan", () => {
    expect(dengan({ jenis: "AIRPORT_TAX_BAGASI", uraian: "Bagasi pesawat", tarif: 250_000 }).catatan).toBe(
      "Tidak ada pagu di PMK: biaya riil, lampirkan bukti.",
    );
    expect(dengan({ jenis: "TRANSPORT_DARAT", provinsi: "BALI", uraian: "Kab. Tidak Ada", tarif: 100_000 }).catatan).toBe(
      "Tujuan/provinsi tidak ditemukan di tabel PMK (harga pasar/at cost).",
    );
  });

  it("uraian LAINNYA memakai teks bebas dan baris tarif nol dibuang", () => {
    const h = hitungSpj(spj([{ ...dasar, biaya: [{ jenis: "LAINNYA", uraian: "Parkir bandara", tarif: 20_000 }, { jenis: "LAINNYA", uraian: "Kosong", tarif: 0 }] }]), SBM_2026).pelaksana[0]!;
    expect(h.transport.map((r) => r.uraian)).toEqual(["Parkir bandara"]);
  });
});

describe("hitungSpj - peringatan data", () => {
  it("data kosong menghasilkan peringatan lengkap", () => {
    const p: PelaksanaInput = {
      nama: "Baru",
      nip: "",
      jabatan: "",
      status: null,
      etape: [
        { provinsi: "", kota: "", kegiatan: "", berangkat: "", pulang: "" },
        etapeBali({ berangkat: "2026-09-12", pulang: "2026-09-10" }),
        etapeBali({ hotelTarif: null }),
      ],
      biaya: [],
    };
    const kode = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!.peringatan.map((x) => x.kode);
    expect(kode).toEqual([
      "STATUS_PEGAWAI_KOSONG",
      "NIP_KOSONG",
      "NO_SPD_KOSONG",
      "DATA_BELUM_LENGKAP",
      "TANGGAL_SALAH",
      "TARIF_HOTEL_KOSONG",
    ]);
  });

  it("lintas bulan dan override malam", () => {
    const p: PelaksanaInput = {
      ...resa,
      etape: [etapeBali({ berangkat: "2026-09-30", pulang: "2026-10-02", malamOverride: 1, hotelNama: "H", hotelTarif: 1_000_000 })],
      biaya: [],
    };
    const h = hitungSpj(spj([p]), SBM_2026).pelaksana[0]!;
    expect(h.uangHarian[0]?.keterangan).toBe("Lumpsum/Prov. Bali Tanggal 30 September - 2 Oktober 2026");
    expect(h.uangHarian[0]?.qty).toBe(3);
    expect(h.penginapan[0]?.qty).toBe(1);
    expect(h.uraianSptb).toContain("selama 3 (tiga) hari pada tanggal 30 September s.d. 2 Oktober 2026");
  });
});
