import { describe, expect, it } from "vitest";

import { deteksiMime } from "./deteksi.js";

const b = (...byte: number[]) => Buffer.from(byte);

describe("deteksiMime", () => {
  it("mengenali PDF, JPEG, PNG, dan WEBP dari isi", () => {
    expect(deteksiMime(Buffer.from("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(deteksiMime(Buffer.concat([b(0xff, 0xd8, 0xff, 0xe0), Buffer.alloc(20)]))).toBe("image/jpeg");
    expect(deteksiMime(Buffer.concat([b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), Buffer.alloc(20)]))).toBe("image/png");
    expect(deteksiMime(Buffer.concat([Buffer.from("RIFF"), b(0, 0, 0, 0), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]))).toBe("image/webp");
  });

  it("menolak jenis lain dan berkas terlalu pendek", () => {
    expect(deteksiMime(Buffer.from("halo dunia ini teks biasa"))).toBeNull();
    expect(deteksiMime(Buffer.from("MZ\x90\x00"))).toBeNull();
    expect(deteksiMime(Buffer.alloc(0))).toBeNull();
    expect(deteksiMime(Buffer.from("RIFF1234WAVEfmt "))).toBeNull();
  });
});
