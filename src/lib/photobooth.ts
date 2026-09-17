import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(8).max(1200),
  imageBase64: z.string().max(6_000_000).optional(),
  mode: z.enum(["portrait", "stage"]).default("portrait"),
});

export const generateBoothArt = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Image booth is unavailable in this environment." };
    }

    const prompt = data.mode === "stage"
      ? `${data.prompt}. Cinematic fighting-game stage concept art, wide establishing shot, dramatic lighting, no logos, no readable signage.`
      : `${data.prompt}. High-resolution fighting-game character select portrait, painted concept art, bust from mid-chest up, sharp facial detail, dramatic rim light, dark metallic backdrop. Not pixelated, not 8-bit, not low resolution.`;

    try {
      if (data.imageBase64) {
        const edited = await fetch("https://api.x.ai/v1/images/edits", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "grok-imagine-image",
            prompt: `Use the uploaded photo as a hard pose / identity control (ControlNet-style). Keep silhouette, camera angle, face, and body type. ${prompt}`,
            image: data.imageBase64,
            n: 1,
            response_format: "b64_json",
          }),
        });
        if (edited.ok) {
          const body = (await edited.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
          const art = body.data?.[0]?.b64_json
            ? `data:image/png;base64,${body.data[0].b64_json}`
            : body.data?.[0]?.url;
          if (art) return { ok: true as const, image: art };
        }
      }

      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-imagine-image",
          prompt,
          n: 1,
          response_format: "b64_json",
        }),
      });
      if (!res.ok) {
        return { ok: false as const, error: `Studio returned ${res.status}` };
      }
      const body = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const art = body.data?.[0]?.b64_json
        ? `data:image/png;base64,${body.data[0].b64_json}`
        : body.data?.[0]?.url;
      if (!art) return { ok: false as const, error: "Studio returned an empty frame." };
      return { ok: true as const, image: art };
    } catch {
      return { ok: false as const, error: "Studio request failed." };
    }
  });
