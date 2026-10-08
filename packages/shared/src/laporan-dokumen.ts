import { z } from "zod";

/** Dokumen teks kaya (JSON ProseMirror/TipTap) dalam subset yang dikenali editor dan PDF. */
export interface TandaDok {
  type: "bold" | "italic" | "underline" | "link";
  attrs?: Record<string, unknown>;
}
export interface NodeDok {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NodeDok[];
  text?: string;
  marks?: TandaDok[];
}
export interface Dok {
  type: "doc";
  content?: NodeDok[];
}

const JENIS_NODE = [
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
] as const;
const JENIS_TANDA = ["bold", "italic", "underline", "link"] as const;

const MAKS_KEDALAMAN = 12;
const MAKS_NODE = 5000;
const MAKS_UKURAN_JSON = 300_000;

const TandaSchema = z
  .object({ type: z.enum(JENIS_TANDA), attrs: z.record(z.string(), z.unknown()).optional() })
  .refine(
    (t) => t.type !== "link" || (typeof t.attrs?.href === "string" && t.attrs.href.length <= 2000 && /^(https?:\/\/|mailto:)/i.test(t.attrs.href)),
    { message: "Tautan harus diawali http://, https://, atau mailto:." },
  );

const NodeSchema: z.ZodType<NodeDok> = z.lazy(() =>
  z.object({
    type: z.enum(JENIS_NODE),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(NodeSchema).max(500).optional(),
    text: z.string().max(10_000).optional(),
    marks: z.array(TandaSchema).max(6).optional(),
  }),
);

export const DokSchema: z.ZodType<Dok> = z
  .object({ type: z.literal("doc"), content: z.array(NodeSchema).max(500).optional() })
  .superRefine((dok, ctx) => {
    let jumlah = 0;
    const periksa = (n: NodeDok, kedalaman: number): void => {
      jumlah += 1;
      if (kedalaman > MAKS_KEDALAMAN) return ctx.addIssue({ code: "custom", message: "Dokumen terlalu bersarang." });
      if (n.type === "text" ? typeof n.text !== "string" || n.text.length === 0 : n.text !== undefined) {
        return ctx.addIssue({ code: "custom", message: "Teks hanya boleh pada node text dan tidak boleh kosong." });
      }
      if (n.type === "image") {
        const id = n.attrs?.berkasId;
        if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
          return ctx.addIssue({ code: "custom", message: "Gambar harus merujuk berkasId yang valid." });
        }
      }
      for (const anak of n.content ?? []) periksa(anak, kedalaman + 1);
    };
    for (const n of dok.content ?? []) periksa(n, 1);
    if (jumlah > MAKS_NODE) ctx.addIssue({ code: "custom", message: "Dokumen terlalu besar." });
    if (JSON.stringify(dok).length > MAKS_UKURAN_JSON) ctx.addIssue({ code: "custom", message: "Dokumen terlalu besar." });
  });

/** Dokumen kosong yang valid: satu paragraf tanpa isi. */
export function dokKosong(): Dok {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** Bentuk lama (versi 1) yang masih dikonversi: paragraf, subjudul, daftar berbutir, daftar bernomor. */
export type BlokLama =
  | { tipe: "paragraf"; teks: string }
  | { tipe: "subjudul"; teks: string }
  | { tipe: "daftar" | "nomor"; butir: string[] };

const paragrafDari = (teks: string): NodeDok => (teks ? { type: "paragraph", content: [{ type: "text", text: teks }] } : { type: "paragraph" });

export function dokDariBlok(blok: BlokLama[]): Dok {
  const isi: NodeDok[] = blok.map((b): NodeDok => {
    if (b.tipe === "paragraf") return paragrafDari(b.teks);
    if (b.tipe === "subjudul") {
      return b.teks ? { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: b.teks }] } : { type: "heading", attrs: { level: 3 } };
    }
    const butir = b.butir.length > 0 ? b.butir : [""];
    return { type: b.tipe === "nomor" ? "orderedList" : "bulletList", content: butir.map((x) => ({ type: "listItem", content: [paragrafDari(x)] })) };
  });
  return isi.length > 0 ? { type: "doc", content: isi } : dokKosong();
}

/** Teks polos dokumen (untuk tes dan pencarian), antar blok dipisah baris baru. */
export function dokKeTeks(dok: Dok): string {
  const jalan = (n: NodeDok): string => {
    if (n.type === "text") return n.text ?? "";
    if (n.type === "hardBreak") return "\n";
    const anak = (n.content ?? []).map(jalan);
    if (n.type === "paragraph" || n.type === "heading") return `${anak.join("")}\n`;
    if (n.type === "tableCell" || n.type === "tableHeader") return anak.join("").replace(/\n+$/, "");
    if (n.type === "tableRow") return `${anak.join("\t")}\n`;
    return anak.join("");
  };
  return (dok.content ?? []).map(jalan).join("").replace(/\n+$/, "");
}

/** Apakah dokumen punya isi tercetak (teks, gambar, atau tabel). */
export function dokPunyaIsi(dok: Dok): boolean {
  const ada = (n: NodeDok): boolean =>
    (n.type === "text" && (n.text ?? "").trim().length > 0) || n.type === "image" || n.type === "table" || (n.content ?? []).some(ada);
  return (dok.content ?? []).some(ada);
}
