import { HasilEkstraksiHotelSchema, type HasilEkstraksiHotel } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_HOTEL = skemaJson(HasilEkstraksiHotelSchema);

const PROMPT_HOTEL = `Anda adalah asisten administrasi keuangan perjalanan dinas pemerintah Indonesia.
Periksa dokumen atau foto invoice, bill, folio, atau kuitansi hotel berikut, lalu ekstrak informasinya secara tepat ke dalam JSON sesuai skema:
- namaHotel: nama hotel/penginapan lengkap (mis. "The Royal Alana Yogyakarta", "Hotel Santika Premiere")
- nomorInvoice: nomor invoice, folio, bill, atau tanda terima pembayaran hotel (atau null bila tidak tertera)
- tamu: nama tamu/penghuni kamar hotel (atau null bila tidak tertera)
- checkIn: tanggal check-in format YYYY-MM-DD
- checkOut: tanggal check-out format YYYY-MM-DD
- jumlahMalam: jumlah malam menginap (angka bulat >= 1)
- tarifPerMalam: tarif sewa kamar per malam dalam rupiah tanpa titik/koma (angka bulat, atau null bila paket/tidak tertera per malam)
- totalBiaya: total biaya penginapan yang dibayar dalam rupiah tanpa titik/koma (angka bulat)

PENTING:
- Balas HANYA SATU JSON object {...}, BUKAN array [ ... ].

Balas HANYA JSON yang valid sesuai skema.`;

export function normalisasiHasilHotel(raw: unknown): unknown {
  if (!raw) return raw;

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, any>;
    if (Array.isArray(obj.hotel)) return normalisasiHasilHotel(obj.hotel);
    if (Array.isArray(obj.data)) return normalisasiHasilHotel(obj.data);
    if (Array.isArray(obj.items)) return normalisasiHasilHotel(obj.items);
    if (obj.hasil && typeof obj.hasil === "object") return normalisasiHasilHotel(obj.hasil);

    if (typeof obj.totalBiaya === "string") {
      const num = parseInt(obj.totalBiaya.replace(/[^\d]/g, ""), 10);
      obj.totalBiaya = isNaN(num) ? 0 : num;
    }
    if (typeof obj.tarifPerMalam === "string") {
      const num = parseInt(obj.tarifPerMalam.replace(/[^\d]/g, ""), 10);
      obj.tarifPerMalam = isNaN(num) ? null : num;
    }
    if (typeof obj.jumlahMalam === "string") {
      const num = parseInt(obj.jumlahMalam.replace(/[^\d]/g, ""), 10);
      obj.jumlahMalam = isNaN(num) || num < 1 ? 1 : num;
    }
    return obj;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) return raw;
    return normalisasiHasilHotel(raw[0]);
  }

  return raw;
}

export async function ekstrakHotel(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiHotel }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;

  if (!model) {
    const jenisModel = pakaiGambar ? "gambar" : "teks";
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${jenisModel} belum diatur di Pengaturan > Model AI.`);
  }

  if (!pakaiGambar && (!isi.teks || isi.teks.trim().length === 0)) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Dokumen hotel tidak memuat teks atau gambar yang dapat dibaca.");
  }

  const gambar = pakaiGambar ? isi.gambar : undefined;
  const promptDasar = pakaiGambar ? PROMPT_HOTEL : `${PROMPT_HOTEL}\n\nIsi Dokumen Hotel:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      gambar,
      skema: SKEMA_EKSTRAKSI_HOTEL,
      maksToken: 4096,
    });
    try {
      const raw = uraikanJsonAi(balasan);
      const parsed = HasilEkstraksiHotelSchema.parse(normalisasiHasilHotel(raw));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data invoice hotel yang valid.");
}
