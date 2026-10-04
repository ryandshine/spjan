// Uji manual: ekstrak detail invoice hotel dari berkas foto/PDF asli menggunakan model AI vision/teks.
// Pemakaian: npx tsx scripts/probe-hotel.ts "/path/invoice.jpg" [--model gemma4:cloud] [--url http://127.0.0.1:11434]
import { readFile } from "node:fs/promises";

import {
  SBM_2026,
  cariPlafonHotelSbm,
  petakanHotelKeUsulan,
  type BerkasDto,
  type SuratTugasPayload,
} from "@spjan/shared";

import { klienOllama } from "../src/ai/ollama.js";
import { deteksiMime } from "../src/berkas/deteksi.js";
import { bacaIsi } from "../src/ekstraksi/baca-berkas.js";
import { ekstrakHotel } from "../src/ekstraksi/hotel.js";

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const berkas = process.argv[2];
const modelGambar = argumen("model-gambar") ?? argumen("model") ?? "gemma4:cloud";
const modelTeks = argumen("model-teks") ?? "gpt-oss:120b-cloud";
const url = argumen("url") ?? "http://127.0.0.1:11434";

if (!berkas) {
  console.error("Pemakaian: tsx scripts/probe-hotel.ts <berkas> [--model <nama-vision>] [--url <ollama>]");
  process.exit(2);
}

const data = await readFile(berkas);
const mime = deteksiMime(data);
if (!mime) {
  console.error("Jenis berkas tidak didukung (bukan PDF/JPG/PNG/WEBP).");
  process.exit(2);
}

const isi = await bacaIsi(mime, data);
console.log(`[probe-hotel] ${berkas} mime=${mime} teks=${isi.teks.length} karakter gambar=${isi.gambar.length}`);

const mulai = Date.now();
try {
  const hasil = await ekstrakHotel(
    klienOllama,
    { llmUrl: url, modelTeks, modelGambar },
    isi
  );
  console.log(`[probe-hotel] model=${isi.gambar.length > 0 ? modelGambar : modelTeks} durasi=${((Date.now() - mulai) / 1000).toFixed(1)}s`);
  console.log("\n--- HASIL EKSTRAKSI HOTEL ---");
  console.log(JSON.stringify(hasil, null, 2));

  // Simulasikan pemetaan ke usulan hotel dengan dummy ST
  const dummySt: SuratTugasPayload = {
    nomor: "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026",
    tanggal: "2026-09-08",
    tanggalSpj: null,
    kodeAkun: "524111",
    catatan: "",
    pelaksana: [
      {
        nama: hasil.tamu ?? "Gunadi Firdaus",
        nip: "197803101997031001",
        jabatan: "Kasubdit",
        status: "ESELON_II",
        noSpd: null,
        etape: [
          {
            provinsi: "D.I. YOGYAKARTA",
            kota: "Yogyakarta",
            kegiatan: "Rapat Koordinasi",
            berangkat: hasil.checkIn,
            pulang: hasil.checkOut,
            malamOverride: null,
            hotelNama: null,
            hotelTarif: null,
            dinasJabatan: false,
          },
        ],
        biaya: [],
      },
    ],
  };

  const dummyBerkas: BerkasDto = {
    id: 1,
    stId: 1,
    pelaksanaId: null,
    namaAsli: berkas.split("/").pop() ?? "invoice.jpg",
    mime,
    ukuran: data.length,
    sha256: "0123456789abcdef",
    jenis: "hotel",
    createdAt: new Date().toISOString(),
    ekstraksi: {
      id: 1,
      berkasId: 1,
      status: "selesai",
      model: modelGambar,
      hasil,
      kodeGalat: null,
      galat: null,
      usulanStatus: "menunggu",
      createdAt: new Date().toISOString(),
      selesaiAt: new Date().toISOString(),
    },
  };

  const usulan = petakanHotelKeUsulan([dummyBerkas], dummySt, SBM_2026);
  console.log("\n--- HASIL PEMETAAN USULAN KE ST & SBM 2026 ---");
  console.log(JSON.stringify(usulan, null, 2));

  const plafon = cariPlafonHotelSbm("D.I. YOGYAKARTA", "ESELON_II", SBM_2026);
  console.log(`\nPlafon SBM D.I. YOGYAKARTA Eselon II: Rp${plafon?.toLocaleString("id-ID")}`);
  console.log(`Status usulan: ${usulan[0]?.statusPlafon} (Tarif riil: Rp${usulan[0]?.tarifRiilPerMalam?.toLocaleString("id-ID")}/malam)`);
} catch (error) {
  console.error("[probe-hotel] Gagal ekstrak invoice hotel:", error);
  process.exit(1);
}
