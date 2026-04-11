import { Router } from "express";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.post("/bg-remove", upload.single("image"), async (req, res) => {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "REMOVE_BG_API_KEY is not configured on the server." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No image file provided." });
    return;
  }

  try {
    const form = new FormData();
    form.append(
      "image_file",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname || "image.jpg",
    );
    form.append("size", "auto");

    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ error: text });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set("Content-Type", "image/png");
    res.set("Content-Length", String(buf.length));
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to contact remove.bg" });
  }
});

export default router;
