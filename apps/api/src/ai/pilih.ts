import { config } from "../config.js";
import type { KlienAi } from "./klien.js";
import { klienOllama } from "./ollama.js";
import { buatKlienOpenAi } from "./openai.js";

/** URL berformat OpenAI (`.../v1`, `.../compatible-mode/v1`) memakai klien OpenAI; selain itu Ollama. */
export function formatOpenAi(baseUrl: string): boolean {
  return /\/v\d+\/*$/.test(baseUrl) || baseUrl.includes("compatible-mode");
}

export function buatKlienAi(apiKey: string | undefined): KlienAi {
  const openAi = buatKlienOpenAi(apiKey);
  return { chat: (p) => (formatOpenAi(p.baseUrl) ? openAi : klienOllama).chat(p) };
}

export const klienAi: KlienAi = buatKlienAi(config.QWEN_API_KEY);
