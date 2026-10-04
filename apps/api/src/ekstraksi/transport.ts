import { HasilEkstraksiTransportSchema, type HasilEkstraksiTransport } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_TRANSPORT = skemaJson(HasilEkstraksiTransportSchema);

const PROMPT_TRANSPORT = `Anda adalah asisten administrasi keuangan perjalanan dinas pemerintah Indonesia.
Periksa dokumen kuitansi, tanda terima, bukti transaksi, atau struk transportasi berikut (taksi, transport darat, sewa kendaraan, bensin, tol, dsb), lalu ekstrak informasinya secara tepat ke dalam JSON sesuai skema:
- kategori: "taksi" (taksi konvensional/online misal Bluebird, Grab, Gojek), "darat" (angkutan darat antar kota, bus, travel), "sewa_kendaraan" (rental mobil/kendaraan), atau "lainnya" (tol, parkir, bensin)
- penyedia: nama penyedia layanan / armada / rekanan (mis. "Blue Bird", "Grab Indonesia", "PT Damri", "Rental Maju Jaya", atau null bila tidak ada)
- nomorKuitansi: nomor kuitansi, struk, order ID, atau nomor transaksi (atau null bila tidak ada)
- tanggal: tanggal perjalanan / transaksi format YYYY-MM-DD
- uraian: keterangan perjalanan atau belanja (mis. "Taksi Bandara ke Hotel", "Sewa Mobil Hari ke-1", "Tol Cikampek")
- totalBiaya: nominal total yang dibayar dalam rupiah tanpa titik/koma (angka bulat)

Balas HANYA JSON yang valid sesuai skema.`;

export async function ekstrakTransport(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiTransport }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;

  if (!model) {
    const jenisModel = pakaiGambar ? "gambar" : "teks";
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${jenisModel} belum diatur di Pengaturan > Model AI.`);
  }

  if (!pakaiGambar && (!isi.teks || isi.teks.trim().length === 0)) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Dokumen transportasi tidak memuat teks atau gambar yang dapat dibaca.");
  }

  const gambar = pakaiGambar ? [isi.gambar[0]!] : undefined;
  const promptDasar = pakaiGambar ? PROMPT_TRANSPORT : `${PROMPT_TRANSPORT}\n\nIsi Dokumen Transportasi:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      gambar,
      skema: SKEMA_EKSTRAKSI_TRANSPORT,
    });
    try {
      const parsed = HasilEkstraksiTransportSchema.parse(uraikanJsonAi(balasan));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data transportasi yang valid.");
}
