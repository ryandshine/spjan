import type { MimeBerkas } from "@spjan/shared";

/** Jenis berkas dari byte awal; ekstensi dan Content-Type kiriman klien tidak dipercaya. */
export function deteksiMime(data: Buffer): MimeBerkas | null {
  if (data.length >= 5 && data.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (data.length >= 12 && data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}
