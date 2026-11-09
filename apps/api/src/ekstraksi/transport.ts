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

PENTING:
- Balas HANYA SATU JSON object {...}, BUKAN array [ ... ]. Jika dokumen memuat beberapa struk/kuitansi transportasi (misalnya beberapa perjalanan taksi atau sewa mobil beberapa hari), jumlahkan seluruh biaya ke totalBiaya, gabungkan rincian perjalanan ke uraian, dan gunakan tanggal perjalanan pertama.

Balas HANYA JSON yang valid sesuai skema.`;

export function normalisasiHasilTransport(raw: unknown): unknown {
  if (!raw) return raw;

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, any>;
    if (Array.isArray(obj.transport)) return normalisasiHasilTransport(obj.transport);
    if (Array.isArray(obj.data)) return normalisasiHasilTransport(obj.data);
    if (Array.isArray(obj.items)) return normalisasiHasilTransport(obj.items);
    if (obj.hasil && typeof obj.hasil === "object") return normalisasiHasilTransport(obj.hasil);

    if (typeof obj.totalBiaya === "string") {
      const num = parseInt(obj.totalBiaya.replace(/[^\d]/g, ""), 10);
      obj.totalBiaya = isNaN(num) ? 0 : num;
    }
    return obj;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) return raw;
    if (raw.length === 1) return normalisasiHasilTransport(raw[0]);

    const items = raw.filter((it) => it && typeof it === "object") as Record<string, any>[];
    if (items.length === 0) return raw[0];

    const pertama = items[0]!;
    let totalBiaya = 0;
    const uraianList: string[] = [];
    const penyediaList = new Set<string>();
    const noKuitansiList = new Set<string>();

    for (const it of items) {
      let b = typeof it.totalBiaya === "number" ? it.totalBiaya : 0;
      if (typeof it.totalBiaya === "string") {
        const num = parseInt(it.totalBiaya.replace(/[^\d]/g, ""), 10);
        b = isNaN(num) ? 0 : num;
      }
      totalBiaya += b;

      if (typeof it.uraian === "string" && it.uraian.trim()) {
        uraianList.push(it.uraian.trim());
      }
      if (typeof it.penyedia === "string" && it.penyedia.trim()) {
        penyediaList.add(it.penyedia.trim());
      }
      if (typeof it.nomorKuitansi === "string" && it.nomorKuitansi.trim()) {
        noKuitansiList.add(it.nomorKuitansi.trim());
      }
    }

    const uraianGabung = uraianList.length > 0 ? uraianList.join(", ").slice(0, 250) : null;
    const penyediaGabung = Array.from(penyediaList).join(" / ").slice(0, 100) || pertama.penyedia || null;
    const noKuitansiGabung = Array.from(noKuitansiList).join(" / ").slice(0, 100) || pertama.nomorKuitansi || null;

    return {
      kategori: pertama.kategori ?? "taksi",
      penyedia: penyediaGabung,
      nomorKuitansi: noKuitansiGabung,
      tanggal: pertama.tanggal ?? new Date().toISOString().slice(0, 10),
      uraian: uraianGabung ?? pertama.uraian ?? null,
      totalBiaya,
    };
  }

  return raw;
}

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

  const gambar = pakaiGambar ? isi.gambar : undefined;
  const promptDasar = pakaiGambar ? PROMPT_TRANSPORT : `${PROMPT_TRANSPORT}\n\nIsi Dokumen Transportasi:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({
      baseUrl: konf.llmUrl,
      model,
      prompt,
      gambar,
      skema: SKEMA_EKSTRAKSI_TRANSPORT,
      maksToken: 4096,
    });
    try {
      const raw = uraikanJsonAi(balasan);
      const parsed = HasilEkstraksiTransportSchema.parse(normalisasiHasilTransport(raw));
      return { model, hasil: parsed };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data transportasi yang valid.");
}
