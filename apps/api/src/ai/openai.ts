import { AiGalat, type KlienAi, type PermintaanAi } from "./klien.js";

const ringkas = (teks: string) => teks.replace(/\s+/g, " ").slice(0, 200);

/** Tebak jenis gambar dari awalan base64; bawaan PNG (hasil pdftoppm). */
export function mimeGambar(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("UklGR")) return "image/webp";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  return "image/png";
}

/**
 * Klien format OpenAI `chat/completions` (dipakai Qwen lewat DashScope/Model Studio).
 * Skema JSON tidak didukung semua model, jadi skema disisipkan ke prompt dan diminta `json_object`.
 */
export function buatKlienOpenAi(apiKey: string | undefined): KlienAi {
  return {
    async chat(p: PermintaanAi): Promise<string> {
      if (!apiKey) {
        throw new AiGalat("KUNCI_DITOLAK", "API key Qwen belum diatur (QWEN_API_KEY atau DASHSCOPE_API_KEY).");
      }
      const prompt = p.skema ? `${p.prompt}\n\nJawab hanya dengan JSON yang sesuai JSON Schema berikut:\n${JSON.stringify(p.skema)}` : p.prompt;
      const gambar = p.gambar ?? [];
      const content =
        gambar.length > 0
          ? [
              ...gambar.map((g) => ({ type: "image_url", image_url: { url: `data:${mimeGambar(g)};base64,${g}` } })),
              { type: "text", text: prompt },
            ]
          : prompt;
      const body = {
        model: p.model,
        stream: false,
        temperature: 0,
        ...(p.maksToken ? { max_tokens: p.maksToken } : {}),
        ...(p.skema ? { response_format: { type: "json_object" } } : {}),
        // DashScope: keluaran JSON hanya didukung tanpa mode berpikir; matikan eksplisit.
        ...(p.baseUrl.includes("dashscope") ? { enable_thinking: false } : {}),
        messages: [{ role: "user", content }],
      };
      let status: number;
      let teks: string;
      try {
        const res = await fetch(`${p.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(p.timeoutMs ?? 120_000),
        });
        status = res.status;
        teks = await res.text();
      } catch (error) {
        const nama = (error as Error).name;
        if (nama === "TimeoutError" || nama === "AbortError") {
          throw new AiGalat("WAKTU_HABIS", "Model tidak menjawab dalam batas waktu.");
        }
        throw new AiGalat("MODEL_TIDAK_TERSEDIA", `Layanan model tidak terjangkau di ${p.baseUrl}.`);
      }
      if (status === 401 || status === 403) {
        throw new AiGalat("KUNCI_DITOLAK", `API key ditolak (${status}). Periksa QWEN_API_KEY di environment server.`);
      }
      if (status === 429) {
        throw new AiGalat("BATAS_PERMINTAAN", `Kuota atau batas permintaan model tercapai: ${ringkas(teks)}`);
      }
      if (status < 200 || status >= 300) {
        throw new AiGalat("MODEL_TIDAK_TERSEDIA", `Layanan model menjawab ${status}: ${ringkas(teks)}`);
      }
      try {
        const balasan = JSON.parse(teks) as {
          choices?: { message?: { content?: unknown }; finish_reason?: string }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const pilihan = balasan.choices?.[0];
        const isi = pilihan?.message?.content;
        if (typeof isi !== "string") throw new Error("tanpa isi");
        // Hanya angka pemakaian yang dicatat, tidak pernah isi dokumen atau jawaban.
        console.log(
          `[ai] model=${p.model} gambar=${gambar.length} token_masuk=${balasan.usage?.prompt_tokens ?? "?"} token_keluar=${balasan.usage?.completion_tokens ?? "?"} henti=${pilihan?.finish_reason ?? "?"}`,
        );
        return isi;
      } catch {
        throw new AiGalat("HASIL_TIDAK_VALID", "Balasan model tidak dapat dibaca.");
      }
    },
  };
}
