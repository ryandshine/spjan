import { INSTANSI_BAWAAN } from "./schemas.js";
import type { BiayaPayload, EtapePayload, PelaksanaPayload, SumberDana, SuratTugasDto, SuratTugasPayload } from "./schemas.js";
import { parseTanggal, selisihHari } from "./teks.js";
import type { BiayaInput, JenisBiaya } from "./types.js";

export function stKosong(kodeAkun = "", tahunAnggaran: number | null = null, sumberDana: SumberDana = "RM"): SuratTugasPayload {
  return {
    nomor: "",
    tanggal: "",
    tanggalSpj: null,
    kodeAkun,
    catatan: "",
    pelaksana: [],
    tahunAnggaran,
    sumberDana,
    pjNama: null,
    pjNip: null,
    pjJabatan: null,
  };
}

export function etapeKosong(): EtapePayload {
  return {
    provinsi: "",
    kota: "",
    kegiatan: "",
    berangkat: "",
    pulang: "",
    malamOverride: null,
    hotelNama: null,
    hotelTarif: null,
    dinasJabatan: false,
    fullboardDates: [],
    hotel30Persen: false,
    dalamKota8Jam: false,
  };
}

export function biayaKosong(jenis: JenisBiaya): BiayaPayload {
  return {
    jenis,
    provinsi: null,
    uraian: null,
    qty: null,
    satuan: null,
    tarif: 0,
    keterangan: null,
    etapeIndex: null,
  };
}

export function pelaksanaKosong(): PelaksanaPayload {
  return {
    pegawaiId: null,
    nama: "",
    nip: "",
    jabatan: "",
    instansi: INSTANSI_BAWAAN,
    pangkatGolongan: "",
    status: null,
    noSpd: null,
    tanggalSpd: null,
    etape: [etapeKosong()],
    biaya: [],
  };
}

const BUTUH_PROVINSI = new Set<JenisBiaya>(["TRANSPORT_DARAT", "TAKSI_TERMINAL", "SEWA_RODA4", "SEWA_RODA6", "SEWA_BUS_BESAR"]);
const BUTUH_ETAPE = new Set<JenisBiaya>(["TIKET_PERGI", "TIKET_KEMBALI"]);

/** Jenis yang pagunya dicari berdasarkan provinsi. */
export function jenisButuhProvinsi(jenis: JenisBiaya): boolean {
  return BUTUH_PROVINSI.has(jenis);
}

/** Jenis yang terkait dengan satu etape (tiket). */
export function jenisButuhEtape(jenis: JenisBiaya): boolean {
  return BUTUH_ETAPE.has(jenis);
}

/** Jenis yang uraiannya wajib bermakna: transport darat dan Jakarta-sekitar (kunci pagu), airport tax dan lainnya (teks bebas). */
export function jenisButuhUraian(jenis: JenisBiaya): boolean {
  return ["TRANSPORT_DARAT", "TRANSPORT_JAKARTA_SEKITAR", "AIRPORT_TAX_BAGASI", "KERETA_BUS_LAIN", "LAINNYA"].includes(jenis);
}

export interface RingkasEtape {
  /** null bila tanggal belum valid atau pulang lebih awal dari berangkat. */
  hari: number | null;
  malam: number | null;
}

export function ringkasEtape(
  e: Pick<EtapePayload, "berangkat" | "pulang"> & { malamOverride?: number | null; fullboardDates?: string[] },
): RingkasEtape {
  const a = parseTanggal(e.berangkat);
  const b = parseTanggal(e.pulang);
  if (!a || !b) return { hari: null, malam: null };
  const hari = selisihHari(a, b) + 1;
  if (hari < 1) return { hari: null, malam: null };
  const semuaFullboard = (e.fullboardDates ?? []).length >= hari;
  const defaultMalam = semuaFullboard ? 0 : Math.max(hari - 1, 0);
  return { hari, malam: e.malamOverride != null ? e.malamOverride : defaultMalam };
}

/**
 * hitungSpj membuang biaya bertarif <= 0, sehingga indeks baris transport hasil tidak sejajar
 * dengan indeks biaya masukan. Mengembalikan, untuk tiap biaya masukan, indeks barisnya pada
 * `transport` hasil (atau null bila biaya itu tidak menghasilkan baris).
 */
export function indeksBarisTransport(
  biaya: Array<Pick<BiayaInput, "tarif"> & Partial<Pick<BiayaInput, "jenis" | "etapeIndex">>>,
): Array<number | null> {
  const urutan = (jenis?: string) => {
    switch (jenis) {
      case "TIKET_PERGI":
        return 10;
      case "TIKET_KEMBALI":
        return 20;
      case "TAKSI_KEDUDUKAN":
        return 30;
      case "TAKSI_TERMINAL":
        return 40;
      case "TRANSPORT_DARAT":
        return 50;
      case "TRANSPORT_JAKARTA_SEKITAR":
        return 51;
      case "TRANSPORT_KEGIATAN_PP":
        return 52;
      case "SEWA_RODA4":
      case "SEWA_RODA6":
      case "SEWA_BUS_BESAR":
        return 60;
      case "AIRPORT_TAX_BAGASI":
        return 65;
      case "KERETA_BUS_LAIN":
        return 70;
      case "LAINNYA":
        return 80;
      default:
        return 90;
    }
  };

  const aktif = biaya
    .map((b, i) => ({ ...b, origIdx: i }))
    .filter((b) => b.tarif > 0);

  aktif.sort((a, b) => {
    const ua = urutan(a.jenis);
    const ub = urutan(b.jenis);
    if (ua !== ub) return ua - ub;
    return (a.etapeIndex ?? 0) - (b.etapeIndex ?? 0);
  });

  const hasil: Array<number | null> = new Array(biaya.length).fill(null);
  aktif.forEach((item, sortedIdx) => {
    hasil[item.origIdx] = sortedIdx;
  });
  return hasil;
}

/** Pelaksana baru dari data pegawai; mempertahankan etape/biaya yang sudah ada. */
export function pelaksanaDariPegawai(
  awal: PelaksanaPayload,
  pegawai: { id: number; nama: string; nip: string; jabatan: string; instansi?: string; pangkatGolongan?: string; status: PelaksanaPayload["status"] },
): PelaksanaPayload {
  return { ...awal, pegawaiId: pegawai.id, nama: pegawai.nama, nip: pegawai.nip, jabatan: pegawai.jabatan, instansi: pegawai.instansi || INSTANSI_BAWAAN, pangkatGolongan: pegawai.pangkatGolongan ?? "", status: pegawai.status };
}

/** Menyalin isian surat tugas dari DTO server (membuang id, versi SBM, dan stempel waktu). */
export function payloadDariDto(dto: SuratTugasDto): SuratTugasPayload {
  return {
    nomor: dto.nomor,
    tanggal: dto.tanggal,
    tanggalSpj: dto.tanggalSpj ?? null,
    kodeAkun: dto.kodeAkun,
    catatan: dto.catatan,
    pelaksana: dto.pelaksana,
    tahunAnggaran: dto.tahunAnggaran ?? null,
    sumberDana: dto.sumberDana ?? "RM",
    pjNama: dto.pjNama ?? null,
    pjNip: dto.pjNip ?? null,
    pjJabatan: dto.pjJabatan ?? null,
  };
}

/** Menentukan apakah suatu nama kota termasuk kawasan Jabodetabek (Bogor, Depok, Tangerang, Bekasi, Kep. Seribu). */
export function isKotaJabodetabek(namaKota: string | null | undefined): boolean {
  if (!namaKota) return false;
  const s = namaKota.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    s.includes("bogor") ||
    s.includes("depok") ||
    s.includes("tangerang") ||
    s.includes("tanggerang") ||
    s.includes("tangsel") ||
    s.includes("bekasi") ||
    s.includes("seribu")
  );
}

/** Menentukan nama provinsi standar berdasarkan nama kota Jabodetabek. */
export function provinsiDariKotaJabodetabek(namaKota: string | null | undefined): string | null {
  if (!namaKota) return null;
  const s = namaKota.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("tangerang") || s.includes("tanggerang") || s.includes("tangsel")) {
    return "BANTEN";
  }
  if (s.includes("bogor") || s.includes("depok") || s.includes("bekasi")) {
    return "JAWA BARAT";
  }
  if (s.includes("seribu")) {
    return "D.K.I. JAKARTA";
  }
  return null;
}

/** Mencari baris SBM transportJakarta yang paling cocok dengan nama kota (fuzzy / keyword match). */
export function cocokkanKotaJakartaSekitar(
  namaKota: string | null | undefined,
  daftar: Array<{ kabKota: string; besaran: number }>,
): { kabKota: string; besaran: number } | null {
  if (!namaKota || !daftar || daftar.length === 0) return null;
  const s = namaKota.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return null;

  // 1. Exact stripped match
  const eksak = daftar.find((item) => item.kabKota.toLowerCase().replace(/[^a-z0-9]/g, "") === s);
  if (eksak) return eksak;

  // 2. Keyword-based matching with typo handling (e.g. tanggerang, tangsel)
  if (s.includes("tangsel") || (s.includes("tangerang") && s.includes("selatan")) || (s.includes("tanggerang") && s.includes("selatan"))) {
    return daftar.find((d) => d.kabKota === "Kota Tangerang Selatan") ?? null;
  }
  if (s.includes("tangerang") || s.includes("tanggerang")) {
    if (s.includes("kab")) {
      return daftar.find((d) => d.kabKota === "Kab. Tangerang") ?? null;
    }
    return daftar.find((d) => d.kabKota === "Kota Tangerang") ?? null;
  }
  if (s.includes("bogor")) {
    if (s.includes("kab")) {
      return daftar.find((d) => d.kabKota === "Kab. Bogor") ?? null;
    }
    return daftar.find((d) => d.kabKota === "Kota Bogor") ?? null;
  }
  if (s.includes("depok")) {
    return daftar.find((d) => d.kabKota === "Kota Depok") ?? null;
  }
  if (s.includes("bekasi")) {
    if (s.includes("kab")) {
      return daftar.find((d) => d.kabKota === "Kab. Bekasi") ?? null;
    }
    return daftar.find((d) => d.kabKota === "Kota Bekasi") ?? null;
  }
  if (s.includes("seribu")) {
    return daftar.find((d) => d.kabKota === "Kepulauan Seribu") ?? null;
  }

  // 3. Substring fallback
  return daftar.find((item) => item.kabKota.toLowerCase().includes(namaKota.toLowerCase())) ?? null;
}
