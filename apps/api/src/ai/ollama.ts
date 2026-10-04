import { AiGalat, type KlienAi, type PermintaanAi } from "./klien.js";

const ringkas = (teks: string) => teks.replace(/\s+/g, " ").slice(0, 200);

export const klienOllama: KlienAi = {
  async chat(p: PermintaanAi): Promise<string> {
    const body = {
      model: p.model,
      stream: false,
      ...(p.skema ? { format: p.skema } : {}),
      options: { temperature: 0 },
      messages: [{ role: "user", content: p.prompt, ...(p.gambar && p.gambar.length > 0 ? { images: p.gambar } : {}) }],
    };
    let status: number;
    let teks: string;
    try {
      const res = await fetch(`${p.baseUrl.replace(/\/+$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      throw new AiGalat("MODEL_TIDAK_TERSEDIA", `Ollama tidak terjangkau di ${p.baseUrl}.`);
    }
    if (status === 410) {
      throw new AiGalat("MODEL_PENSIUN", `Model "${p.model}" sudah dipensiunkan. Ganti di Pengaturan > Model AI.`);
    }
    if (status < 200 || status >= 300) {
      throw new AiGalat("MODEL_TIDAK_TERSEDIA", `Ollama menjawab ${status}: ${ringkas(teks)}`);
    }
    try {
      const isi = (JSON.parse(teks) as { message?: { content?: unknown } }).message?.content;
      if (typeof isi !== "string") throw new Error("tanpa isi");
      return isi;
    } catch {
      throw new AiGalat("HASIL_TIDAK_VALID", "Balasan Ollama tidak dapat dibaca.");
    }
  },
};
