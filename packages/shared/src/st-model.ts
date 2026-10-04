import type { BiayaPayload, EtapePayload, PelaksanaPayload, SuratTugasDto, SuratTugasPayload } from "./schemas.js";
import { parseTanggal, selisihHari } from "./teks.js";
import type { BiayaInput, JenisBiaya } from "./types.js";

export function stKosong(kodeAkun = ""): SuratTugasPayload {
  return { nomor: "", tanggal: "", tanggalSpj: null, kodeAkun, catatan: "", pelaksana: [] };
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
    status: null,
    noSpd: null,
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

export function ringkasEtape(e: Pick<EtapePayload, "berangkat" | "pulang" | "malamOverride">): RingkasEtape {
  const a = parseTanggal(e.berangkat);
  const b = parseTanggal(e.pulang);
  if (!a || !b) return { hari: null, malam: null };
  const hari = selisihHari(a, b) + 1;
  if (hari < 1) return { hari: null, malam: null };
  return { hari, malam: e.malamOverride != null ? e.malamOverride : Math.max(hari - 1, 0) };
}

/**
 * hitungSpj membuang biaya bertarif <= 0, sehingga indeks baris transport hasil tidak sejajar
 * dengan indeks biaya masukan. Mengembalikan, untuk tiap biaya masukan, indeks barisnya pada
 * `transport` hasil (atau null bila biaya itu tidak menghasilkan baris).
 */
export function indeksBarisTransport(biaya: Pick<BiayaInput, "tarif">[]): Array<number | null> {
  let berikut = 0;
  return biaya.map((b) => (b.tarif > 0 ? berikut++ : null));
}

/** Pelaksana baru dari data pegawai; mempertahankan etape/biaya yang sudah ada. */
export function pelaksanaDariPegawai(
  awal: PelaksanaPayload,
  pegawai: { id: number; nama: string; nip: string; jabatan: string; status: PelaksanaPayload["status"] },
): PelaksanaPayload {
  return { ...awal, pegawaiId: pegawai.id, nama: pegawai.nama, nip: pegawai.nip, jabatan: pegawai.jabatan, status: pegawai.status };
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
  };
}
