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
