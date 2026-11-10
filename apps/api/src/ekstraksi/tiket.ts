import { gabungPerluDicek, HasilEkstraksiTiketSchema, type HasilEkstraksiTiket } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { PETUNJUK_PERLU_DICEK, skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_TIKET = skemaJson(HasilEkstraksiTiketSchema);

const PROMPT_TIKET = `Anda adalah asisten administrasi keuangan perjalanan dinas pemerintah Indonesia.
Periksa dokumen tiket penerbangan, e-ticket, boarding pass, tiket kereta api, tiket kapal laut/feri, atau tiket bus berikut, lalu ekstrak informasinya secara tepat ke dalam JSON sesuai skema:
- moda: jenis angkutan menurut isi dokumen: "pesawat", "kereta", "kapal" (kapal laut, feri, PELNI, ASDP), "bus", atau "lainnya" bila tidak jelas
- maskapai: nama maskapai penerbangan atau operator (mis. "Garuda Indonesia", "Batik Air", "Lion Air", "Citilink", "PT Kereta Api Indonesia (KAI)", "PT Kereta Cepat Indonesia China (KCIC)", "PT PELNI", "ASDP Indonesia Ferry")
- kodeBooking: kode booking / PNR (mis. "XYZ123" atau null bila tidak ada)
- nomorTiket: nomor e-ticket (mis. "126-2134567890" atau null bila tidak ada)
- penumpang: nama penumpang pertama tertera di tiket (atau null bila tidak ada)
- daftarPenumpang: daftar SEMUA nama penumpang di tiket, satu elemen per orang, urut sesuai tiket (array kosong bila tidak ada). Satu tiket/booking bisa memuat lebih dari satu penumpang
- asal: bandara, stasiun, pelabuhan, atau kota keberangkatan (mis. "Jakarta (CGK)", "Gambir", "Tegalluar Summarecon", "Halim")
- tujuan: bandara, stasiun, pelabuhan, atau kota kedatangan (mis. "Yogyakarta (YIA)", "Halim", "Tegalluar Summarecon")
- tanggal: tanggal keberangkatan format YYYY-MM-DD
- jam: jam keberangkatan (mis. "08:30" atau null bila tidak ada)
- nomorPenerbangan: nomor penerbangan / nomor KA (mis. "GA 204", "ID 6371", "G1006", "KA Argo Bromo", "KM Kelud" atau null bila tidak ada)
- tarif: angka rupiah bulat tanpa titik/koma/"IDR". Ambil angka yang benar-benar dibayarkan untuk tiket angkutan utama: "Total Pembayaran" / "Total Amount" / "Grand Total" (sudah termasuk pajak, biaya layanan, dan dikurangi diskon). Abaikan harga dasar, pajak, atau biaya lain yang terpisah. Abaikan kuitansi/struk taksi/ojek bila tercampur di dokumen tiket.
- basisTarif: arti angka tarif tadi.
  * "total" bila angka itu adalah pembayaran untuk SELURUH penumpang di tiket/booking (mis. "Tiket untuk 2 penumpang ... Total Pembayaran", atau satu total di bawah beberapa nama). Ini kasus yang paling umum untuk booking multi-penumpang.
  * "per_penumpang" bila dokumen jelas menyebut harga tiap penumpang secara terpisah (mis. rincian harga per nama, "per pax", "per orang", atau tiap penumpang punya e-ticket/tarif sendiri dan Anda mengambil tarif satu orang).
  * "tidak_jelas" bila ada lebih dari satu penumpang tetapi tidak bisa dipastikan.
  Satu penumpang: gunakan "total".

Panduan membaca: format tiket berbeda-beda antar maskapai, agen perjalanan (OTA), dan kereta api, serta bisa berbahasa Indonesia atau Inggris. Hitung jumlah penumpang dari tabel "Detail Penumpang"/"Passenger" dan dari kalimat seperti "Tiket untuk N penumpang"; jumlah elemen daftarPenumpang harus sama. Bila dokumen memuat pergi dan pulang, kolom asal/tujuan/tanggal/jam/nomorPenerbangan/arah diisi dari perjalanan pertama, tarif tetap total yang dibayarkan untuk seluruh perjalanan (jangan dijumlahkan dua kali), dan semua arah dicatat di segmen. Buang sapaan (MR/MRS/MS) hanya bila bukan bagian nama; jika ragu, salin nama persis seperti tertulis. Jangan menebak: bila suatu nilai tidak tertera, isi null.
- arah: "pergi" (menuju kota kegiatan), "kembali" (pulang ke kota asal), atau "lainnya"
- segmen: SELALU diisi, satu elemen per arah perjalanan tiket utama (pesawat/kereta/kapal/bus), urut waktu, dari seluruh halaman dokumen (tiket sekali jalan = satu elemen). Tiap elemen berisi asal, tujuan, tanggal, jam, nomorPenerbangan, arah, dan tarif (harga arah itu bila tertera terpisah, selain itu null). Penerbangan lanjutan/transit dalam satu arah digabung menjadi satu elemen: asal bandara awal, tujuan bandara akhir.

PENTING:
- Balas HANYA SATU JSON object {...}, BUKAN array [ ... ]. Jika ada beberapa tiket (mis. tiket pergi dan tiket pulang), gabungkan ke dalam satu objek JSON dengan mengisi array segmen dan jumlahkan total tarifnya.

${PETUNJUK_PERLU_DICEK}

Balas HANYA JSON yang valid sesuai skema.`;

export function normalisasiHasilTiket(raw: unknown): unknown {
  if (!raw) return raw;

  // Unpack wrappers seperti { tiket: [...] } atau { data: [...] }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, any>;
    if (Array.isArray(obj.tiket)) return normalisasiHasilTiket(obj.tiket);
    if (Array.isArray(obj.data)) return normalisasiHasilTiket(obj.data);
    if (Array.isArray(obj.items)) return normalisasiHasilTiket(obj.items);
    if (Array.isArray(obj.segments)) return normalisasiHasilTiket(obj.segments);
    if (obj.hasil && typeof obj.hasil === "object") return normalisasiHasilTiket(obj.hasil);

    // Normalisasi angka tarif bila berupa string
    if (typeof obj.tarif === "string") {
      const num = parseInt(obj.tarif.replace(/[^\d]/g, ""), 10);
      obj.tarif = isNaN(num) ? 0 : num;
    }

    // Jika model menaruh asal/tujuan/tanggal hanya di segmen
    if (Array.isArray(obj.segmen) && obj.segmen.length > 0) {
      const s0 = obj.segmen[0];
      if (!obj.asal && s0?.asal) obj.asal = s0.asal;
      if (!obj.tujuan && s0?.tujuan) obj.tujuan = s0.tujuan;
      if (!obj.tanggal && s0?.tanggal) obj.tanggal = s0.tanggal;
      if (!obj.jam && s0?.jam) obj.jam = s0.jam;
      if (!obj.nomorPenerbangan && s0?.nomorPenerbangan) obj.nomorPenerbangan = s0.nomorPenerbangan;
      if (!obj.arah && s0?.arah) obj.arah = s0.arah;
    }

    // Pastikan daftarPenumpang terisi bila penumpang terisi
    if (typeof obj.penumpang === "string" && obj.penumpang.trim() && (!Array.isArray(obj.daftarPenumpang) || obj.daftarPenumpang.length === 0)) {
      obj.daftarPenumpang = [obj.penumpang.trim()];
    }

    return obj;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) return raw;
    if (raw.length === 1) return normalisasiHasilTiket(raw[0]);

    // Jika model mengembalikan array item tiket (mis. tiket pergi dan tiket kembali terpisah)
    const tiketItems = raw.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const m = (item as any).moda;
      return m === "pesawat" || m === "kereta" || m === "kapal" || m === "bus";
    });

    const itemsToMerge = tiketItems.length > 0 ? tiketItems : raw.filter((item) => item && typeof item === "object");
    if (itemsToMerge.length === 0) return raw[0];

    const pertama = itemsToMerge[0] as Record<string, any>;
    const semuaSegmen: any[] = [];
    let totalTarif = 0;
    const semuaPenumpang = new Set<string>();

    for (const item of itemsToMerge) {
      const it = item as Record<string, any>;
      let itemTarif = typeof it.tarif === "number" ? it.tarif : 0;
      if (typeof it.tarif === "string") {
        const num = parseInt(it.tarif.replace(/[^\d]/g, ""), 10);
        itemTarif = isNaN(num) ? 0 : num;
      }
      totalTarif += itemTarif;

      if (Array.isArray(it.daftarPenumpang)) {
        for (const p of it.daftarPenumpang) {
          if (typeof p === "string" && p.trim()) semuaPenumpang.add(p.trim());
        }
      } else if (typeof it.penumpang === "string" && it.penumpang.trim()) {
        semuaPenumpang.add(it.penumpang.trim());
      }

      if (Array.isArray(it.segmen) && it.segmen.length > 0) {
        for (const s of it.segmen) {
          semuaSegmen.push({
            asal: s.asal ?? it.asal ?? "",
            tujuan: s.tujuan ?? it.tujuan ?? "",
            tanggal: s.tanggal ?? it.tanggal ?? "",
            jam: s.jam ?? it.jam ?? null,
            nomorPenerbangan: s.nomorPenerbangan ?? it.nomorPenerbangan ?? null,
            arah: s.arah ?? it.arah ?? "lainnya",
            tarif: typeof s.tarif === "number" ? s.tarif : (it.segmen.length === 1 ? itemTarif : null),
          });
        }
      } else {
        semuaSegmen.push({
          asal: it.asal ?? "",
          tujuan: it.tujuan ?? "",
          tanggal: it.tanggal ?? "",
          jam: it.jam ?? null,
          nomorPenerbangan: it.nomorPenerbangan ?? null,
          arah: it.arah ?? "lainnya",
          tarif: itemTarif,
        });
      }
    }

    const kodeBookingList = Array.from(
      new Set(
        itemsToMerge
          .map((it: any) => it.kodeBooking)
          .filter((k: any) => typeof k === "string" && k.trim().length > 0)
      )
    );

    const nomorTiketList = Array.from(
      new Set(
        itemsToMerge
          .map((it: any) => it.nomorTiket)
          .filter((k: any) => typeof k === "string" && k.trim().length > 0)
      )
    );

    const pen = pertama.penumpang ?? Array.from(semuaPenumpang)[0] ?? null;
    const daftarPen = Array.from(semuaPenumpang);
    if (pen && daftarPen.length === 0) daftarPen.push(pen);

    return {
      moda: pertama.moda ?? "kereta",
      maskapai: pertama.maskapai ?? "Kereta Api",
      kodeBooking: kodeBookingList.length > 0 ? kodeBookingList.join(" / ").slice(0, 50) : null,
      nomorTiket: nomorTiketList.length > 0 ? nomorTiketList.join(" / ").slice(0, 100) : null,
      penumpang: pen,
      daftarPenumpang: daftarPen,
      asal: pertama.asal ?? semuaSegmen[0]?.asal ?? "",
      tujuan: pertama.tujuan ?? semuaSegmen[0]?.tujuan ?? "",
      tanggal: pertama.tanggal ?? semuaSegmen[0]?.tanggal ?? "",
      jam: pertama.jam ?? semuaSegmen[0]?.jam ?? null,
      nomorPenerbangan: pertama.nomorPenerbangan ?? semuaSegmen[0]?.nomorPenerbangan ?? null,
      tarif: totalTarif,
      basisTarif: pertama.basisTarif ?? "total",
      arah: pertama.arah ?? "pergi",
      segmen: semuaSegmen.slice(0, 6),
      perluDicek: gabungPerluDicek(itemsToMerge),
    };
  }

  return raw;
}

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
      const raw = uraikanJsonAi(balasan);
      const parsed = HasilEkstraksiTiketSchema.parse(normalisasiHasilTiket(raw));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data tiket yang valid.");
}
