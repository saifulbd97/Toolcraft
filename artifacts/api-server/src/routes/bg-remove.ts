import { Router, type Request, type Response } from "express";

const router = Router();

router.post("/api/bg-remove", async (req: Request, res: Response) => {
  try {
    const { image } = req.body as { image?: string };
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image field required" });
    }

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "REMOVE_BG_API_KEY not configured on server" });
    }

    // Strip data-URL prefix if present
    const base64 = image.replace(/^data:image\/[a-z+]+;base64,/, "");
    const imageBuffer = Buffer.from(base64, "base64");

    // Build multipart body for remove.bg — Node 18+ has native FormData/Blob
    const form = new FormData();
    form.append("image_file", new Blob([imageBuffer], { type: "image/png" }), "image.png");
    form.append("size", "auto");

    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("remove.bg error:", upstream.status, text);
      return res.status(upstream.status).json({ error: `remove.bg: ${upstream.status}` });
    }

    const buf = await upstream.arrayBuffer();
    const result = Buffer.from(buf).toString("base64");
    return res.json({ image: `data:image/png;base64,${result}` });
  } catch (err) {
    console.error("bg-remove error:", err);
    return res.status(500).json({ error: "Failed to remove background" });
  }
});

export default router;
