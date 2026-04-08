import { Router } from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";

const router = Router();

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, and PNG files are allowed"));
    }
  },
});

async function fileToPdfDocument(file: Express.Multer.File): Promise<PDFDocument> {
  if (file.mimetype === "application/pdf") {
    return PDFDocument.load(file.buffer);
  }

  const singlePagePdf = await PDFDocument.create();

  let image;
  if (file.mimetype === "image/jpeg") {
    image = await singlePagePdf.embedJpg(file.buffer);
  } else {
    image = await singlePagePdf.embedPng(file.buffer);
  }

  const { width, height } = image.scale(1);
  const page = singlePagePdf.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  return singlePagePdf;
}

router.post("/pdf/merge", upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length < 2) {
      res.status(400).json({ error: "Please upload at least 2 files to merge" });
      return;
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const pdf = await fileToPdfDocument(file);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (err) {
    req.log.error({ err }, "Failed to merge files");
    res.status(500).json({ error: "Failed to merge files. Please ensure all files are valid PDFs or images." });
  }
});

export default router;
