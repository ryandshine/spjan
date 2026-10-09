import { describe, expect, it } from "vitest";
import type { PegawaiDto } from "./schemas.js";
import { SuratTugasPayloadSchema } from "./schemas.js";
import { bersihkanGelarNama, cariProvinsiSbm, HasilEkstraksiStSchema, petakanStKeUsulan, type HasilEkstraksiSt } from "./st-ekstraksi.js";

const DAFTAR_PROVINSI = ["BALI", "D.I. YOGYAKARTA", "D.K.I. JAKARTA", "JAWA BARAT", "JAWA TIMUR"];

const MASTER_PEGAWAI: PegawaiDto[] = [
  {
    id: 1,
    nama: "Gunadi Firdaus",
    nip: "197803101997031001",
    jabatan: "Kasubdit",
    instansi: "Direktorat Pengendalian Perhutanan Sosial",
    pangkatGolongan: "",
    status: "ESELON_III_GOL_IV",
    aktif: true,
  },
  {
    id: 2,
    nama: "Riandi Eko Priantoro",
    nip: "198404212023211020",
    jabatan: "Pranata Komputer Ahli Pertama",
    instansi: "Direktorat Pengendalian Perhutanan Sosial",
    pangkatGolongan: "",
    status: "ESELON_IV_GOL_III_II_I",
    aktif: true,
  },
];

describe("st-ekstraksi", () => {
  it("bersihkanGelarNama menghapus gelar depan dan gelar belakang", () => {
    expect(bersihkanGelarNama("Dr. Marcus Octavianus Susatyo, S.Hut., M.P.")).toBe("MARCUS OCTAVIANUS SUSATYO");
    expect(bersihkanGelarNama("Riandi Eko Priantoro, S.Kom.")).toBe("RIANDI EKO PRIANTORO");
    expect(bersihkanGelarNama("Ir. H. Gunadi Firdaus")).toBe("H. GUNADI FIRDAUS");
  });

  it("cariProvinsiSbm menemukan provinsi SBM yang cocok", () => {
    expect(cariProvinsiSbm("BALI", DAFTAR_PROVINSI)).toBe("BALI");
    expect(cariProvinsiSbm("Kota Denpasar, Provinsi Bali", DAFTAR_PROVINSI)).toBe("BALI");
    expect(cariProvinsiSbm("D.I. Yogyakarta", DAFTAR_PROVINSI)).toBe("D.I. YOGYAKARTA");
    expect(cariProvinsiSbm("Yogyakarta", DAFTAR_PROVINSI)).toBe("D.I. YOGYAKARTA");
    expect(cariProvinsiSbm("Jakarta Pusat", DAFTAR_PROVINSI)).toBe("D.K.I. JAKARTA");
    expect(cariProvinsiSbm("Kota Tak Dikenal", DAFTAR_PROVINSI)).toBeNull();
  });

  it("memvalidasi dan memetakan ekstraksi ST lengkap menjadi SuratTugasPayload", () => {
    const rawEkstraksi: HasilEkstraksiSt = {
      nomor: "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026",
      tanggal: "2026-09-08",
      kegiatan: "Rapat koordinasi dan pendampingan audiensi",
      pelaksana: [
        {
          nama: "Gunadi Firdaus, S.Hut., M.Si.",
          nip: "19780310 199703 1 001",
          jabatan: "Kasubdit Pemantauan",
          etape: [
            {
              tujuan: "Bali",
              tanggalBerangkat: "2026-09-10",
              tanggalKembali: "2026-09-11",
            },
            {
              tujuan: "Yogyakarta",
              tanggalBerangkat: "2026-09-12",
              tanggalKembali: "2026-09-13",
            },
          ],
        },
        {
          nama: "R Resa Adam Gunawan, S.T.",
          nip: null,
          jabatan: "Surveyor Pemetaan",
          etape: [
            {
              tujuan: "Bali",
              tanggalBerangkat: "2026-09-10",
              tanggalKembali: "2026-09-11",
            },
          ],
        },
      ],
    };

    // Validasi Zod schema
    const parsed = HasilEkstraksiStSchema.parse(rawEkstraksi);
    expect(parsed.nomor).toBe("ST.226/PPS/PEMPS/PSL.04.02/B/09/2026");

    // Pemetaan ke usulan
    const usulan = petakanStKeUsulan(parsed, MASTER_PEGAWAI, DAFTAR_PROVINSI, { kodeAkunDefault: "524111" });

    // Cek lolos skema SuratTugasPayloadSchema
    expect(() => SuratTugasPayloadSchema.parse(usulan.payload)).not.toThrow();

    expect(usulan.payload.nomor).toBe("ST.226/PPS/PEMPS/PSL.04.02/B/09/2026");
    expect(usulan.payload.kodeAkun).toBe("524111");
    expect(usulan.payload.pelaksana).toHaveLength(2);

    // Pelaksana 1 cocok via NIP
    const p1 = usulan.payload.pelaksana[0]!;
    expect(p1.pegawaiId).toBe(1);
    expect(p1.status).toBe("ESELON_III_GOL_IV");
    expect(p1.etape).toHaveLength(2);
    expect(p1.etape[0]?.provinsi).toBe("BALI");
    expect(p1.etape[1]?.provinsi).toBe("D.I. YOGYAKARTA");
    expect(usulan.pelaksanaStatus[0]?.baru).toBe(false);

    // Pelaksana 2 baru (tidak ada di master pegawai)
    const p2 = usulan.payload.pelaksana[1]!;
    expect(p2.pegawaiId).toBeNull();
    expect(p2.status).toBeNull();
    expect(usulan.pelaksanaStatus[1]?.baru).toBe(true);
    expect(usulan.peringatan.some((w) => w.includes("R Resa Adam Gunawan"))).toBe(true);
  });

  it("mencatat peringatan saat tujuan tidak dikenal dan tanggal kembali mendahului berangkat", () => {
    const raw: HasilEkstraksiSt = {
      nomor: "ST.1/2026",
      tanggal: "2026-09-01",
      kegiatan: "Uji",
      pelaksana: [
        {
          nama: "Budi Santoso",
          nip: null,
          jabatan: "Staf",
          etape: [
            {
              tujuan: "Atlantis",
              tanggalBerangkat: "2026-09-10",
              tanggalKembali: "2026-09-05",
            },
          ],
        },
      ],
    };

    const usulan = petakanStKeUsulan(raw, MASTER_PEGAWAI, DAFTAR_PROVINSI);
    expect(usulan.peringatan.some((w) => w.includes("Atlantis"))).toBe(true);
    expect(usulan.peringatan.some((w) => w.includes("lebih awal"))).toBe(true);
  });

  it("otomatis memetakan perjalanan 1 hari Jabodetabek ke dalamKota8Jam dan biaya transport", () => {
    const raw: HasilEkstraksiSt = {
      nomor: "ST.100/2026",
      tanggal: "2026-10-06",
      kegiatan: "Pelatihan komputer di Tangerang",
      pelaksana: [
        {
          nama: "Riandi Eko Priantoro",
          nip: "198404212023211020",
          jabatan: "Pranata Komputer",
          etape: [
            {
              tujuan: "Tanggerang",
              tanggalBerangkat: "2026-10-06",
              tanggalKembali: "2026-10-06",
            },
          ],
        },
      ],
    };

    const usulan = petakanStKeUsulan(raw, MASTER_PEGAWAI, ["BANTEN", "JAWA BARAT", "D.K.I. JAKARTA"]);
    expect(usulan.peringatan).toHaveLength(0); // Banten cocok otomatis dari Tanggerang!
    const pel = usulan.payload.pelaksana[0]!;
    expect(pel.etape[0]?.provinsi).toBe("BANTEN");
    expect(pel.etape[0]?.kota).toBe("Kota Tangerang");
    expect(pel.etape[0]?.dalamKota8Jam).toBe(true);
    expect(pel.etape[0]?.malamOverride).toBe(0);
    // Otomatis dibuatkan biaya Transport Jakarta - Sekitar
    expect(pel.biaya).toHaveLength(1);
    expect(pel.biaya[0]?.jenis).toBe("TRANSPORT_JAKARTA_SEKITAR");
    expect(pel.biaya[0]?.uraian).toBe("Kota Tangerang");
    expect(pel.biaya[0]?.tarif).toBe(258000);
    expect(pel.biaya[0]?.qty).toBe(2);
  });
});
