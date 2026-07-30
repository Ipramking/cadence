/**
 * Low-level Gemini client. Raw REST (no SDK) to keep the dependency surface
 * small. Never pass secrets, BVNs or identity documents into these calls —
 * only amounts, labels and timestamps.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const KEY = process.env.GEMINI_API_KEY ?? "";

export function aiAvailable(): boolean {
  return KEY.length > 0;
}

export class AiUnavailable extends Error {
  constructor() {
    super("AI unavailable");
    this.name = "AiUnavailable";
  }
}

interface GenerateOptions {
  system?: string;
  json?: boolean;
  temperature?: number;
}

export async function generate(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string> {
  if (!KEY) throw new AiUnavailable();

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`gemini ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/**
 * Multimodal generation — reads an image (e.g. a payment screenshot) alongside
 * the prompt. Never send identity documents here; only payment-detail images
 * the user chose to share.
 */
export async function generateVision(
  prompt: string,
  image: { data: string; mimeType: string },
  opts: { system?: string; json?: boolean } = {},
): Promise<string> {
  if (!KEY) throw new AiUnavailable();

  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: image.mimeType, data: image.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`gemini ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
