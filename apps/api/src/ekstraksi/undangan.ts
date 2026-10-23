import { HasilEkstraksiUndanganSchema, type HasilEkstraksiUndangan } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_UNDANGAN = skemaJson(HasilEkstraksiUndanganSchema);

const PROMPT_UNDANGAN = `Anda adalah asisten administrasi perjalanan dinas pemerintah Indonesia.
Baca surat undangan (rapat, bimbingan teknis, sosialisasi, lokakarya, kunjungan, dll.) berikut dan ekstrak informasinya ke dalam JSON sesuai skema:
- maksudTugas: maksud/nama kegiatan yang diundangkan, ditulis ringkas sebagai frasa penugasan (mis. "Menghadiri Rapat Koordinasi Percepatan Perhutanan Sosial"). Jangan menyalin seluruh paragraf.
- lokasiTugas: tempat pelaksanaan kegiatan (nama gedung/hotel bila ada, kota/kabupaten, provinsi), mis. "Hotel Grand Preanger, Kota Bandung, Jawa Barat"
- tanggalMulai: tanggal pertama kegiatan, format YYYY-MM-DD
- tanggalSelesai: tanggal terakhir kegiatan, format YYYY-MM-DD (sama dengan tanggalMulai bila satu hari)
- nomorUndangan: nomor surat undangan persis seperti tertulis
- tanggalUndangan: tanggal surat undangan dibuat, format YYYY-MM-DD
- penyelenggara: instansi pengirim/penyelenggara (mis. "Dinas Kehutanan Provinsi Jawa Barat")

Panduan: tanggal bisa tertulis "Senin, 2 November 2026" atau "2 - 4 November 2026"; ubah ke YYYY-MM-DD. Jangan menebak: bila suatu nilai tidak tertera jelas, isi null. Jangan mengarang nomor atau tanggal.

Balas HANYA JSON yang valid sesuai skema.`;

export async function ekstrakUndangan(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiUndangan }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;
  if (!model) {
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${pakaiGambar ? "gambar" : "teks"} belum diatur di Pengaturan > Model AI.`);
  }
  if (!pakaiGambar && isi.teks.trim().length === 0) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Surat undangan tidak memuat teks atau gambar yang dapat dibaca.");
  }

  const gambar = pakaiGambar ? [isi.gambar[0]!] : undefined;
  const promptDasar = pakaiGambar ? PROMPT_UNDANGAN : `${PROMPT_UNDANGAN}\n\nIsi Surat Undangan:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({ baseUrl: konf.llmUrl, model, prompt, gambar, skema: SKEMA_EKSTRAKSI_UNDANGAN, maksToken: 4096 });
    try {
      return { model, hasil: HasilEkstraksiUndanganSchema.parse(uraikanJsonAi(balasan)) };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data undangan yang valid.");
}
