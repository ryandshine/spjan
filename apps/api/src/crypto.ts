import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * scrypt asinkron (jalan di threadpool libuv) agar login dan konfirmasi password
 * tidak memblokir event loop. Parameter bawaan sama dengan scryptSync sehingga
 * hash yang sudah tersimpan tetap cocok.
 */
function turunkanKunci(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, kunci) => (error ? reject(error) : resolve(kunci)));
  });
}

export async function hashPassword(
  password: string,
  salt: string = randomBytes(16).toString("hex"),
): Promise<{ salt: string; hash: string }> {
  return { salt, hash: (await turunkanKunci(password, salt)).toString("hex") };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const derived = await turunkanKunci(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
