import { HasilEkstraksiStSchema, type HasilEkstraksiSt } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_ST = skemaJson(HasilEkstraksiStSchema);

const PROMPT_ST = `Anda adalah asisten ahli administrasi perjalanan dinas pemerintah Indonesia.
Baca dokumen Surat Tugas (ST) berikut dan ekstrak informasinya secara tepat ke dalam format JSON sesuai skema:
- nomor: nomor surat tugas resmi (mis. "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026")
- tanggal: tanggal surat tugas ditetapkan dalam format YYYY-MM-DD
- kegiatan: maksud penugasan perjalanan dinas
- pelaksana: daftar orang/personil yang ditugaskan, masing-masing memuat:
  - nama: nama lengkap beserta gelar akademik/kedinasan
  - nip: nomor NIP (18 digit angka) jika ada, atau null bila bukan PNS/tanpa NIP
  - jabatan: jabatan kedinasan (mis. "Kasubdit Pemantauan", "Surveyor Pemetaan", dll.) atau null
  - etape: daftar perjalanan orang tersebut, masing-masing dengan tujuan (kota/kabupaten/provinsi), tanggalBerangkat (YYYY-MM-DD), tanggalKembali (YYYY-MM-DD)

Balas HANYA JSON yang valid sesuai skema.`;

export async function ekstrakSt(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiSt }> {
  const model = konf.modelTeks;
  if (!model) {
    throw new AiGalat("MODEL_BELUM_DIATUR", "Model teks belum diatur di Pengaturan > Model AI.");
  }
  if (!isi.teks || isi.teks.trim().length === 0) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Dokumen Surat Tugas tidak memuat teks yang dapat dibaca.");
  }

  const promptDasar = `${PROMPT_ST}\n\nIsi Dokumen Surat Tugas:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      skema: SKEMA_EKSTRAKSI_ST,
    });
    try {
      const parsed = HasilEkstraksiStSchema.parse(uraikanJsonAi(balasan));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data Surat Tugas yang valid.");
}
