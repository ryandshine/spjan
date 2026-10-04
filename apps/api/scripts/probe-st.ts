// Uji manual: ekstrak detail Surat Tugas dari berkas PDF/gambar asli menggunakan model AI teks.
// Pemakaian: npx tsx scripts/probe-st.ts "/path/ST.226.pdf" [--model gpt-oss:120b-cloud] [--url http://127.0.0.1:11434]
import { readFile } from "node:fs/promises";

import { klienOllama } from "../src/ai/ollama.js";
import { deteksiMime } from "../src/berkas/deteksi.js";
import { bacaIsi } from "../src/ekstraksi/baca-berkas.js";
import { ekstrakSt } from "../src/ekstraksi/st.js";
import { petakanStKeUsulan } from "@spjan/shared";

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const berkas = process.argv[2];
const model = argumen("model") ?? "gpt-oss:120b-cloud";
const url = argumen("url") ?? "http://127.0.0.1:11434";

if (!berkas) {
  console.error("Pemakaian: tsx scripts/probe-st.ts <berkas> [--model <nama>] [--url <ollama>]");
  process.exit(2);
}

const data = await readFile(berkas);
const mime = deteksiMime(data);
if (!mime) {
  console.error("Jenis berkas tidak didukung (bukan PDF/JPG/PNG/WEBP).");
  process.exit(2);
}

const isi = await bacaIsi(mime, data);
console.log(`[probe-st] ${berkas} mime=${mime} teks=${isi.teks.length} karakter gambar=${isi.gambar.length}`);

const mulai = Date.now();
try {
  const hasil = await ekstrakSt(klienOllama, { llmUrl: url, modelTeks: model, modelGambar: model }, isi);
  console.log(`[probe-st] model=${model} durasi=${((Date.now() - mulai) / 1000).toFixed(1)}s`);
  console.log("\n--- HASIL EKSTRAKSI ST ---");
  console.log(JSON.stringify(hasil, null, 2));

  // Simulasikan pemetaan ke usulan draf
  const mockMasterPegawai = [
    {
      id: 1,
      nip: "198701012010121001",
      nama: "Budi Santoso",
      jabatan: "Pengendali Ekosistem Hutan Ahli Madya",
      status: "ESELON_III_GOL_IV" as const,
      pangkatGolongan: "IV/a",
      aktif: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const daftarProvinsiSbm = [
    "ACEH", "SUMATERA UTARA", "SUMATERA BARAT", "RIAU", "JAMBI", "SUMATERA SELATAN",
    "BENGKULU", "LAMPUNG", "KEPULAUAN BANGKA BELITUNG", "KEPULAUAN RIAU",
    "DKI JAKARTA", "JAWA BARAT", "JAWA TENGAH", "D.I. YOGYAKARTA", "JAWA TIMUR",
    "BANTEN", "BALI", "NUSA TENGGARA BARAT", "NUSA TENGGARA TIMUR",
  ];

  const usulan = petakanStKeUsulan(hasil.hasil, mockMasterPegawai, daftarProvinsiSbm, {
    kodeAkunDefault: "524111",
  });

  console.log("\n--- HASIL USULAN DRAF ST ---");
  console.log(`Nomor: ${usulan.payload.nomor}`);
  console.log(`Tanggal: ${usulan.payload.tanggal}`);
  console.log(`Pelaksana: ${usulan.pelaksanaStatus.length} orang`);
  usulan.pelaksanaStatus.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.nama} (NIP: ${p.nip ?? "-"}) -> Status: ${p.baru ? "BARU" : "TERDAFTAR (ID " + p.pegawaiId + ")"}`);
  });
  if (usulan.peringatan.length > 0) {
    console.log("\nPeringatan Pemetaan:");
    usulan.peringatan.forEach((w) => console.log(`  - ${w}`));
  }
} catch (error) {
  console.error(`[probe-st] GAGAL model=${model} setelah ${((Date.now() - mulai) / 1000).toFixed(1)}s:`, (error as Error).message);
  process.exit(1);
}
