import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileBerkasStore } from "./store.js";

const SHA = "ab".repeat(32);
let dir: string;
let store: FileBerkasStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "spjan-store-"));
  store = new FileBerkasStore(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("FileBerkasStore", () => {
  it("menyimpan, membaca, dan menghapus isi berdasarkan sha256", async () => {
    expect(await store.has(SHA)).toBe(false);
    await store.put(SHA, Buffer.from("isi berkas"));
    expect(await store.has(SHA)).toBe(true);
    expect((await store.get(SHA)).toString()).toBe("isi berkas");
    await store.delete(SHA);
    expect(await store.has(SHA)).toBe(false);
    await store.delete(SHA); // idempoten
  });

  it("menaruh berkas di subfolder dua heks pertama dan tidak meninggalkan berkas sementara", async () => {
    await store.put(SHA, Buffer.from("x"));
    expect(await readdir(path.join(dir, "ab"))).toEqual([SHA]);
  });

  it("put kedua dengan sha sama tidak menimpa", async () => {
    await store.put(SHA, Buffer.from("pertama"));
    await store.put(SHA, Buffer.from("kedua"));
    expect((await store.get(SHA)).toString()).toBe("pertama");
  });

  it("menolak kunci yang bukan sha256 heks (mencegah path traversal)", async () => {
    await expect(store.put("../../etc/passwd", Buffer.from("x"))).rejects.toThrow("sha256 tidak valid");
    await expect(store.get("abc")).rejects.toThrow("sha256 tidak valid");
  });
});
