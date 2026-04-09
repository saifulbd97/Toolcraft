import { Router } from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdir, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, and PNG files are allowed"));
    }
  },
});

const pdfOnly = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const imageOnly = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG images are allowed"));
    }
  },
});

async function imageToPdfPage(pdf: PDFDocument, file: Express.Multer.File) {
  let image;
  if (file.mimetype === "image/jpeg") {
    image = await pdf.embedJpg(file.buffer);
  } else {
    image = await pdf.embedPng(file.buffer);
  }
  const { width, height } = image.scale(1);
  const page = pdf.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
}

async function fileToPdfDocument(file: Express.Multer.File): Promise<PDFDocument> {
  if (file.mimetype === "application/pdf") {
    return PDFDocument.load(file.buffer);
  }
  const singlePagePdf = await PDFDocument.create();
  await imageToPdfPage(singlePagePdf, file);
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

    const bytes = await mergedPdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(bytes));
  } catch (err) {
    req.log.error({ err }, "Failed to merge files");
    res.status(500).json({ error: "Failed to merge files. Please ensure all files are valid PDFs or images." });
  }
});

router.post("/pdf/info", pdfOnly.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Please upload a PDF file" });
      return;
    }
    const pdf = await PDFDocument.load(file.buffer);
    res.json({ pageCount: pdf.getPageCount() });
  } catch (err) {
    req.log.error({ err }, "Failed to read PDF info");
    res.status(500).json({ error: "Failed to read PDF. Please ensure it is a valid PDF file." });
  }
});

router.post("/pdf/jpg-to-pdf", imageOnly.array("files", 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Please upload at least one image" });
      return;
    }

    const pdf = await PDFDocument.create();
    for (const file of files) {
      await imageToPdfPage(pdf, file);
    }

    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="converted.pdf"');
    res.send(Buffer.from(bytes));
  } catch (err) {
    req.log.error({ err }, "Failed to convert images to PDF");
    res.status(500).json({ error: "Failed to convert images to PDF." });
  }
});

router.post("/pdf/split", pdfOnly.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Please upload a PDF file" });
      return;
    }

    const mode = (req.body.mode as string) || "all";
    const sourcePdf = await PDFDocument.load(file.buffer);
    const totalPages = sourcePdf.getPageCount();

    if (mode === "range") {
      const from = Math.max(1, parseInt(req.body.from as string, 10) || 1);
      const to = Math.min(totalPages, parseInt(req.body.to as string, 10) || totalPages);

      if (from > to) {
        res.status(400).json({ error: `Invalid range: 'from' (${from}) must be ≤ 'to' (${to}).` });
        return;
      }

      const extracted = await PDFDocument.create();
      const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
      const pages = await extracted.copyPages(sourcePdf, indices);
      pages.forEach((p) => extracted.addPage(p));

      const bytes = await extracted.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pages-${from}-to-${to}.pdf"`);
      res.send(Buffer.from(bytes));
    } else {
      const zip = new JSZip();
      const digits = String(totalPages).length;

      for (let i = 0; i < totalPages; i++) {
        const singlePage = await PDFDocument.create();
        const [page] = await singlePage.copyPages(sourcePdf, [i]);
        singlePage.addPage(page);
        const bytes = await singlePage.save();
        const padded = String(i + 1).padStart(digits, "0");
        zip.file(`page-${padded}.pdf`, bytes);
      }

      const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="split-pages.zip"');
      res.send(zipBuf);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to split PDF");
    res.status(500).json({ error: "Failed to split PDF. Please ensure it is a valid PDF file." });
  }
});

router.post("/pdf/compress", pdfOnly.single("file"), async (req, res) => {
  const tmpIn = join(tmpdir(), `pdf-in-${randomUUID()}.pdf`);
  const tmpOut = join(tmpdir(), `pdf-out-${randomUUID()}.pdf`);

  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Please upload a PDF file" });
      return;
    }

    const quality = (req.body.quality as string) || "medium";
    const gsSettings =
      quality === "low" ? "/screen" : quality === "high" ? "/printer" : "/ebook";

    const originalSize = file.buffer.length;
    await writeFile(tmpIn, file.buffer);

    await new Promise<void>((resolve, reject) => {
      const gs = spawn("gs", [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        `-dPDFSETTINGS=${gsSettings}`,
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dEmbedAllFonts=true",
        `-sOutputFile=${tmpOut}`,
        tmpIn,
      ]);
      gs.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Ghostscript exited with code ${code}`));
      });
      gs.on("error", reject);
    });

    const compressedBuffer = await readFile(tmpOut);
    const compressedSize = compressedBuffer.length;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="compressed.pdf"');
    res.setHeader("X-Original-Size", originalSize.toString());
    res.setHeader("X-Compressed-Size", compressedSize.toString());
    res.setHeader("Access-Control-Expose-Headers", "X-Original-Size, X-Compressed-Size");
    res.send(compressedBuffer);
  } catch (err) {
    req.log.error({ err }, "Failed to compress PDF");
    res.status(500).json({ error: "Failed to compress PDF. Please ensure it is a valid PDF file." });
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
});

router.post("/pdf/pdf-to-jpg", pdfOnly.single("file"), async (req, res) => {
  const tmpIn = join(tmpdir(), `pdf-in-${randomUUID()}.pdf`);
  const tmpOut = join(tmpdir(), `pdf2jpg-${randomUUID()}`);

  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Please upload a PDF file" });
      return;
    }

    await writeFile(tmpIn, file.buffer);
    await mkdir(tmpOut, { recursive: true });

    const outPrefix = join(tmpOut, "page");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("pdftoppm", [
        "-jpeg",
        "-jpegopt", "quality=92",
        "-r", "150",
        tmpIn,
        outPrefix,
      ]);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pdftoppm exited with code ${code}`));
      });
      proc.on("error", reject);
    });

    const filenames = (await readdir(tmpOut))
      .filter((f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".ppm"))
      .sort();

    if (filenames.length === 0) {
      throw new Error("No pages were extracted from the PDF");
    }

    const zip = new JSZip();
    for (const filename of filenames) {
      const imgBuffer = await readFile(join(tmpOut, filename));
      const safeName = filename.replace(/\.ppm$/, ".jpg");
      zip.file(safeName, imgBuffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="pages.zip"');
    res.setHeader("X-Page-Count", filenames.length.toString());
    res.setHeader("Access-Control-Expose-Headers", "X-Page-Count");
    res.send(zipBuffer);
  } catch (err) {
    req.log.error({ err }, "Failed to convert PDF to JPG");
    res.status(500).json({ error: "Failed to convert PDF to images. Please ensure it is a valid PDF file." });
  } finally {
    await unlink(tmpIn).catch(() => {});
    await rm(tmpOut, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;

