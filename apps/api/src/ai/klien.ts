import type { KodeGalatAi } from "@spjan/shared";

export interface PermintaanAi {
  baseUrl: string;
  model: string;
  prompt: string;
  /** Gambar base64 (tanpa prefiks data:). */
  gambar?: string[];
  /** JSON Schema untuk keluaran terstruktur. */
  skema?: object;
  timeoutMs?: number;
  /** Batas token keluaran (`num_predict`); pagar agar jawaban yang melantur tidak berjalan sampai timeout. */
  maksToken?: number;
  /** Penampung pemakaian; klien menambahkan token tiap panggilan yang dijawab layanan. */
  pemakaian?: PemakaianAi;
}

export interface PemakaianAi {
  panggilan: number;
  tokenMasuk: number;
  tokenKeluar: number;
  /** Model terakhir yang dipanggil. */
  model: string | null;
}

export const pemakaianKosong = (): PemakaianAi => ({ panggilan: 0, tokenMasuk: 0, tokenKeluar: 0, model: null });

/** Tambahkan angka pemakaian ke penampung (bila ada). Nilai yang tidak dilaporkan layanan dihitung 0. */
export function catatPemakaian(p: PermintaanAi, tokenMasuk: number | undefined, tokenKeluar: number | undefined): void {
  if (!p.pemakaian) return;
  p.pemakaian.panggilan += 1;
  p.pemakaian.tokenMasuk += tokenMasuk ?? 0;
  p.pemakaian.tokenKeluar += tokenKeluar ?? 0;
  p.pemakaian.model = p.model;
}

export interface KlienAi {
  chat(permintaan: PermintaanAi): Promise<string>;
}

export interface KonfigurasiAi {
  llmUrl: string;
  modelTeks: string | null;
  modelGambar: string | null;
}

export class AiGalat extends Error {
  constructor(
    readonly kode: KodeGalatAi,
    message: string,
  ) {
    super(message);
  }
}
