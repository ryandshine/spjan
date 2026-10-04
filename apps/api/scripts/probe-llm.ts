// Uji manual: baca satu berkas asli dengan model tertentu dan cetak hasil klasifikasinya.
// Pemakaian: npx tsx scripts/probe-llm.ts "/path/invoice.jpeg" --model kimi-k3:cloud [--url http://127.0.0.1:11434]
import { readFile } from "node:fs/promises";

import { klienOllama } from "../src/ai/ollama.js";
import { deteksiMime } from "../src/berkas/deteksi.js";
import { bacaIsi } from "../src/ekstraksi/baca-berkas.js";
import { klasifikasiBerkas } from "../src/ekstraksi/klasifikasi.js";

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const berkas = process.argv[2];
const model = argumen("model");
const url = argumen("url") ?? "http://127.0.0.1:11434";
if (!berkas || !model) {
  console.error('Pemakaian: tsx scripts/probe-llm.ts <berkas> --model <nama> [--url <ollama>]');
  process.exit(2);
}

const data = await readFile(berkas);
const mime = deteksiMime(data);
if (!mime) {
  console.error("Jenis berkas tidak didukung (bukan PDF/JPG/PNG/WEBP).");
  process.exit(2);
}
const isi = await bacaIsi(mime, data);
console.log(`[probe] ${berkas} mime=${mime} teks=${isi.teks.length} karakter gambar=${isi.gambar.length}`);
const mulai = Date.now();
try {
  const { hasil } = await klasifikasiBerkas(klienOllama, { llmUrl: url, modelTeks: model, modelGambar: model }, isi);
  console.log(`[probe] model=${model} durasi=${((Date.now() - mulai) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(hasil, null, 2));
} catch (error) {
  console.error(`[probe] GAGAL model=${model} setelah ${((Date.now() - mulai) / 1000).toFixed(1)}s:`, (error as Error).message);
  process.exit(1);
}
