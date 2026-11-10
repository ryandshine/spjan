import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { MimeBerkas } from "@spjan/shared";

import { AiGalat } from "../ai/klien.js";

const jalankan = promisify(execFile);

/**
 * Rapatkan teks hasil `pdftotext -layout`: spasi berderet (padding kolom) dan baris kosong berlebih menghabiskan token
 * tanpa menambah isi. Dua spasi tetap dipertahankan supaya batas kolom masih terbaca.
 */
export function rapatkanTeks(teks: string): string {
  return teks
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface IsiBerkas {
  teks: string;
  /** Gambar base64 (tanpa prefiks data:). */
  gambar: string[];
}

const BATAS_TEKS = 12_000;
const MIN_TEKS_PDF = 50;
// Dokumen teks asli rata-rata memuat > 60 karakter per halaman. Bila rata-rata di bawah ini,
// kemungkinan besar dokumen memuat gambar/screenshot yang hanya diberi sedikit teks caption.
const MIN_TEKS_PER_HALAMAN = 60;
// Ekstraksi dokumen kedinasan (ST, tiket, invoice): ambil maksimal 8 lembar di awal.
const MAKS_HALAMAN_BACA = 8;

// Sama dengan render PDF (-scale-to 2000). Model memperkecil gambar besar sendiri, jadi detail yang dibaca tidak berkurang.
const SISI_MAKS_FOTO = 2000;

/**
 * Salinan foto untuk model: sisi terpanjang maksimal 2000 px, JPEG kualitas 85, orientasi EXIF diterapkan.
 * Berkas asli tidak diubah. Gambar yang tidak bisa diproses dikirim apa adanya.
 */
export async function kecilkanFoto(data: Buffer): Promise<string> {
  try {
    const hasil = await sharp(data, { failOn: "none" })
      .rotate()
      .resize({ width: SISI_MAKS_FOTO, height: SISI_MAKS_FOTO, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    // Foto kecil yang sudah hemat tidak perlu diganti versi yang justru lebih besar.
    return (hasil.length < data.length ? hasil : data).toString("base64");
  } catch {
    return data.toString("base64");
  }
}

export async function bacaIsi(mime: MimeBerkas, data: Buffer): Promise<IsiBerkas> {
  if (mime !== "application/pdf") return { teks: "", gambar: [await kecilkanFoto(data)] };

  const dir = await mkdtemp(path.join(os.tmpdir(), "spjan-pdf-"));
  try {
    const pdf = path.join(dir, "masuk.pdf");
    await writeFile(pdf, data);
    let teks: string;
    let jumlahHalaman = 1;
    try {
      const { stdout } = await jalankan(
        "pdftotext",
        ["-layout", "-enc", "UTF-8", "-f", "1", "-l", String(MAKS_HALAMAN_BACA), pdf, "-"],
        {
          maxBuffer: 20 * 1024 * 1024,
          timeout: 30_000,
        },
      );
      teks = rapatkanTeks(stdout);
      jumlahHalaman = Math.max(1, stdout.match(/\f/g)?.length ?? 1);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AiGalat("GALAT_INTERNAL", "Utilitas sistem pembaca PDF (pdftotext) tidak ditemukan.");
      }
      throw new AiGalat("BERKAS_TIDAK_TERBACA", "PDF tidak dapat dibaca (rusak atau terkunci).");
    }
    const rataTeksPerHalaman = teks.length / jumlahHalaman;
    if (teks.length >= MIN_TEKS_PDF && rataTeksPerHalaman >= MIN_TEKS_PER_HALAMAN) {
      return { teks: teks.slice(0, BATAS_TEKS), gambar: [] };
    }

    try {
      await jalankan(
        "pdftoppm",
        ["-png", "-r", "110", "-scale-to", "2000", "-f", "1", "-l", String(MAKS_HALAMAN_BACA), pdf, path.join(dir, "hal")],
        {
          timeout: 60_000,
        },
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AiGalat("GALAT_INTERNAL", "Utilitas sistem pembaca PDF (pdftoppm) tidak ditemukan.");
      }
      throw new AiGalat("BERKAS_TIDAK_TERBACA", "Halaman PDF tidak dapat dirender menjadi gambar.");
    }
    const png = (await readdir(dir)).filter((n) => n.startsWith("hal") && n.endsWith(".png")).sort();
    if (png.length === 0) {
      throw new AiGalat("BERKAS_TIDAK_TERBACA", "PDF tidak dapat dirender menjadi gambar.");
    }
    const gambar = await Promise.all(png.map(async (n) => (await readFile(path.join(dir, n))).toString("base64")));
    return { teks, gambar };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
