import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
});

const PROMPT = `Look at this image and find the main document, paper, receipt, or card.
Return ONLY a compact JSON object with the 4 corner coordinates as fractions (0.0–1.0) of the image dimensions.
TL = top-left, TR = top-right, BR = bottom-right, BL = bottom-left.
Example: {"tl":{"x":0.05,"y":0.04},"tr":{"x":0.95,"y":0.04},"br":{"x":0.96,"y":0.96},"bl":{"x":0.04,"y":0.96}}
If no clear document is visible, return: {"tl":null}
No explanation, no markdown, just the JSON object.`;

router.post("/api/detect-corners", async (req: Request, res: Response) => {
  try {
    const { image } = req.body as { image?: string };
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image required" });
    }

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: image },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ corners: null });

    const parsed = JSON.parse(match[0]) as {
      tl: { x: number; y: number } | null;
      tr?: { x: number; y: number };
      br?: { x: number; y: number };
      bl?: { x: number; y: number };
    };

    if (!parsed.tl || !parsed.tr || !parsed.br || !parsed.bl) {
      return res.json({ corners: null });
    }

    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return res.json({
      corners: {
        tl: { x: clamp(parsed.tl.x), y: clamp(parsed.tl.y) },
        tr: { x: clamp(parsed.tr.x), y: clamp(parsed.tr.y) },
        br: { x: clamp(parsed.br.x), y: clamp(parsed.br.y) },
        bl: { x: clamp(parsed.bl.x), y: clamp(parsed.bl.y) },
      },
    });
  } catch (err) {
    console.error("detect-corners error:", err);
    return res.json({ corners: null });
  }
});

export default router;
