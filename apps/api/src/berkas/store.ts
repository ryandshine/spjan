import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SHA256 = /^[0-9a-f]{64}$/;

/** Penyimpanan berkas beralamat isi (sha256). Implementasi S3/MinIO dapat ditambahkan tanpa mengubah pemakai. */
export interface BerkasStore {
  put(sha256: string, data: Buffer): Promise<void>;
  get(sha256: string): Promise<Buffer>;
  delete(sha256: string): Promise<void>;
  has(sha256: string): Promise<boolean>;
}

export class FileBerkasStore implements BerkasStore {
  constructor(private readonly root: string) {}

  private lokasi(sha256: string): string {
    if (!SHA256.test(sha256)) throw new Error("sha256 tidak valid");
    return path.join(this.root, sha256.slice(0, 2), sha256);
  }

  async put(sha256: string, data: Buffer): Promise<void> {
    const tujuan = this.lokasi(sha256);
    if (await this.has(sha256)) return;
    await mkdir(path.dirname(tujuan), { recursive: true });
    const sementara = `${tujuan}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(sementara, data);
    await rename(sementara, tujuan);
  }

  async get(sha256: string): Promise<Buffer> {
    return readFile(this.lokasi(sha256));
  }

  async delete(sha256: string): Promise<void> {
    await rm(this.lokasi(sha256), { force: true });
  }

  async has(sha256: string): Promise<boolean> {
    try {
      await stat(this.lokasi(sha256));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
}
