import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./crypto.js";

describe("hash password (scrypt asinkron)", () => {
  it("menghasilkan hash identik dengan scryptSync lama sehingga hash tersimpan tetap valid", async () => {
    const salt = "00112233445566778899aabbccddeeff";
    const { hash } = await hashPassword("sandi-uji-12345", salt);
    expect(hash).toBe(scryptSync("sandi-uji-12345", salt, 64).toString("hex"));
  });

  it("verifikasi benar, salah, dan hash rusak", async () => {
    const { salt, hash } = await hashPassword("rahasia-panjang");
    expect(await verifyPassword("rahasia-panjang", salt, hash)).toBe(true);
    expect(await verifyPassword("salah", salt, hash)).toBe(false);
    expect(await verifyPassword("rahasia-panjang", salt, "abcd")).toBe(false);
  });

  it("salt acak berbeda tiap pemanggilan", async () => {
    const a = await hashPassword("x");
    const b = await hashPassword("x");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
