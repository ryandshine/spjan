import { HasilEkstraksiTiketSchema, type HasilEkstraksiTiket } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_TIKET = skemaJson(HasilEkstraksiTiketSchema);

const PROMPT_TIKET = `Anda adalah asisten administrasi keuangan perjalanan dinas pemerintah Indonesia.
Periksa dokumen tiket penerbangan, e-ticket, boarding pass, tiket kereta api, tiket kapal laut/feri, atau tiket bus berikut, lalu ekstrak informasinya secara tepat ke dalam JSON sesuai skema:
- moda: jenis angkutan menurut isi dokumen: "pesawat", "kereta", "kapal" (kapal laut, feri, PELNI, ASDP), "bus", atau "lainnya" bila tidak jelas
- maskapai: nama maskapai penerbangan atau operator (mis. "Garuda Indonesia", "Batik Air", "Lion Air", "Citilink", "PT Kereta Api Indonesia (KAI)", "PT PELNI", "ASDP Indonesia Ferry")
- kodeBooking: kode booking / PNR (mis. "XYZ123" atau null bila tidak ada)
- nomorTiket: nomor e-ticket (mis. "126-2134567890" atau null bila tidak ada)
- penumpang: nama penumpang pertama tertera di tiket (atau null bila tidak ada)
- daftarPenumpang: daftar SEMUA nama penumpang di tiket, satu elemen per orang, urut sesuai tiket (array kosong bila tidak ada). Satu tiket/booking bisa memuat lebih dari satu penumpang
- asal: bandara, stasiun, pelabuhan, atau kota keberangkatan (mis. "Jakarta (CGK)", "Gambir", "Tanjung Priok")
- tujuan: bandara, stasiun, pelabuhan, atau kota kedatangan (mis. "Yogyakarta (YIA)", "Yogyakarta Tugu", "Makassar")
- tanggal: tanggal keberangkatan format YYYY-MM-DD
- jam: jam keberangkatan (mis. "08:30" atau null bila tidak ada)
- nomorPenerbangan: nomor penerbangan / nomor KA (mis. "GA 204", "ID 6371", "KA Argo Bromo", "KM Kelud" atau null bila tidak ada)
- tarif: angka rupiah bulat tanpa titik/koma/"IDR". Ambil angka yang benar-benar dibayarkan: "Total Pembayaran" / "Total Amount" / "Grand Total" (sudah termasuk pajak, biaya layanan, dan dikurangi diskon). Abaikan harga dasar, pajak, atau biaya lain yang terpisah.
- basisTarif: arti angka tarif tadi.
  * "total" bila angka itu adalah pembayaran untuk SELURUH penumpang di tiket/booking (mis. "Tiket untuk 2 penumpang ... Total Pembayaran", atau satu total di bawah beberapa nama). Ini kasus yang paling umum untuk booking multi-penumpang.
  * "per_penumpang" bila dokumen jelas menyebut harga tiap penumpang secara terpisah (mis. rincian harga per nama, "per pax", "per orang", atau tiap penumpang punya e-ticket/tarif sendiri dan Anda mengambil tarif satu orang).
  * "tidak_jelas" bila ada lebih dari satu penumpang tetapi tidak bisa dipastikan.
  Satu penumpang: gunakan "total".

Panduan membaca: format tiket berbeda-beda antar maskapai, agen perjalanan (OTA), dan kereta api, serta bisa berbahasa Indonesia atau Inggris. Hitung jumlah penumpang dari tabel "Detail Penumpang"/"Passenger" dan dari kalimat seperti "Tiket untuk N penumpang"; jumlah elemen daftarPenumpang harus sama. Bila dokumen memuat pergi dan pulang, kolom asal/tujuan/tanggal/jam/nomorPenerbangan/arah diisi dari perjalanan pertama, tarif tetap total yang dibayarkan untuk seluruh perjalanan (jangan dijumlahkan dua kali), dan semua arah dicatat di segmen. Buang sapaan (MR/MRS/MS) hanya bila bukan bagian nama; jika ragu, salin nama persis seperti tertulis. Jangan menebak: bila suatu nilai tidak tertera, isi null.
- arah: "pergi" (menuju kota kegiatan), "kembali" (pulang ke kota asal), atau "lainnya"
- segmen: SELALU diisi, satu elemen per arah perjalanan, urut waktu, dari seluruh halaman dokumen (tiket sekali jalan = satu elemen). Tiap elemen berisi asal, tujuan, tanggal, jam, nomorPenerbangan, arah, dan tarif (harga arah itu bila tertera terpisah, selain itu null). Penerbangan lanjutan/transit dalam satu arah digabung menjadi satu elemen: asal bandara awal, tujuan bandara akhir.

Balas HANYA JSON yang valid sesuai skema.`;

export async function ekstrakTiket(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiTiket }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;

  if (!model) {
    const jenisModel = pakaiGambar ? "gambar" : "teks";
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${jenisModel} belum diatur di Pengaturan > Model AI.`);
  }

  if (!pakaiGambar && (!isi.teks || isi.teks.trim().length === 0)) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Dokumen tiket tidak memuat teks atau gambar yang dapat dibaca.");
  }

  // Semua halaman yang terbaca: tiket pulang bisa berada di halaman berikutnya.
  const gambar = pakaiGambar ? isi.gambar : undefined;
  const promptDasar = pakaiGambar ? PROMPT_TIKET : `${PROMPT_TIKET}\n\nIsi Dokumen Tiket:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      gambar,
      skema: SKEMA_EKSTRAKSI_TIKET,
      maksToken: 4096,
    });
    try {
      const parsed = HasilEkstraksiTiketSchema.parse(uraikanJsonAi(balasan));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data tiket yang valid.");
}
