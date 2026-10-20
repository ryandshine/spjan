import { z } from "zod";

import { hitungLamaHariSt } from "./naskah-st.js";
import type { NaskahStPayload } from "./schemas.js";
import { parseTanggal, tanggalIndonesia } from "./teks.js";

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD");
const teksNull = (maks: number) => z.string().trim().max(maks).nullable();

export const HasilEkstraksiUndanganSchema = z.object({
  maksudTugas: teksNull(2000),
  lokasiTugas: teksNull(500),
  tanggalMulai: tanggalIso.nullable(),
  tanggalSelesai: tanggalIso.nullable(),
  nomorUndangan: teksNull(200),
  tanggalUndangan: tanggalIso.nullable(),
  penyelenggara: teksNull(300),
});
export type HasilEkstraksiUndangan = z.infer<typeof HasilEkstraksiUndanganSchema>;

export type BagianNaskahUsulan = Pick<
  NaskahStPayload,
  "maksudTugas" | "lokasiTugas" | "tanggalMulai" | "tanggalSelesai" | "dasarSpesifik"
>;
export type FieldUsulanUndangan = keyof BagianNaskahUsulan;

export interface UsulanIsian {
  field: FieldUsulanUndangan;
  label: string;
  nilaiLama: string;
  nilaiBaru: string;
  /** Nilai lama kosong atau masih bawaan: aman dicentang otomatis. */
  bawaanAtauKosong: boolean;
}

const LABEL: Record<FieldUsulanUndangan, string> = {
  maksudTugas: "Maksud penugasan",
  lokasiTugas: "Lokasi penugasan",
  tanggalMulai: "Tanggal mulai",
  tanggalSelesai: "Tanggal selesai",
  dasarSpesifik: "Dasar spesifik (undangan)",
};

const bersih = (s: string | null): string => (s ?? "").trim();

function rangkaiDasar(h: HasilEkstraksiUndangan): string {
  const penyelenggara = bersih(h.penyelenggara);
  const nomor = bersih(h.nomorUndangan);
  const tanggal = tanggalIndonesia(h.tanggalUndangan);
  if (!penyelenggara && !nomor && !tanggal) return "";
  return `Undangan${penyelenggara ? ` ${penyelenggara}` : ""}${nomor ? ` Nomor ${nomor}` : ""}${tanggal ? ` tanggal ${tanggal}` : ""}`;
}

export function usulanDariUndangan(
  naskah: BagianNaskahUsulan,
  hasil: HasilEkstraksiUndangan,
  hariIni: string,
): UsulanIsian[] {
  const usulan: UsulanIsian[] = [];
  const tambah = (field: FieldUsulanUndangan, nilaiBaru: string, bawaan: (lama: string) => boolean) => {
    const nilaiLama = naskah[field];
    if (!nilaiBaru || nilaiBaru === nilaiLama) return;
    usulan.push({ field, label: LABEL[field], nilaiLama, nilaiBaru, bawaanAtauKosong: bawaan(nilaiLama) });
  };
  const kosong = (lama: string) => lama.trim() === "";

  tambah("maksudTugas", bersih(hasil.maksudTugas), kosong);
  tambah("lokasiTugas", bersih(hasil.lokasiTugas), kosong);

  // Satu tanggal saja berarti kegiatan satu hari. Pasangan tidak valid atau terbalik dibuang.
  const mulai = hasil.tanggalMulai ?? hasil.tanggalSelesai;
  const selesai = hasil.tanggalSelesai ?? hasil.tanggalMulai;
  if (mulai && selesai && parseTanggal(mulai) && parseTanggal(selesai) && mulai <= selesai) {
    const bawaanTanggal = (lama: string) => lama === hariIni;
    tambah("tanggalMulai", mulai, bawaanTanggal);
    tambah("tanggalSelesai", selesai, bawaanTanggal);
  }

  tambah("dasarSpesifik", rangkaiDasar(hasil), kosong);
  return usulan;
}

export function terapkanUsulan(
  naskah: BagianNaskahUsulan,
  usulan: UsulanIsian[],
): Partial<Pick<NaskahStPayload, FieldUsulanUndangan | "lamaHari">> {
  const patch: Partial<Pick<NaskahStPayload, FieldUsulanUndangan | "lamaHari">> = {};
  for (const u of usulan) patch[u.field] = u.nilaiBaru;
  if (patch.tanggalMulai !== undefined || patch.tanggalSelesai !== undefined) {
    patch.lamaHari = hitungLamaHariSt(patch.tanggalMulai ?? naskah.tanggalMulai, patch.tanggalSelesai ?? naskah.tanggalSelesai);
  }
  return patch;
}
