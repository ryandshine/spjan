import { z } from "zod";

import type { BerkasDto, StatusUsulan } from "./berkas.js";
import type { PelaksanaPayload, SuratTugasDto, SuratTugasPayload } from "./schemas.js";
import { bersihkanGelarNama } from "./st-ekstraksi.js";
import { parseTanggal, selisihHari } from "./teks.js";
import type { JenisBiaya, Sbm } from "./types.js";

export const ArahTiketSchema = z.enum(["pergi", "kembali", "lainnya"]);
export type ArahTiket = z.infer<typeof ArahTiketSchema>;

export const HasilEkstraksiTiketSchema = z.object({
  maskapai: z.string().trim().min(1).max(100),
  kodeBooking: z.string().trim().max(50).nullable(),
  nomorTiket: z.string().trim().max(100).nullable(),
  penumpang: z.string().trim().max(200).nullable(),
  asal: z.string().trim().min(1).max(100),
  tujuan: z.string().trim().min(1).max(100),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  jam: z.string().trim().max(20).nullable().optional(),
  nomorPenerbangan: z.string().trim().max(50).nullable().optional(),
  tarif: z.number().int().nonnegative(),
  arah: ArahTiketSchema.optional().default("lainnya"),
});
export type HasilEkstraksiTiket = z.infer<typeof HasilEkstraksiTiketSchema>;

export const KategoriTransportSchema = z.enum(["taksi", "darat", "sewa_kendaraan", "lainnya"]);
export type KategoriTransport = z.infer<typeof KategoriTransportSchema>;

export const HasilEkstraksiTransportSchema = z.object({
  kategori: KategoriTransportSchema,
  penyedia: z.string().trim().max(100).nullable(),
  nomorKuitansi: z.string().trim().max(100).nullable(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  uraian: z.string().trim().min(1).max(300),
  totalBiaya: z.number().int().nonnegative(),
});
export type HasilEkstraksiTransport = z.infer<typeof HasilEkstraksiTransportSchema>;

export interface UsulanTransportItem {
  berkasId: number;
  namaBerkas: string;
  kategoriBerkas: "tiket" | "transport";
  ekstraksi: HasilEkstraksiTiket | HasilEkstraksiTransport;
  usulanStatus: StatusUsulan;
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

function cocokkanPelaksana(
  st: SuratTugasDto | SuratTugasPayload,
  namaKandidat: string | null | undefined,
  pelaksanaIdBerkas: number | null | undefined,
  tanggalBerkas: string,
): { pelaksanaIndex: number; etapeIndex: number; pelaksanaId: number | null } {
  // 1. Cek kesesuaian pelaksanaId dari berkas jika sudah terikat
  if (pelaksanaIdBerkas != null && "id" in (st.pelaksana[0] ?? {})) {
    const idx = st.pelaksana.findIndex((p: PelaksanaPayload) => (p as { id?: number }).id === pelaksanaIdBerkas);
    if (idx >= 0) {
      const p = st.pelaksana[idx]!;
      const ei = p.etape.findIndex((e) => e.berangkat <= tanggalBerkas && e.pulang >= tanggalBerkas);
      return {
        pelaksanaIndex: idx,
        etapeIndex: ei >= 0 ? ei : 0,
        pelaksanaId: pelaksanaIdBerkas,
      };
    }
  }

  // 2. Cek kesesuaian nama penumpang/kandidat
  if (namaKandidat && namaKandidat.trim().length > 0) {
    const namaNorm = bersihkanGelarNama(namaKandidat);
    const nWords = namaNorm.split(/\s+/).filter((w) => w.length > 2);
    const idx = st.pelaksana.findIndex((p: PelaksanaPayload) => {
      const pNama = bersihkanGelarNama(p.nama);
      if (pNama.includes(namaNorm) || namaNorm.includes(pNama)) return true;
      const pWords = pNama.split(/\s+/).filter((w) => w.length > 2);
      const cocokCount = pWords.filter((pw) => nWords.some((nw) => nw === pw || nw.includes(pw) || pw.includes(nw))).length;
      return cocokCount >= 2;
    });
    if (idx >= 0) {
      const p = st.pelaksana[idx]!;
      const ei = p.etape.findIndex((e) => e.berangkat <= tanggalBerkas && e.pulang >= tanggalBerkas);
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
    const ei = p.etape.findIndex((e) => e.berangkat <= tanggalBerkas && e.pulang >= tanggalBerkas);
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

/**
 * Memetakan daftar berkas tiket dan bukti transport ke usulan biaya Surat Tugas.
 */
export function petakanTransportKeUsulan(
  daftarBerkas: BerkasDto[],
  st: SuratTugasDto | SuratTugasPayload,
  _sbm?: Sbm,
): UsulanTransportItem[] {
  const usulan: UsulanTransportItem[] = [];

  const berkasRelevan = daftarBerkas.filter(
    (b) =>
      (b.jenis === "tiket" || b.jenis === "transport") &&
      b.ekstraksi?.status === "selesai" &&
      b.ekstraksi.hasil,
  );

  for (const b of berkasRelevan) {
    if (b.jenis === "tiket") {
      const parse = HasilEkstraksiTiketSchema.safeParse(b.ekstraksi?.hasil);
      if (!parse.success) continue;
      const t = parse.data;

      const { pelaksanaIndex, etapeIndex, pelaksanaId } = cocokkanPelaksana(
        st,
        t.penumpang,
        b.pelaksanaId,
        t.tanggal,
      );

      const pelaksana = st.pelaksana[pelaksanaIndex];
      if (!pelaksana) continue;
      const etape = pelaksana.etape[etapeIndex];
      const peringatan: string[] = [];

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
      const isKeretaOrBus = /kai|kereta|bus|travel/i.test(t.maskapai);

      if (isKeretaOrBus) {
        jenisBiaya = "KERETA_BUS_LAIN";
      } else {
        const tujuanKeKedudukan = /jakarta|cgk|hlp|soekarno/i.test(t.tujuan);
        const asalDariKedudukan = /jakarta|cgk|hlp|soekarno/i.test(t.asal);

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
            jenisBiaya = bedaPulang < bedaPergi ? "TIKET_KEMBALI" : "TIKET_PERGI";
          }
        }
      }

      const jenisModa =
        t.maskapai?.toLowerCase().includes("kereta") || t.maskapai?.toLowerCase().includes("kai")
          ? "Kereta Api"
          : "Pesawat";
      const uraianBiaya = `Tiket ${jenisModa} ${t.asal} - ${t.tujuan}${t.nomorPenerbangan ? ` (${t.nomorPenerbangan})` : ""}`;
      const keterangan = `Tgl: ${t.tanggal}, No. Tiket: ${t.nomorTiket ?? t.kodeBooking ?? "-"}`;

      usulan.push({
        berkasId: b.id,
        namaBerkas: b.namaAsli,
        kategoriBerkas: "tiket",
        ekstraksi: t,
        usulanStatus: b.ekstraksi?.usulanStatus ?? "menunggu",
        pelaksanaId,
        pelaksanaIndex,
        etapeIndex,
        pelaksanaNama: pelaksana.nama,
        jenisBiaya,
        uraianBiaya,
        tarifRiil: t.tarif,
        qty: 1,
        satuan: "orang",
        provinsi: etape?.provinsi ?? null,
        keterangan,
        peringatan,
      });
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
      const peringatan: string[] = [];

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

      const uraianBiaya = tr.uraian || `Transportasi ${tr.penyedia ?? ""}`.trim();
      const keterangan = tr.nomorKuitansi ? `No: ${tr.nomorKuitansi}, Tgl: ${tr.tanggal}` : `Tgl: ${tr.tanggal}`;

      usulan.push({
        berkasId: b.id,
        namaBerkas: b.namaAsli,
        kategoriBerkas: "transport",
        ekstraksi: tr,
        usulanStatus: b.ekstraksi?.usulanStatus ?? "menunggu",
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
