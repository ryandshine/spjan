import { z } from "zod";

export const JENIS_BERKAS = ["belum", "st", "hotel", "tiket", "transport", "lainnya"] as const;
export type JenisBerkas = (typeof JENIS_BERKAS)[number];

export const JENIS_BERKAS_LABEL: Record<JenisBerkas, string> = {
  belum: "Belum dikenali",
  st: "Surat tugas",
  hotel: "Invoice hotel",
  tiket: "Tiket",
  transport: "Bukti transport",
  lainnya: "Lainnya",
};

export const STATUS_EKSTRAKSI = ["antre", "berjalan", "selesai", "gagal"] as const;
export type StatusEkstraksi = (typeof STATUS_EKSTRAKSI)[number];

export const STATUS_USULAN = ["menunggu", "diterapkan", "diabaikan"] as const;
export type StatusUsulan = (typeof STATUS_USULAN)[number];

export const KODE_GALAT_AI = [
  "MODEL_PENSIUN",
  "MODEL_TIDAK_TERSEDIA",
  "MODEL_BELUM_DIATUR",
  "HASIL_TIDAK_VALID",
  "WAKTU_HABIS",
  "BERKAS_TIDAK_TERBACA",
  "GALAT_INTERNAL",
] as const;
export type KodeGalatAi = (typeof KODE_GALAT_AI)[number];

export const BATAS_BERKAS = { maksUkuranMb: 10, maksPerSt: 30 } as const;

export const MIME_BERKAS = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type MimeBerkas = (typeof MIME_BERKAS)[number];

export interface EkstraksiDto {
  id: number;
  berkasId: number;
  status: StatusEkstraksi;
  model: string | null;
  hasil: unknown;
  kodeGalat: KodeGalatAi | null;
  galat: string | null;
  usulanStatus: StatusUsulan;
  createdAt: string;
  selesaiAt: string | null;
}

export interface BerkasDto {
  id: number;
  /** null = belum terkait surat tugas (mis. ST yang baru diunggah untuk dijadikan draf). */
  stId: number | null;
  /** null = belum/tidak dikaitkan ke pelaksana tertentu. */
  pelaksanaId: number | null;
  namaAsli: string;
  mime: MimeBerkas;
  ukuran: number;
  sha256: string;
  jenis: JenisBerkas;
  createdAt: string;
  /** Ekstraksi terbaru; null bila belum pernah dijadwalkan. */
  ekstraksi: EkstraksiDto | null;
}

export const UpdateUsulanBerkasPayloadSchema = z.object({
  usulanStatus: z.enum(STATUS_USULAN),
  pelaksanaId: z.number().int().positive().nullable().optional(),
});
export type UpdateUsulanBerkasPayload = z.infer<typeof UpdateUsulanBerkasPayloadSchema>;

export const ModelAiPayloadSchema = z.object({
  llmUrl: z.url().max(200).nullable(),
  modelTeks: z.string().trim().min(1).max(100).nullable(),
  modelGambar: z.string().trim().min(1).max(100).nullable(),
});
export type ModelAiPayload = z.infer<typeof ModelAiPayloadSchema>;

export interface ModelAiDto extends ModelAiPayload {
  /** URL yang dipakai bila `llmUrl` null (dari env OLLAMA_URL). */
  bawaanUrl: string;
}

export interface UjiModelHasil {
  ok: boolean;
  model: string | null;
  durasiMs: number;
  balasan?: string;
  kode?: KodeGalatAi;
  pesan?: string;
}

export const HasilKlasifikasiSchema = z.object({
  jenis: z.enum(["st", "hotel", "tiket", "transport", "lainnya"]),
  ringkasan: z.string().max(300),
});
export type HasilKlasifikasi = z.infer<typeof HasilKlasifikasiSchema>;
