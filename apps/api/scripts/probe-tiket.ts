// Uji manual: ekstrak detail tiket penerbangan atau kereta dari PDF/gambar menggunakan model AI.
// Pemakaian: npx tsx scripts/probe-tiket.ts "/path/tiket.pdf" [--model-teks gpt-oss:120b-cloud] [--url http://127.0.0.1:11434]
import { readFile } from "node:fs/promises";

import {
  petakanTransportKeUsulan,
  type BerkasDto,
  type SuratTugasPayload,
} from "@spjan/shared";

import { klienOllama } from "../src/ai/ollama.js";
import { deteksiMime } from "../src/berkas/deteksi.js";
import { bacaIsi } from "../src/ekstraksi/baca-berkas.js";
import { ekstrakTiket } from "../src/ekstraksi/tiket.js";

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const berkas = process.argv[2];
const modelGambar = argumen("model-gambar") ?? "gemma4:cloud";
const modelTeks = argumen("model-teks") ?? argumen("model") ?? "gpt-oss:120b-cloud";
const url = argumen("url") ?? "http://127.0.0.1:11434";

if (!berkas) {
  console.error("Pemakaian: tsx scripts/probe-tiket.ts <berkas> [--model <nama>] [--url <ollama>]");
  process.exit(2);
}

const data = await readFile(berkas);
const mime = deteksiMime(data);
if (!mime) {
  console.error("Jenis berkas tidak didukung (bukan PDF/JPG/PNG/WEBP).");
  process.exit(2);
}

const isi = await bacaIsi(mime, data);
console.log(`[probe-tiket] ${berkas} mime=${mime} teks=${isi.teks.length} karakter gambar=${isi.gambar.length}`);

const mulai = Date.now();
try {
  const hasil = await ekstrakTiket(
    klienOllama,
    { llmUrl: url, modelTeks, modelGambar },
    isi
  );
  console.log(`[probe-tiket] model=${isi.gambar.length > 0 ? modelGambar : modelTeks} durasi=${((Date.now() - mulai) / 1000).toFixed(1)}s`);
  console.log("\n--- HASIL EKSTRAKSI TIKET ---");
  console.log(JSON.stringify(hasil, null, 2));

  // Simulasikan pemetaan ke usulan biaya dengan dummy ST
  const dummySt: SuratTugasPayload = {
    nomor: "ST.226/PPS/PEMPS/PSL.04.02/B/09/2026",
    tanggal: "2026-09-08",
    tanggalSpj: null,
    kodeAkun: "524111",
    catatan: "",
    pelaksana: [
      {
        nama: hasil.hasil.penumpang ?? "Gunadi Firdaus",
        nip: "197803101997031001",
        jabatan: "Kasubdit",
        status: "ESELON_II",
        noSpd: null,
        etape: [
          {
            provinsi: "D.I. YOGYAKARTA",
            kota: "Yogyakarta",
            kegiatan: "Rapat Koordinasi",
            berangkat: hasil.hasil.tanggal,
            pulang: hasil.hasil.tanggal,
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
    namaAsli: berkas.split("/").pop() ?? "tiket.pdf",
    mime,
    ukuran: data.length,
    sha256: "0123456789abcdef",
    jenis: "tiket",
    createdAt: new Date().toISOString(),
    ekstraksi: {
      id: 1,
      berkasId: 1,
      status: "selesai",
      model: hasil.model,
      hasil: hasil.hasil,
      kodeGalat: null,
      galat: null,
      usulanStatus: "menunggu",
      createdAt: new Date().toISOString(),
      selesaiAt: new Date().toISOString(),
    },
  };

  const usulan = petakanTransportKeUsulan([dummyBerkas], dummySt);
  console.log("\n--- HASIL PEMETAAN USULAN KE ST ---");
  console.log(JSON.stringify(usulan, null, 2));
} catch (error) {
  console.error("[probe-tiket] Gagal ekstrak tiket:", error);
  process.exit(1);
}
