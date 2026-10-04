import { HasilKlasifikasiSchema, type HasilKlasifikasi } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_KLASIFIKASI = skemaJson(HasilKlasifikasiSchema);

const PROMPT = `Anda membaca satu dokumen pendukung perjalanan dinas pemerintah Indonesia (bahasa Indonesia atau Inggris).
Tentukan jenis dokumen:
- st: surat tugas
- hotel: invoice atau folio hotel (penginapan)
- tiket: tiket atau boarding pass pesawat, kereta, atau bus
- transport: bukti taksi, ojek online, bensin, tol, parkir, sewa kendaraan, atau transport darat lainnya
- lainnya: selain di atas
Balas HANYA JSON {"jenis": ..., "ringkasan": ...}. "ringkasan" satu kalimat singkat tentang isi dokumen (maksimal 200 karakter).`;

export async function klasifikasiBerkas(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilKlasifikasi }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;
  if (!model) {
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${pakaiGambar ? "gambar" : "teks"} belum diatur di Pengaturan > Model AI.`);
  }
  const dasar = isi.teks ? `${PROMPT}\n\nIsi dokumen:\n${isi.teks}` : PROMPT;
  let prompt = dasar;
  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      skema: SKEMA_KLASIFIKASI,
      ...(pakaiGambar ? { gambar: isi.gambar } : {}),
    });
    try {
      return { model, hasil: HasilKlasifikasiSchema.parse(JSON.parse(balasan)) };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${dasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan hasil yang valid.");
}
