import { z } from "zod";

import { bidangPerluDicek, pesanPerluDicek } from "./perlu-dicek.js";

import type { BerkasDto, StatusUsulan } from "./berkas.js";
import type {
  PelaksanaPayload,
  SuratTugasDto,
  SuratTugasPayload,
} from "./schemas.js";
import { bersihkanGelarNama } from "./st-ekstraksi.js";
import { norm, parseTanggal, selisihHari } from "./teks.js";
import type { JenisBiaya, Sbm } from "./types.js";

export const ArahTiketSchema = z.enum(["pergi", "kembali", "lainnya"]);
export type ArahTiket = z.infer<typeof ArahTiketSchema>;

export const ModaTiketSchema = z.enum(["pesawat", "kereta", "kapal", "bus", "lainnya"]);
export type ModaTiket = z.infer<typeof ModaTiketSchema>;

export const SegmenTiketSchema = z.object({
  asal: z.string().trim().min(1).max(100),
  tujuan: z.string().trim().min(1).max(100),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  jam: z.string().trim().max(20).nullable().optional(),
  nomorPenerbangan: z.string().trim().max(50).nullable().optional(),
  arah: ArahTiketSchema.optional().default("lainnya"),
  /** Harga segmen bila tertera terpisah di tiket; null bila hanya ada satu total. */
  tarif: z.number().int().nonnegative().nullable().optional(),
  /** Penumpang pada arah ini bila berbeda dari daftarPenumpang (mis. sebagian pulang di hari lain); kosong = semua. Isian rusak diabaikan. */
  penumpangArah: z.array(z.string().trim().min(1).max(200)).max(20).optional().catch(undefined),
});
export type SegmenTiket = z.infer<typeof SegmenTiketSchema>;

/** Jatah satu penumpang pada satu arah, dibaca dan diperkirakan langsung oleh AI dari isi tiket. */
export const RincianPenumpangSchema = z.object({
  nama: z.string().trim().min(1).max(200),
  /** Nama pelaksana surat tugas yang cocok (dipilih AI dari daftar yang diberikan); null bila tidak ada. */
  pelaksana: z.string().trim().max(200).nullable().optional(),
  arah: ArahTiketSchema.optional().default("lainnya"),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  asal: z.string().trim().max(100).nullable().optional(),
  tujuan: z.string().trim().max(100).nullable().optional(),
  nomorPenerbangan: z.string().trim().max(50).nullable().optional(),
  tarif: z.number().int().nonnegative(),
  /** tertera = harga orang itu tertulis; dibagi_rata = total arah dibagi jumlah penumpangnya; perkiraan = ditaksir AI. */
  dasar: z.enum(["tertera", "dibagi_rata", "perkiraan"]).optional().default("perkiraan"),
});
export type RincianPenumpang = z.infer<typeof RincianPenumpangSchema>;

export const HasilEkstraksiTiketSchema = z.object({
  maskapai: z.string().trim().min(1).max(100),
  kodeBooking: z.string().trim().max(50).nullable(),
  nomorTiket: z.string().trim().max(100).nullable(),
  penumpang: z.string().trim().max(200).nullable(),
  /** Semua nama penumpang di tiket; `tarif` adalah total untuk seluruh penumpang ini. Kosong pada ekstraksi lama. */
  daftarPenumpang: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional()
    .default([]),
  asal: z.string().trim().min(1).max(100),
  tujuan: z.string().trim().min(1).max(100),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  jam: z.string().trim().max(20).nullable().optional(),
  nomorPenerbangan: z.string().trim().max(50).nullable().optional(),
  tarif: z.number().int().nonnegative(),
  /** Arti `tarif`: total seluruh penumpang (dibagi rata), harga per penumpang (dipakai apa adanya), atau tidak jelas. */
  basisTarif: z
    .enum(["total", "per_penumpang", "tidak_jelas"])
    .optional()
    .default("total"),
  arah: ArahTiketSchema.optional().default("lainnya"),
  /** Moda angkutan yang terbaca dari dokumen. Kosong pada ekstraksi lama: disimpulkan dari nama operator. */
  moda: ModaTiketSchema.optional().default("lainnya"),
  /** Semua arah perjalanan dalam dokumen; `tarif` di atas tetap total seluruh segmen. Kosong pada ekstraksi lama. */
  segmen: z.array(SegmenTiketSchema).max(6).optional().default([]),
  /** Jatah tiap penumpang per arah menurut AI; dipakai apa adanya dan diperiksa terhadap total. Isian rusak diabaikan. */
  rincianPenumpang: z.array(RincianPenumpangSchema).max(60).optional().catch(undefined),
  perluDicek: bidangPerluDicek,
});
export type HasilEkstraksiTiket = z.infer<typeof HasilEkstraksiTiketSchema>;

export const KategoriTransportSchema = z.enum([
  "taksi",
  "darat",
  "sewa_kendaraan",
  "lainnya",
]);
export type KategoriTransport = z.infer<typeof KategoriTransportSchema>;

export const HasilEkstraksiTransportSchema = z.object({
  kategori: KategoriTransportSchema,
  penyedia: z.string().trim().max(100).nullable(),
  nomorKuitansi: z.string().trim().max(100).nullable(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  uraian: z.string().trim().min(1).max(300),
  totalBiaya: z.number().int().nonnegative(),
  perluDicek: bidangPerluDicek,
});
export type HasilEkstraksiTransport = z.infer<
  typeof HasilEkstraksiTransportSchema
>;

export interface UsulanTransportItem {
  berkasId: number;
  /** Berasal dari pembacaan ulang berkas yang sudah pernah selesai dibaca: tinjau manual, jangan diterapkan otomatis. */
  bacaUlang?: boolean;
  namaBerkas: string;
  kategoriBerkas: "tiket" | "transport";
  ekstraksi: HasilEkstraksiTiket | HasilEkstraksiTransport;
  usulanStatus: StatusUsulan;
  /** Jumlah usulan yang berasal dari berkas ini (>1 bila satu tiket memuat beberapa penumpang atau segmen). */
  jumlahPenerima: number;
  pelaksanaId: number | null;
  pelaksanaIndex: number;
  etapeIndex: number;
  pelaksanaNama: string;
  jenisBiaya: JenisBiaya;
  uraianBiaya: string;
  tarifRiil: number;
  qty: number;
  satuan: string;
  provinsi: string | null;
  keterangan: string;
  peringatan: string[];
}

/** Indeks pelaksana yang namanya cocok dengan nama di dokumen (gelar diabaikan), atau -1. */
function cocokNama(
  st: SuratTugasDto | SuratTugasPayload,
  nama: string,
): number {
  const namaNorm = bersihkanGelarNama(nama);
  if (!namaNorm) return -1;
  const nWords = namaNorm.split(/\s+/).filter((w) => w.length > 2);
  return st.pelaksana.findIndex((p: PelaksanaPayload) => {
    const pNama = bersihkanGelarNama(p.nama);
    if (pNama.includes(namaNorm) || namaNorm.includes(pNama)) return true;
    const pWords = pNama.split(/\s+/).filter((w) => w.length > 2);
    const cocokCount = pWords.filter((pw) =>
      nWords.some((nw) => nw === pw || nw.includes(pw) || pw.includes(nw)),
    ).length;
    return cocokCount >= 2;
  });
}

/** Bagi total rata ke n orang; sisa pembagian (rupiah bulat) ditambahkan ke orang pertama agar jumlahnya tetap. */
export function bagiRata(total: number, n: number): number[] {
  if (n <= 1) return [total];
  const dasar = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? total - dasar * (n - 1) : dasar,
  );
}

/** Bagi tarif seorang penumpang ke segmen: mengikuti harga per segmen bila lengkap dan jumlahnya sama dengan total, selain itu rata. */
function bagiTarifSegmen(
  tarif: number,
  total: number,
  segmen: SegmenTiket[],
): { bagian: number[]; rata: boolean } {
  const harga = segmen.map((s) => s.tarif ?? 0);
  const lengkap = harga.every((h) => h > 0) && harga.reduce((a, h) => a + h, 0) === total;
  if (!lengkap) return { bagian: bagiRata(tarif, segmen.length), rata: true };
  const bagian = harga.map((h) => Math.floor((tarif * h) / total));
  bagian[0] = tarif - bagian.slice(1).reduce((a, h) => a + h, 0);
  return { bagian, rata: false };
}

function cocokkanPelaksana(
  st: SuratTugasDto | SuratTugasPayload,
  namaKandidat: string | null | undefined,
  pelaksanaIdBerkas: number | null | undefined,
  tanggalBerkas: string,
): { pelaksanaIndex: number; etapeIndex: number; pelaksanaId: number | null } {
  // 1. Cek kesesuaian pelaksanaId dari berkas jika sudah terikat
  if (pelaksanaIdBerkas != null && "id" in (st.pelaksana[0] ?? {})) {
    const idx = st.pelaksana.findIndex(
      (p: PelaksanaPayload) => (p as { id?: number }).id === pelaksanaIdBerkas,
    );
    if (idx >= 0) {
      const p = st.pelaksana[idx]!;
      const ei = p.etape.findIndex(
        (e) => e.berangkat <= tanggalBerkas && e.pulang >= tanggalBerkas,
      );
      return {
        pelaksanaIndex: idx,
        etapeIndex: ei >= 0 ? ei : 0,
        pelaksanaId: pelaksanaIdBerkas,
      };
    }
  }

  // 2. Cek kesesuaian nama penumpang/kandidat
  if (namaKandidat && namaKandidat.trim().length > 0) {
    const idx = cocokNama(st, namaKandidat);
    if (idx >= 0) {
      const p = st.pelaksana[idx]!;
      const ei = p.etape.findIndex(
        (e) => e.berangkat <= tanggalBerkas && e.pulang >= tanggalBerkas,
      );
      const pid = "id" in p ? ((p as { id?: number }).id ?? null) : null;
      return {
        pelaksanaIndex: idx,
        etapeIndex: ei >= 0 ? ei : 0,
        pelaksanaId: pid,
      };
    }
  }

  // 3. Cek kesesuaian berdasarkan tanggal etape
  for (let pi = 0; pi < st.pelaksana.length; pi += 1) {
    const p = st.pelaksana[pi]!;
    const ei = p.etape.findIndex(
      (e) => e.berangkat <= tanggalBerkas && e.pulang >= tanggalBerkas,
    );
    if (ei >= 0) {
      const pid = "id" in p ? ((p as { id?: number }).id ?? null) : null;
      return { pelaksanaIndex: pi, etapeIndex: ei, pelaksanaId: pid };
    }
  }

  // Fallback: pelaksana pertama, etape pertama
  const p0 = st.pelaksana[0];
  const pid = p0 && "id" in p0 ? ((p0 as { id?: number }).id ?? null) : null;
  return { pelaksanaIndex: 0, etapeIndex: 0, pelaksanaId: pid };
}

/** Moda tiket: dari hasil baca dokumen; bila tidak jelas, dari nama operator; selain itu pesawat. */
export function tentukanModaTiket(moda: ModaTiket, operator: string): Exclude<ModaTiket, "lainnya"> {
  if (moda !== "lainnya") return moda;
  if (/\bkai\b|kereta|\bwhoosh\b/i.test(operator)) return "kereta";
  if (/pelni|asdp|kapal|\bferry\b|\bferi\b|\bkmp?\b/i.test(operator)) return "kapal";
  if (/\bbus\b|travel/i.test(operator)) return "bus";
  return "pesawat";
}

/** Apakah teks asal/tujuan tiket menunjuk kota kedudukan (Jakarta juga dikenali lewat kode bandara CGK/HLP). */
function cocokKedudukan(teks: string, kedudukan: string): boolean {
  if (norm(kedudukan).includes("JAKARTA")) return /jakarta|cgk|hlp|soekarno/i.test(teks);
  return norm(teks).includes(norm(kedudukan));
}

/**
 * Memetakan daftar berkas tiket dan bukti transport ke usulan biaya Surat Tugas.
 */
/** Harga per arah lengkap: dua arah atau lebih, semuanya berharga. */
function hargaArahLengkap(t: HasilEkstraksiTiket): boolean {
  return t.segmen.length >= 2 && t.segmen.every((s) => (s.tarif ?? 0) > 0);
}

/**
 * Total tiket yang dipakai. Model kadang mengisi `tarif` hanya dengan harga arah pertama padahal harga tiap arah tertera;
 * bila jumlah harga per arah lebih besar, jumlah itulah totalnya.
 */
function totalTiket(t: HasilEkstraksiTiket): number {
  if (!hargaArahLengkap(t)) return t.tarif;
  const jumlah = t.segmen.reduce((a, s) => a + (s.tarif ?? 0), 0);
  return jumlah > t.tarif ? jumlah : t.tarif;
}

/** Kunci booking: kode booking + daftar penumpang + jadwal per arah. Berkas dengan kunci sama = salinan e-tiket booking yang sama. */
function kunciBooking(t: HasilEkstraksiTiket): string | null {
  const kode = t.kodeBooking?.trim().toUpperCase();
  if (!kode) return null;
  const nama = (t.daftarPenumpang.length > 0 ? t.daftarPenumpang : t.penumpang ? [t.penumpang] : []).map((n) => norm(n)).sort();
  // Jadwal per arah ikut kunci: e-tiket tiap orang bisa memuat pulang yang berbeda (mis. satu orang pulang lebih awal).
  const jadwal = (t.segmen.length > 0 ? t.segmen : [t]).map((s) => `${norm(s.asal)}>${norm(s.tujuan)}@${s.tanggal}`);
  return `${kode}|${nama.join(";")}|${jadwal.join(";")}`;
}

/**
 * Satu booking rombongan sering diunggah sekali per penumpang (tiap orang mengunggah e-tiketnya yang memuat semua nama).
 * Pilih satu berkas per booking: yang harga per arahnya lengkap, selain itu yang pertama.
 */
function berkasWakilBooking(daftar: BerkasDto[]): Map<string, number> {
  const wakil = new Map<string, { id: number; lengkap: boolean }>();
  for (const b of daftar) {
    if (b.jenis !== "tiket") continue;
    const parse = HasilEkstraksiTiketSchema.safeParse(b.ekstraksi?.hasil);
    if (!parse.success) continue;
    const kunci = kunciBooking(parse.data);
    if (!kunci) continue;
    const lengkap = hargaArahLengkap(parse.data);
    const ada = wakil.get(kunci);
    if (!ada || (lengkap && !ada.lengkap)) wakil.set(kunci, { id: b.id, lengkap });
  }
  return new Map([...wakil.entries()].map(([k, v]) => [k, v.id]));
}

/** Berkas tiket salinan (id) beserta berkas wakil booking-nya (id) dan kode bookingnya, untuk keterangan di daftar bukti. */
export function salinanBookingTiket(daftar: BerkasDto[]): Map<number, { wakilId: number; kodeBooking: string }> {
  const selesai = daftar.filter((b) => b.jenis === "tiket" && b.ekstraksi?.status === "selesai" && b.ekstraksi.hasil);
  const wakil = berkasWakilBooking(selesai);
  const hasil = new Map<number, { wakilId: number; kodeBooking: string }>();
  for (const b of selesai) {
    const parse = HasilEkstraksiTiketSchema.safeParse(b.ekstraksi?.hasil);
    if (!parse.success) continue;
    const kunci = kunciBooking(parse.data);
    const wakilId = kunci ? wakil.get(kunci) : undefined;
    if (wakilId !== undefined && wakilId !== b.id) hasil.set(b.id, { wakilId, kodeBooking: parse.data.kodeBooking?.trim().toUpperCase() ?? "" });
  }
  return hasil;
}

export function petakanTransportKeUsulan(
  daftarBerkas: BerkasDto[],
  st: SuratTugasDto | SuratTugasPayload,
  _sbm?: Sbm,
  /** Kota kedudukan bawaan (Pengaturan); dipakai bila pelaksana tidak punya kedudukan sendiri. Kosong = Jakarta. */
  kotaKedudukanDasar?: string | null,
): UsulanTransportItem[] {
  const usulan: UsulanTransportItem[] = [];

  const berkasRelevan = daftarBerkas.filter(
    (b) =>
      (b.jenis === "tiket" || b.jenis === "transport") &&
      b.ekstraksi?.status === "selesai" &&
      b.ekstraksi.hasil,
  );

  const wakilBooking = berkasWakilBooking(berkasRelevan);
  const arahTerhitung = new Set<string>();

  for (const b of berkasRelevan) {
    if (b.jenis === "tiket") {
      const parse = HasilEkstraksiTiketSchema.safeParse(b.ekstraksi?.hasil);
      if (!parse.success) continue;
      // Salinan e-tiket booking yang sama sudah dihitung dari berkas wakilnya.
      const kunci = kunciBooking(parse.data);
      if (kunci && wakilBooking.get(kunci) !== b.id) continue;
      const t = { ...parse.data, tarif: totalTiket(parse.data) };

      // Satu tiket bisa memuat beberapa penumpang: total dibagi rata ke pelaksana yang namanya cocok.
      const namaDiTiket = t.daftarPenumpang.length > 0 ? t.daftarPenumpang : [];
      const penerima: {
        pelaksanaIndex: number;
        etapeIndex: number;
        pelaksanaId: number | null;
        tarif: number;
        peringatanBagi: string[];
      }[] = [];
      if (namaDiTiket.length > 1) {
        const perOrang = t.basisTarif === "per_penumpang";
        const bagian = perOrang
          ? namaDiTiket.map(() => t.tarif)
          : bagiRata(t.tarif, namaDiTiket.length);
        const tidakCocok = namaDiTiket.filter(
          (n) => cocokNama(st, n) < 0,
        ).length;
        const sudah = new Set<number>();
        namaDiTiket.forEach((nama, k) => {
          const idx = cocokNama(st, nama);
          if (idx < 0 || sudah.has(idx)) return;
          sudah.add(idx);
          const p = st.pelaksana[idx]!;
          const ei = p.etape.findIndex(
            (e) => e.berangkat <= t.tanggal && e.pulang >= t.tanggal,
          );
          penerima.push({
            pelaksanaIndex: idx,
            etapeIndex: ei >= 0 ? ei : 0,
            pelaksanaId: "id" in p ? ((p as { id?: number }).id ?? null) : null,
            tarif: bagian[k] ?? 0,
            peringatanBagi: [
              perOrang
                ? `Tiket untuk ${namaDiTiket.length} penumpang, harga di tiket per penumpang (dipakai apa adanya).`
                : `Tiket untuk ${namaDiTiket.length} penumpang (total ${t.tarif.toLocaleString("id-ID")}), tarif dibagi rata.`,
              ...(t.basisTarif === "tidak_jelas"
                ? [
                    "Tiket tidak menyebut harga total atau per penumpang; dianggap total. Periksa tarif.",
                  ]
                : []),
              ...(tidakCocok > 0
                ? [
                    `${tidakCocok} penumpang lain tidak cocok dengan pelaksana mana pun.`,
                  ]
                : []),
            ],
          });
        });
      }
      if (penerima.length === 0) {
        const m = cocokkanPelaksana(st, t.penumpang, b.pelaksanaId, t.tanggal);
        penerima.push({ ...m, tarif: t.tarif, peringatanBagi: [] });
      }

      // Satu dokumen pergi-pulang: satu usulan per segmen. Di bawah ini `t` adalah data segmen tersebut.
      const tiket = t;
      const daftarSegmen: SegmenTiket[] = tiket.segmen.length >= 2 ? tiket.segmen : [tiket];

      // Alokasi (pelaksana, arah, tarif). Bila tiket menyebut penumpang per arah dan harga tiap arah tertera,
      // harga satu arah dibagi ke penumpang arah itu saja; selain itu jatah per orang dibagi ke semua arah.
      const alokasi: { pen: (typeof penerima)[number]; seg: SegmenTiket; tarif: number; rata: boolean }[] = [];
      const adaPenumpangArah = tiket.segmen.some((s) => (s.penumpangArah?.length ?? 0) > 0);
      const rincian = tiket.rincianPenumpang ?? [];
      if (rincian.length > 0) {
        // AI sudah membaca dan memperkirakan jatah tiap orang per arah: dipakai apa adanya, kode hanya memeriksa.
        const jumlahRincian = rincian.reduce((a, r) => a + r.tarif, 0);
        // Pembagian rata yang dibulatkan bisa meleset Rp1 per baris; selisih sebesar itu bukan kesalahan baca.
        const selisih = Math.abs(jumlahRincian - tiket.tarif) > rincian.length
          ? [`Perlu dicek: rincian per penumpang berjumlah ${jumlahRincian.toLocaleString("id-ID")}, tidak sama dengan total tiket ${tiket.tarif.toLocaleString("id-ID")}.`]
          : [];
        const tidakCocok = rincian.filter((r) => cocokNama(st, r.pelaksana || r.nama) < 0 && cocokNama(st, r.nama) < 0).length;
        for (const r of rincian) {
          let idx = r.pelaksana ? cocokNama(st, r.pelaksana) : -1;
          if (idx < 0) idx = cocokNama(st, r.nama);
          if (idx < 0) continue;
          const p = st.pelaksana[idx]!;
          const acuan =
            daftarSegmen.find((s) => s.tanggal === r.tanggal && s.arah === r.arah) ??
            daftarSegmen.find((s) => s.arah === r.arah) ??
            daftarSegmen[0]!;
          const seg: SegmenTiket = {
            ...acuan,
            asal: r.asal || acuan.asal,
            tujuan: r.tujuan || acuan.tujuan,
            tanggal: r.tanggal,
            arah: r.arah,
            nomorPenerbangan: r.nomorPenerbangan ?? acuan.nomorPenerbangan ?? null,
            tarif: r.tarif,
          };
          const ei = p.etape.findIndex((e) => e.berangkat <= r.tanggal && e.pulang >= r.tanggal);
          alokasi.push({
            pen: {
              pelaksanaIndex: idx,
              etapeIndex: ei >= 0 ? ei : 0,
              pelaksanaId: "id" in p ? ((p as { id?: number }).id ?? null) : null,
              tarif: 0,
              peringatanBagi: [
                r.dasar === "tertera"
                  ? "Tarif orang ini tertera di tiket."
                  : r.dasar === "dibagi_rata"
                    ? "Tarif dari total arah ini dibagi rata ke penumpangnya (menurut AI)."
                    : "Perlu dicek: tarif orang ini diperkirakan AI dari isi tiket.",
                ...selisih,
                ...(tidakCocok > 0 ? [`${tidakCocok} baris rincian penumpang tidak cocok dengan pelaksana mana pun.`] : []),
              ],
            },
            seg,
            tarif: r.tarif,
            rata: false,
          });
        }
      }
      if (alokasi.length === 0 && adaPenumpangArah && (daftarSegmen.length === 1 || hargaArahLengkap(tiket))) {
        const perOrang = tiket.basisTarif === "per_penumpang";
        for (const seg of daftarSegmen) {
          const namaArah = "penumpangArah" in seg && seg.penumpangArah?.length ? seg.penumpangArah : namaDiTiket.length > 0 ? namaDiTiket : tiket.penumpang ? [tiket.penumpang] : [];
          const harga = daftarSegmen.length === 1 ? tiket.tarif : (seg.tarif ?? 0);
          const bagian = perOrang ? namaArah.map(() => harga) : bagiRata(harga, namaArah.length);
          const tidakCocok = namaArah.filter((n) => cocokNama(st, n) < 0).length;
          const sudah = new Set<number>();
          namaArah.forEach((nama, k) => {
            const idx = cocokNama(st, nama);
            if (idx < 0 || sudah.has(idx)) return;
            sudah.add(idx);
            const p = st.pelaksana[idx]!;
            const ei = p.etape.findIndex((e) => e.berangkat <= seg.tanggal && e.pulang >= seg.tanggal);
            alokasi.push({
              pen: {
                pelaksanaIndex: idx,
                etapeIndex: ei >= 0 ? ei : 0,
                pelaksanaId: "id" in p ? ((p as { id?: number }).id ?? null) : null,
                tarif: 0,
                peringatanBagi: [
                  namaArah.length > 1
                    ? perOrang
                      ? `Arah ${seg.asal} - ${seg.tujuan} untuk ${namaArah.length} penumpang, harga per penumpang (dipakai apa adanya).`
                      : `Arah ${seg.asal} - ${seg.tujuan} untuk ${namaArah.length} penumpang (total ${harga.toLocaleString("id-ID")}), tarif dibagi rata.`
                    : `Arah ${seg.asal} - ${seg.tujuan} hanya untuk 1 penumpang.`,
                  ...(tidakCocok > 0 ? [`${tidakCocok} penumpang lain tidak cocok dengan pelaksana mana pun.`] : []),
                ],
              },
              seg,
              tarif: bagian[k] ?? 0,
              rata: false,
            });
          });
        }
      }
      if (alokasi.length === 0) {
        for (const pen of penerima) {
          const pembagian = bagiTarifSegmen(pen.tarif, tiket.tarif, daftarSegmen);
          for (const [iSegmen, seg] of daftarSegmen.entries()) {
            alokasi.push({ pen, seg, tarif: pembagian.bagian[iSegmen] ?? 0, rata: pembagian.rata });
          }
        }
      }
      const kodeBooking = tiket.kodeBooking?.trim().toUpperCase();

      for (const { pen, seg, tarif: tarifAlokasi, rata } of alokasi) {
        const { pelaksanaIndex, pelaksanaId } = pen;
        const pelaksana = st.pelaksana[pelaksanaIndex];
        if (!pelaksana) continue;
        // Satu arah dalam satu booking dihitung sekali per orang, walau muncul di beberapa berkas.
        if (kodeBooking) {
          const kunciArah = `${kodeBooking}|${norm(seg.asal)}>${norm(seg.tujuan)}@${seg.tanggal}|${pelaksanaIndex}`;
          if (arahTerhitung.has(kunciArah)) continue;
          arahTerhitung.add(kunciArah);
        }
        {
        const { penumpangArah: _penumpangArah, ...dataArah } = seg;
        const t = { ...tiket, ...dataArah, tarif: tiket.tarif, segmen: [] };
        const eiSegmen = pelaksana.etape.findIndex((e) => e.berangkat <= t.tanggal && e.pulang >= t.tanggal);
        const etapeIndex = eiSegmen >= 0 ? eiSegmen : pen.etapeIndex;
        const etape = pelaksana.etape[etapeIndex];
        const peringatan: string[] = [...pen.peringatanBagi, ...pesanPerluDicek(tiket.perluDicek)];
        if (daftarSegmen.length > 1 && rata) {
          peringatan.push(`Tiket memuat ${daftarSegmen.length} segmen tanpa harga terpisah; tarif dibagi rata. Periksa tarif.`);
        }

        // Validasi tanggal terhadap rentang etape
        if (etape) {
          if (t.tanggal < etape.berangkat || t.tanggal > etape.pulang) {
            peringatan.push(
              `Tanggal tiket (${t.tanggal}) berada di luar rentang tanggal etape (${etape.berangkat} s.d. ${etape.pulang}).`,
            );
          }
        }

        // Tentukan jenis biaya
        let jenisBiaya: JenisBiaya = "TIKET_PERGI";
        const moda = tentukanModaTiket(t.moda, t.maskapai);

        if (moda === "kereta") {
          jenisBiaya = "TIKET_KERETA";
        } else if (moda === "kapal") {
          jenisBiaya = "TIKET_KAPAL";
        } else if (moda === "bus") {
          jenisBiaya = "KERETA_BUS_LAIN";
        } else {
          const kedudukan = pelaksana.kotaKedudukan?.trim() || kotaKedudukanDasar?.trim() || "Jakarta";
          const tujuanKeKedudukan = cocokKedudukan(t.tujuan, kedudukan);
          const asalDariKedudukan = cocokKedudukan(t.asal, kedudukan);

          if (tujuanKeKedudukan && !asalDariKedudukan) {
            jenisBiaya = "TIKET_KEMBALI";
          } else if (asalDariKedudukan && !tujuanKeKedudukan) {
            jenisBiaya = "TIKET_PERGI";
          } else if (t.arah === "kembali") {
            jenisBiaya = "TIKET_KEMBALI";
          } else if (t.arah === "pergi") {
            jenisBiaya = "TIKET_PERGI";
          } else if (etape) {
            // Deteksi dari tanggal etape
            const dTiket = parseTanggal(t.tanggal);
            const dPulang = parseTanggal(etape.pulang);
            const dBerangkat = parseTanggal(etape.berangkat);
            if (dTiket && dPulang && dBerangkat) {
              const bedaPergi = Math.abs(selisihHari(dTiket, dBerangkat));
              const bedaPulang = Math.abs(selisihHari(dTiket, dPulang));
              jenisBiaya =
                bedaPulang < bedaPergi ? "TIKET_KEMBALI" : "TIKET_PERGI";
            }
          }
        }

        const jenisModa = { pesawat: "Pesawat", kereta: "Kereta Api", kapal: "Kapal Laut", bus: "Bus" }[moda];
        const uraianBiaya = `Tiket ${jenisModa} ${t.asal} - ${t.tujuan}${t.nomorPenerbangan ? ` (${t.nomorPenerbangan})` : ""}`;
        const keterangan = `Tgl: ${t.tanggal}, No. Tiket: ${t.nomorTiket ?? t.kodeBooking ?? "-"}`;

        usulan.push({
          berkasId: b.id,
          namaBerkas: b.namaAsli,
          kategoriBerkas: "tiket",
          ekstraksi: t,
          usulanStatus: b.ekstraksi?.usulanStatus ?? "menunggu",
          bacaUlang: b.ekstraksi?.bacaUlang ?? false,
          jumlahPenerima: alokasi.length,
          pelaksanaId,
          pelaksanaIndex,
          etapeIndex,
          pelaksanaNama: pelaksana.nama,
          jenisBiaya,
          uraianBiaya,
          tarifRiil: tarifAlokasi,
          qty: 1,
          satuan: "orang",
          provinsi: etape?.provinsi ?? null,
          keterangan,
          peringatan,
        });
        }
      }
    } else if (b.jenis === "transport") {
      const parse = HasilEkstraksiTransportSchema.safeParse(b.ekstraksi?.hasil);
      if (!parse.success) continue;
      const tr = parse.data;

      const { pelaksanaIndex, etapeIndex, pelaksanaId } = cocokkanPelaksana(
        st,
        null,
        b.pelaksanaId,
        tr.tanggal,
      );

      const pelaksana = st.pelaksana[pelaksanaIndex];
      if (!pelaksana) continue;
      const etape = pelaksana.etape[etapeIndex];
      const peringatan: string[] = pesanPerluDicek(tr.perluDicek);

      let jenisBiaya: JenisBiaya = "TAKSI_TERMINAL";
      if (tr.kategori === "sewa_kendaraan") {
        jenisBiaya = "SEWA_RODA4";
      } else if (tr.kategori === "darat") {
        jenisBiaya = "TRANSPORT_DARAT";
      } else if (tr.kategori === "taksi") {
        jenisBiaya = "TAKSI_TERMINAL";
      } else {
        jenisBiaya = "LAINNYA";
      }

      const uraianBiaya =
        tr.uraian || `Transportasi ${tr.penyedia ?? ""}`.trim();
      const keterangan = tr.nomorKuitansi
        ? `No: ${tr.nomorKuitansi}, Tgl: ${tr.tanggal}`
        : `Tgl: ${tr.tanggal}`;

      usulan.push({
        berkasId: b.id,
        namaBerkas: b.namaAsli,
        kategoriBerkas: "transport",
        ekstraksi: tr,
        usulanStatus: b.ekstraksi?.usulanStatus ?? "menunggu",
        bacaUlang: b.ekstraksi?.bacaUlang ?? false,
        jumlahPenerima: 1,
        pelaksanaId,
        pelaksanaIndex,
        etapeIndex,
        pelaksanaNama: pelaksana.nama,
        jenisBiaya,
        uraianBiaya,
        tarifRiil: tr.totalBiaya,
        qty: 1,
        satuan: "kali",
        provinsi: etape?.provinsi ?? null,
        keterangan,
        peringatan,
      });
    }
  }

  return usulan;
}
