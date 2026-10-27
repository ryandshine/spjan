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

PENTING:
- Setiap pelaksana WAJIB memiliki minimal 1 etape.
- Jika tanggal atau tujuan pelaksana di baris tabel tidak tertulis secara spesifik (misalnya karena penggabungan baris tabel atau mengikuti baris sebelumnya), warisi tanggal dan tujuan dari baris di atasnya atau gunakan rentang tanggal dan lokasi utama pada diktum Surat Tugas (bagian Untuk). Jangan pernah mengosongkan etape ([]).

Balas HANYA JSON yang valid sesuai skema.`;

export async function ekstrakSt(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiSt }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;
  if (!model) {
    const jenisModel = pakaiGambar ? "gambar" : "teks";
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${jenisModel} belum diatur di Pengaturan > Model AI.`);
  }
  if (!pakaiGambar && (!isi.teks || isi.teks.trim().length === 0)) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Dokumen Surat Tugas tidak memuat teks atau gambar yang dapat dibaca.");
  }

  const promptDasar = pakaiGambar ? PROMPT_ST : `${PROMPT_ST}\n\nIsi Dokumen Surat Tugas:\n${isi.teks}`;
  const gambar = pakaiGambar ? isi.gambar.slice(0, 3) : undefined;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      gambar,
      skema: SKEMA_EKSTRAKSI_ST,
      maksToken: 8192,
    });
    try {
      const raw = uraikanJsonAi(balasan);
      // Normalisasi etape pelaksana: jika etape kosong karena tabel gabungan baris, warisi dari baris sebelumnya atau ST
      if (raw && typeof raw === "object" && Array.isArray((raw as any).pelaksana)) {
        const rawPelaksana = (raw as any).pelaksana;
        const acuanEtape = rawPelaksana.find((p: any) => Array.isArray(p?.etape) && p.etape.length > 0)?.etape;
        const tanggalDefault = typeof (raw as any).tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test((raw as any).tanggal)
          ? (raw as any).tanggal
          : "2026-01-01";
        const lokasiDefault = typeof (raw as any).kegiatan === "string" && (raw as any).kegiatan.trim().length > 0
          ? (raw as any).kegiatan.trim().slice(0, 100)
          : "Tujuan Penugasan";

        let etapeSebelumnya = acuanEtape || [
          {
            tujuan: lokasiDefault,
            tanggalBerangkat: tanggalDefault,
            tanggalKembali: tanggalDefault,
          },
        ];

        for (const p of rawPelaksana) {
          if (!Array.isArray(p.etape) || p.etape.length === 0) {
            p.etape = etapeSebelumnya;
          } else {
            etapeSebelumnya = p.etape;
          }
        }
      }
      const parsed = HasilEkstraksiStSchema.parse(raw);
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data Surat Tugas yang valid.");
}
