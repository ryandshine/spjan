import { z } from "zod";

/** JSON Schema untuk parameter `format` Ollama (tanpa kunci `$schema`). */
export function skemaJson(skema: z.ZodType): object {
  const hasil = { ...(z.toJSONSchema(skema) as Record<string, unknown>) };
  delete hasil.$schema;
  return hasil;
}
