import { Router } from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/pdf/merge", upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length < 2) {
      res.status(400).json({ error: "Please upload at least 2 PDF files to merge" });
      return;
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const pdf = await PDFDocument.load(file.buffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (err) {
    req.log.error({ err }, "Failed to merge PDFs");
    res.status(500).json({ error: "Failed to merge PDFs. Please ensure all files are valid PDFs." });
  }
});

export default router;
