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

Balas HANYA JSON yang valid sesuai skema.`;

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

  const gambar = pakaiGambar ? [isi.gambar[0]!] : undefined;
  const promptDasar = pakaiGambar ? PROMPT_HOTEL : `${PROMPT_HOTEL}\n\nIsi Dokumen Hotel:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      gambar,
      skema: SKEMA_EKSTRAKSI_HOTEL,
    });
    try {
      const parsed = HasilEkstraksiHotelSchema.parse(uraikanJsonAi(balasan));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data invoice hotel yang valid.");
}
