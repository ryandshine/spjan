import { z } from "zod";

import type { BerkasDto, StatusUsulan } from "./berkas.js";
import type { EtapePayload, PelaksanaPayload, SuratTugasDto, SuratTugasPayload } from "./schemas.js";
import { bersihkanGelarNama } from "./st-ekstraksi.js";
import { norm, parseTanggal, selisihHari } from "./teks.js";
import type { Sbm } from "./types.js";

export const HasilEkstraksiHotelSchema = z.object({
  namaHotel: z.string().trim().min(1).max(200),
  nomorInvoice: z.string().trim().max(100).nullable(),
  tamu: z.string().trim().max(200).nullable(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  jumlahMalam: z.number().int().min(1).max(90),
  tarifPerMalam: z.number().int().nonnegative().nullable(),
  totalBiaya: z.number().int().nonnegative(),
});
export type HasilEkstraksiHotel = z.infer<typeof HasilEkstraksiHotelSchema>;

export type StatusPlafonHotel = "sesuai" | "melebihi" | "tanpa_plafon";

export interface UsulanHotelItem {
  berkasId: number;
  namaBerkas: string;
  ekstraksi: HasilEkstraksiHotel;
  usulanStatus: StatusUsulan;
  pelaksanaId: number | null;
  pelaksanaIndex: number;
  etapeIndex: number;
  pelaksanaNama: string;
  kota: string;
  provinsi: string;
  malam: number;
  tarifRiilPerMalam: number;
  totalRiil: number;
  plafonSbmPerMalam: number | null;
  statusPlafon: StatusPlafonHotel;
  selisihPlafon: number;
  peringatan: string[];
}

/**
 * Mencari tarif plafon hotel SBM per malam berdasarkan provinsi dan status pelaksana.
 */
export function cariPlafonHotelSbm(provinsi: string, status: string | null | undefined, sbm: Sbm): number | null {
  if (!status) return null;
  const cfg = (sbm.statusKonfigurasi as Record<string, { kolomHotel: 1 | 2 | 3 | 4 } | undefined>)[status];
  if (!cfg) return null;
  const tarifProv = sbm.penginapan[norm(provinsi)];
  if (!tarifProv) return null;
  return tarifProv[cfg.kolomHotel - 1] ?? null;
}

/**
 * Memetakan daftar berkas hotel yang telah diekstrak ke pelaksana dan etape pada Surat Tugas.
 */
export function petakanHotelKeUsulan(
  daftarBerkas: BerkasDto[],
  st: SuratTugasDto | SuratTugasPayload,
  sbm: Sbm,
): UsulanHotelItem[] {
  const usulan: UsulanHotelItem[] = [];

  const berkasHotel = daftarBerkas.filter(
    (b) => b.jenis === "hotel" && b.ekstraksi?.status === "selesai" && b.ekstraksi.hasil,
  );

  for (const b of berkasHotel) {
    const parse = HasilEkstraksiHotelSchema.safeParse(b.ekstraksi?.hasil);
    if (!parse.success) continue;
    const h = parse.data;

    const peringatan: string[] = [];
    const malam = h.jumlahMalam > 0 ? h.jumlahMalam : Math.max(hitungMalam(h.checkIn, h.checkOut), 1);
    const tarifRiilPerMalam =
      h.tarifPerMalam && h.tarifPerMalam > 0
        ? h.tarifPerMalam
        : malam > 0
          ? Math.round(h.totalBiaya / malam)
          : h.totalBiaya;

    // 1. Tentukan pelaksana yang cocok
    let pelaksanaIndex = 0;
    let etapeIndex = 0;

    // Cek apakah berkas sudah terikat ke pelaksanaId
    let matchPelaksana = false;
    if ("pelaksanaId" in b && b.pelaksanaId != null && "id" in (st.pelaksana[0] ?? {})) {
      const idx = st.pelaksana.findIndex((p: PelaksanaPayload) => (p as { id?: number }).id === b.pelaksanaId);
      if (idx >= 0) {
        pelaksanaIndex = idx;
        matchPelaksana = true;
      }
    }

    // Jika belum cocok, cari berdasarkan kemiripan nama tamu
    if (!matchPelaksana && h.tamu && h.tamu.trim().length > 0) {
      const namaTamuNorm = bersihkanGelarNama(h.tamu);
      const idx = st.pelaksana.findIndex((p: PelaksanaPayload) => {
        const pNama = bersihkanGelarNama(p.nama);
        return pNama.includes(namaTamuNorm) || namaTamuNorm.includes(pNama);
      });
      if (idx >= 0) {
        pelaksanaIndex = idx;
        matchPelaksana = true;
      }
    }

    // Jika masih belum cocok, cari pelaksana yang memiliki etape di rentang tanggal inap
    if (!matchPelaksana) {
      for (let pi = 0; pi < st.pelaksana.length; pi += 1) {
        const p = st.pelaksana[pi]!;
        const ei = p.etape.findIndex((e: EtapePayload) => e.berangkat <= h.checkIn && e.pulang >= h.checkOut);
        if (ei >= 0) {
          pelaksanaIndex = pi;
          etapeIndex = ei;
          matchPelaksana = true;
          break;
        }
      }
    }

    const pelaksana = st.pelaksana[pelaksanaIndex];
    if (!pelaksana) continue;

    // 2. Tentukan etape pada pelaksana tersebut
    if (pelaksana.etape.length > 0) {
      // Cari etape yang tanggalnya mencakup tanggal inap
      const ei = pelaksana.etape.findIndex((e: EtapePayload) => e.berangkat <= h.checkIn && e.pulang >= h.checkOut);
      if (ei >= 0) {
        etapeIndex = ei;
      } else {
        // Fallback: cari etape terdekat atau etape pertama
        etapeIndex = 0;
        peringatan.push(
          `Tanggal menginap (${h.checkIn} s.d. ${h.checkOut}) berada di luar rentang tanggal etape pelaksana.`,
        );
      }
    }

    const etape = pelaksana.etape[etapeIndex];
    const kota = etape?.kota ?? "-";
    const provinsi = etape?.provinsi ?? "-";

    // 3. Bandingkan dengan plafon SBM
    const plafonSbmPerMalam = cariPlafonHotelSbm(provinsi, pelaksana.status, sbm);
    let statusPlafon: StatusPlafonHotel = "tanpa_plafon";
    let selisihPlafon = 0;

    if (plafonSbmPerMalam !== null) {
      if (tarifRiilPerMalam <= plafonSbmPerMalam) {
        statusPlafon = "sesuai";
      } else {
        statusPlafon = "melebihi";
        selisihPlafon = (tarifRiilPerMalam - plafonSbmPerMalam) * malam;
        peringatan.push(
          `Tarif hotel riil (Rp${tarifRiilPerMalam.toLocaleString("id-ID")}) melebihi plafon SBM (Rp${plafonSbmPerMalam.toLocaleString("id-ID")}) sebesar Rp${(tarifRiilPerMalam - plafonSbmPerMalam).toLocaleString("id-ID")}/malam.`,
        );
      }
    } else {
      peringatan.push(`Plafon SBM hotel untuk ${provinsi} belum diatur untuk status jabatan pelaksana.`);
    }

    const pelId = "id" in pelaksana ? ((pelaksana as { id?: number }).id ?? null) : null;

    usulan.push({
      berkasId: b.id,
      namaBerkas: b.namaAsli,
      ekstraksi: h,
      usulanStatus: b.ekstraksi?.usulanStatus ?? "menunggu",
      pelaksanaId: pelId,
      pelaksanaIndex,
      etapeIndex,
      pelaksanaNama: pelaksana.nama,
      kota,
      provinsi,
      malam,
      tarifRiilPerMalam,
      totalRiil: h.totalBiaya,
      plafonSbmPerMalam,
      statusPlafon,
      selisihPlafon,
      peringatan,
    });
  }

  return usulan;
}

function hitungMalam(checkIn: string, checkOut: string): number {
  const a = parseTanggal(checkIn);
  const b = parseTanggal(checkOut);
  if (!a || !b) return 1;
  const s = selisihHari(a, b);
  return s > 0 ? s : 1;
}
