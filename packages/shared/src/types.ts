export const STATUS_KODE = [
  "PEJABAT_NEGARA_WAMEN",
  "ESELON_I",
  "ESELON_II",
  "ESELON_III_GOL_IV",
  "ESELON_IV_GOL_III_II_I",
] as const;
export type StatusKode = (typeof STATUS_KODE)[number];

export const STATUS_LABEL: Record<StatusKode, string> = {
  PEJABAT_NEGARA_WAMEN: "Pejabat Negara/Wakil Menteri",
  ESELON_I: "Pejabat Eselon I",
  ESELON_II: "Pejabat Eselon II",
  ESELON_III_GOL_IV: "Eselon III/Golongan IV",
  ESELON_IV_GOL_III_II_I: "Eselon IV/Golongan III/II/I",
};

export const JENIS_BIAYA = [
  "TIKET_PERGI",
  "TIKET_KEMBALI",
  "TAKSI_KEDUDUKAN",
  "TRANSPORT_DARAT",
  "TRANSPORT_JAKARTA_SEKITAR",
  "TRANSPORT_KEGIATAN_PP",
  "TAKSI_TERMINAL",
  "SEWA_RODA4",
  "SEWA_RODA6",
  "SEWA_BUS_BESAR",
  "AIRPORT_TAX_BAGASI",
  "KERETA_BUS_LAIN",
  "LAINNYA",
] as const;
export type JenisBiaya = (typeof JENIS_BIAYA)[number];

export const JENIS_LABEL: Record<JenisBiaya, string> = {
  TIKET_PERGI: "Tiket pesawat pergi",
  TIKET_KEMBALI: "Tiket pesawat kembali",
  TAKSI_KEDUDUKAN: "Taksi dari tempat kedudukan - bandara",
  TRANSPORT_DARAT: "Transport darat ibukota ke kab/kota",
  TRANSPORT_JAKARTA_SEKITAR: "Transport Jakarta ke kota sekitar",
  TRANSPORT_KEGIATAN_PP: "Transport kegiatan dalam kab/kota PP",
  TAKSI_TERMINAL: "Taksi/transport dari-ke bandara/terminal",
  SEWA_RODA4: "Sewa kendaraan roda 4 per hari",
  SEWA_RODA6: "Sewa kendaraan roda 6/bus sedang per hari",
  SEWA_BUS_BESAR: "Sewa kendaraan bus besar per hari",
  AIRPORT_TAX_BAGASI: "Airport tax / bagasi / retribusi",
  KERETA_BUS_LAIN: "Kereta api / bus / lainnya",
  LAINNYA: "Lainnya",
};

export type KelasTiket = "Bisnis" | "Ekonomi";

export interface StatusKonfigurasi {
  /** 1..4 = kolom tarif hotel pada tabel SBM Penginapan */
  kolomHotel: 1 | 2 | 3 | 4;
  /** 0 = tidak berhak; 1..3 = baris tabel SBM Uang Representasi */
  barisRepresentasi: 0 | 1 | 2 | 3;
  kelasTiket: KelasTiket;
}

/** Semua kunci provinsi/kota memakai huruf besar (lihat norm()). */
export interface Sbm {
  tahunAnggaran: number;
  uangHarian: Record<string, { luarKota: number; dalamKota8Jam: number; diklat: number }>;
  representasi: Array<{ uraian: string; luarKota: number; dalamKota: number }>;
  penginapan: Record<string, [number, number, number, number]>;
  terminal: Record<string, number>;
  tiketPp: Array<{ asal: string; tujuan: string; bisnis: number; ekonomi: number }>;
  transportIbukota: Array<{ provinsi: string; ibukota: string; kabKota: string; besaran: number }>;
  transportJakarta: Array<{ kabKota: string; besaran: number }>;
  transportKegiatanPp: number;
  sewaKendaraan: Record<string, { roda4: number; roda6BusSedang: number; busBesar: number }>;
  statusKonfigurasi: Record<StatusKode, StatusKonfigurasi>;
}

export interface EtapeInput {
  provinsi: string;
  kota: string;
  kegiatan: string;
  /** YYYY-MM-DD */
  berangkat: string;
  /** YYYY-MM-DD */
  pulang: string;
  malamOverride?: number | null;
  hotelNama?: string | null;
  hotelTarif?: number | null;
  dinasJabatan?: boolean;
  /** Daftar tanggal (YYYY-MM-DD) pelaksanaan paket rapat/pertemuan fullboard */
  fullboardDates?: string[];
}

export interface BiayaInput {
  jenis: JenisBiaya;
  /** Provinsi untuk pagu (transport darat, terminal, sewa kendaraan). */
  provinsi?: string | null;
  /** Kosong = uraian otomatis. Untuk TRANSPORT_DARAT/JAKARTA_SEKITAR berisi nama kab/kota persis seperti PMK. */
  uraian?: string | null;
  qty?: number | null;
  satuan?: string | null;
  tarif: number;
  keterangan?: string | null;
  /** Indeks etape (0-based) untuk TIKET_PERGI / TIKET_KEMBALI. Default: TIKET_PERGI = 0, TIKET_KEMBALI = etape terakhir. */
  etapeIndex?: number | null;
  /** Ditandai sebagai pengeluaran riil tanpa kuitansi resmi (masuk ke Daftar Pengeluaran Riil Lampiran IX PMK 113). */
  pengeluaranRiil?: boolean | null;
}

export interface PelaksanaInput {
  nama: string;
  nip: string;
  jabatan: string;
  status: StatusKode | null;
  noSpd?: string | null;
  /** YYYY-MM-DD */
  tanggalSpd?: string | null;
  etape: EtapeInput[];
  biaya: BiayaInput[];
}

export interface SpjInput {
  nomorSt: string;
  /** YYYY-MM-DD */
  tanggalSt: string;
  /** YYYY-MM-DD */
  tanggalSpj?: string | null;
  kotaKedudukan: string;
  /** Kunci provinsi tempat kedudukan, untuk pagu taksi dari kedudukan. */
  provinsiKedudukan: string;
  pelaksana: PelaksanaInput[];
}

export type KodePeringatan =
  | "DATA_BELUM_LENGKAP"
  | "TANGGAL_SALAH"
  | "STATUS_PEGAWAI_KOSONG"
  | "NIP_KOSONG"
  | "NO_SPD_KOSONG"
  | "TARIF_HOTEL_KOSONG"
  | "HOTEL_MELEBIHI_BATAS";

export interface Peringatan {
  kode: KodePeringatan;
  pesan: string;
  /** Indeks etape (0-based) bila peringatan terkait satu etape. */
  etape?: number;
}

export interface BarisBiaya {
  uraian: string;
  /** Hanya terisi bila qty > 1 (ditampilkan "n satuan @ tarif"). */
  qty: number | null;
  satuan: string | null;
  tarif: number | null;
  jumlah: number;
  keterangan: string;
  /** Catatan pagu PMK (informasi saja). */
  catatan?: string;
}

export interface PelaksanaHasil {
  nama: string;
  nip: string;
  jabatan: string;
  status: StatusKode | null;
  noSpd: string;
  tanggalSpd: string | null;
  teksTanggalSpd: string;
  rute: string;
  transport: BarisBiaya[];
  uangHarian: BarisBiaya[];
  representasi: BarisBiaya[];
  penginapan: BarisBiaya[];
  pengeluaranRiil: BarisBiaya[];
  totalTransport: number;
  totalUangHarian: number;
  totalRepresentasi: number;
  totalPenginapan: number;
  totalPengeluaranRiil: number;
  terbilangPengeluaranRiil: string;
  total: number;
  terbilang: string;
  uraianSptb: string;
  peringatan: Peringatan[];
  /** Catatan informatif tingkat pelaksana (kelas tiket, pagu tiket, hak representasi). */
  catatan: string[];
}

export interface SpjHasil {
  pelaksana: PelaksanaHasil[];
  total: number;
  terbilang: string;
  teksTanggalSt: string;
  teksTanggalSpj: string;
}
