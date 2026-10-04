import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { MimeBerkas } from "@spjan/shared";

import { AiGalat } from "../ai/klien.js";

const jalankan = promisify(execFile);

export interface IsiBerkas {
  teks: string;
  /** Gambar base64 (tanpa prefiks data:). */
  gambar: string[];
}

const BATAS_TEKS = 12_000;
const MIN_TEKS_PDF = 50;
const MAKS_HALAMAN_GAMBAR = 3;

export async function bacaIsi(mime: MimeBerkas, data: Buffer): Promise<IsiBerkas> {
  if (mime !== "application/pdf") return { teks: "", gambar: [data.toString("base64")] };

  const dir = await mkdtemp(path.join(os.tmpdir(), "spjan-pdf-"));
  try {
    const pdf = path.join(dir, "masuk.pdf");
    await writeFile(pdf, data);
    let teks: string;
    try {
      const { stdout } = await jalankan("pdftotext", ["-layout", "-enc", "UTF-8", pdf, "-"], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30_000,
      });
      teks = stdout.trim();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AiGalat("GALAT_INTERNAL", "Utilitas sistem pembaca PDF (pdftotext) tidak ditemukan.");
      }
      throw new AiGalat("BERKAS_TIDAK_TERBACA", "PDF tidak dapat dibaca (rusak atau terkunci).");
    }
    if (teks.length >= MIN_TEKS_PDF) return { teks: teks.slice(0, BATAS_TEKS), gambar: [] };

    try {
      await jalankan("pdftoppm", ["-png", "-r", "110", "-scale-to", "2000", "-f", "1", "-l", String(MAKS_HALAMAN_GAMBAR), pdf, path.join(dir, "hal")], {
        timeout: 60_000,
      });
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
