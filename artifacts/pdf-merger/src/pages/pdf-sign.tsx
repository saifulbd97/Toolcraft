import React, { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Download, FileUp, PenLine, Type, ImageIcon,
  RefreshCcw, Loader2, ChevronRight, RotateCcw, ChevronLeft,
  ZoomIn, ZoomOut, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

type Step = "upload" | "signature" | "place";
type SigMode = "draw" | "type" | "upload";
type ResizeCorner = "tl" | "tr" | "bl" | "br" | null;

const FONTS = [
  { label: "Cursive", css: "Georgia, serif" },
  { label: "Script", css: "'Segoe Script', 'Bradley Hand', cursive" },
  { label: "Print", css: "system-ui, sans-serif" },
];

export default function PdfSign() {
  const [step, setStep] = useState<Step>("upload");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [renderScale, setRenderScale] = useState(1.0);
  const [canvasH, setCanvasH] = useState(0);
  const [sigMode, setSigMode] = useState<SigMode>("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [fontIdx, setFontIdx] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  // Signature placement — committed state
  const [sigPos, setSigPos] = useState({ x: 60, y: 60 });
  const [sigSize, setSigSize] = useState({ w: 220, h: 80 });

  // Refs for DOM-level drag (zero-lag, no React re-renders during move)
  const sigElRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ mx: number; my: number; ow: number; oh: number; corner: ResizeCorner; ox: number; oy: number } | null>(null);
  const posRef = useRef({ x: 60, y: 60 });
  const sizeRef = useRef({ w: 220, h: 80 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Keep posRef / sizeRef in sync with state
  useEffect(() => { posRef.current = sigPos; }, [sigPos]);
  useEffect(() => { sizeRef.current = sigSize; }, [sigSize]);

  // ─── PDF load ──────────────────────────────────────────────
  async function loadPdf(file: File) {
    if (file.type !== "application/pdf") return;
    setPdfFile(file);
    const bytes = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    setPdfDoc(doc);
    setPageCount(doc.numPages);
    setCurrentPage(1);
    setStep("signature");
    setSigDataUrl(null);
    setTypedText("");
    setConfirmed(false);
  }

  // ─── PDF render ─────────────────────────────────────────────
  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number, zoomLevel: number) => {
    if (!pageCanvasRef.current || !previewRef.current) return;
    setRendering(true);
    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      const page = await doc.getPage(pageNum);
      const containerW = previewRef.current.clientWidth || 600;
      const baseViewport = page.getViewport({ scale: 1.0 });
      const scale = (containerW / baseViewport.width) * zoomLevel;
      const viewport = page.getViewport({ scale });

      const canvas = pageCanvasRef.current;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setRenderScale(scale);
      setCanvasH(viewport.height);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "RenderingCancelledException") console.error(e);
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (pdfDoc && step === "place") {
      renderPage(pdfDoc, currentPage, zoom);
    }
  }, [pdfDoc, currentPage, zoom, step, renderPage]);

  // ─── Draw ──────────────────────────────────────────────────
  function getXY(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    const me = e as React.MouseEvent;
    return { x: (me.clientX - rect.left) * scaleX, y: (me.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getXY(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }

  function continueDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    const { x, y } = getXY(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() { setIsDrawing(false); }

  function clearCanvas() {
    const c = drawCanvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  }

  // ─── Type → canvas ─────────────────────────────────────────
  useEffect(() => {
    const canvas = typeCanvasRef.current;
    if (!canvas || sigMode !== "type") return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!typedText) return;
    ctx.font = `52px ${FONTS[fontIdx].css}`;
    ctx.fillStyle = "#1e293b";
    ctx.textBaseline = "middle";
    ctx.fillText(typedText, 20, canvas.height / 2);
  }, [typedText, fontIdx, sigMode]);

  // ─── Proceed to placement ──────────────────────────────────
  function goToPlace(url: string) {
    setSigDataUrl(url);
    setSigPos({ x: 40, y: 40 });
    setSigSize({ w: 220, h: 80 });
    posRef.current = { x: 40, y: 40 };
    sizeRef.current = { w: 220, h: 80 };
    setConfirmed(false);
    setStep("place");
  }

  function useDrawnSig() {
    const c = drawCanvasRef.current;
    if (!c) return;
    goToPlace(c.toDataURL("image/png"));
  }

  function useTypedSig() {
    const c = typeCanvasRef.current;
    if (!c || !typedText.trim()) return;
    goToPlace(c.toDataURL("image/png"));
  }

  function onSigImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => goToPlace(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ─── Zero-lag drag & resize via DOM refs ──────────────────
  const clampPos = useCallback((x: number, y: number) => {
    const pw = previewRef.current?.clientWidth ?? 9999;
    const ph = canvasH || 9999;
    return {
      x: Math.max(0, Math.min(pw - sizeRef.current.w, x)),
      y: Math.max(0, Math.min(ph - sizeRef.current.h, y)),
    };
  }, [canvasH]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const el = sigElRef.current;
      if (!el) return;

      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.mx;
        const dy = e.clientY - dragRef.current.my;
        const pos = clampPos(dragRef.current.ox + dx, dragRef.current.oy + dy);
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
        posRef.current = pos;
      }

      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.mx;
        const dy = e.clientY - resizeRef.current.my;
        const corner = resizeRef.current.corner;
        let newW = resizeRef.current.ow;
        let newH = resizeRef.current.oh;
        let newX = resizeRef.current.ox;
        let newY = resizeRef.current.oy;

        if (corner === "br") { newW = Math.max(60, resizeRef.current.ow + dx); newH = Math.max(24, resizeRef.current.oh + dy); }
        if (corner === "bl") { newW = Math.max(60, resizeRef.current.ow - dx); newH = Math.max(24, resizeRef.current.oh + dy); newX = resizeRef.current.ox + dx; }
        if (corner === "tr") { newW = Math.max(60, resizeRef.current.ow + dx); newH = Math.max(24, resizeRef.current.oh - dy); newY = resizeRef.current.oy + dy; }
        if (corner === "tl") { newW = Math.max(60, resizeRef.current.ow - dx); newH = Math.max(24, resizeRef.current.oh - dy); newX = resizeRef.current.ox + dx; newY = resizeRef.current.oy + dy; }

        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        sizeRef.current = { w: newW, h: newH };
        posRef.current = { x: newX, y: newY };
      }
    }

    function onUp() {
      if (dragRef.current || resizeRef.current) {
        setSigPos({ ...posRef.current });
        setSigSize({ ...sizeRef.current });
      }
      dragRef.current = null;
      resizeRef.current = null;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [clampPos]);

  function onSigPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.resize) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mx: e.clientX, my: e.clientY, ox: posRef.current.x, oy: posRef.current.y };
  }

  function onCornerPointerDown(corner: ResizeCorner) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = {
        mx: e.clientX, my: e.clientY,
        ow: sizeRef.current.w, oh: sizeRef.current.h,
        ox: posRef.current.x, oy: posRef.current.y,
        corner,
      };
    };
  }

  // ─── Apply & download ──────────────────────────────────────
  async function applyAndDownload() {
    if (!pdfFile || !sigDataUrl || !pdfDoc) return;
    setBusy(true);
    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(pdfBytes);

      const res = await fetch(sigDataUrl);
      const imgBytes = new Uint8Array(await res.arrayBuffer());
      const sigImg = await doc.embedPng(imgBytes);

      // Get first page dimensions for scale reference
      const refPage = await pdfDoc.getPage(currentPage);
      const baseVp = refPage.getViewport({ scale: 1.0 });
      const pageWidthPt = baseVp.width;
      const pageHeightPt = baseVp.height;

      // Convert canvas-pixel position → PDF points
      const xPdf = posRef.current.x / renderScale;
      const wPdf = sizeRef.current.w / renderScale;
      const hPdf = sizeRef.current.h / renderScale;
      const yPdf = pageHeightPt - posRef.current.y / renderScale - hPdf;

      const indices = applyToAll
        ? Array.from({ length: doc.getPageCount() }, (_, i) => i)
        : [currentPage - 1];

      for (const i of indices) {
        doc.getPage(i).drawImage(sigImg, { x: xPdf, y: yPdf, width: wPdf, height: hPdf });
      }

      const out = await doc.save();
      const url = URL.createObjectURL(new Blob([out], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFile.name.replace(/\.pdf$/i, "-signed.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Sign error:", err);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPdfFile(null);
    setPdfDoc(null);
    setSigDataUrl(null);
    setTypedText("");
    setStep("upload");
    setZoom(1.0);
    clearCanvas();
    setConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Corner handle style
  const corner = (pos: string) =>
    `absolute w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-sm shadow ${pos} cursor-${pos.includes("br") || pos.includes("tl") ? "nwse" : "nesw"}-resize z-10`;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-14 z-20 bg-background">
        <Link href="/pdf">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        </Link>
        <PenLine className="w-5 h-5 text-indigo-500" />
        <h1 className="font-semibold text-foreground">Add Signature</h1>
        {pdfFile && (
          <button onClick={reset} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title="Start over">
            <RefreshCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step bar */}
      {step !== "upload" && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 text-xs">
          {[
            { key: "signature", label: "1. Create Signature" },
            { key: "place", label: "2. Position & Download" },
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <div className={`flex items-center gap-1.5 font-medium ${step === s.key ? "text-indigo-600" : "text-muted-foreground"}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.key ? "bg-indigo-600 text-white" : "bg-muted-foreground/20 text-muted-foreground"}`}>{i + 1}</span>
                {s.label.slice(3)}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className={`mx-auto px-4 py-8 ${step === "place" ? "max-w-4xl" : "max-w-2xl"}`}>

        {/* ── STEP 1: Upload ─────────────────────────────────── */}
        {step === "upload" && (
          <>
            <div
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-5 cursor-pointer transition-colors ${isDraggingOver ? "border-indigo-400 bg-indigo-50/60" : "border-border hover:border-indigo-300 hover:bg-indigo-50/30"}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); const f = e.dataTransfer.files[0]; if (f) loadPdf(f); }}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <FileUp className="w-8 h-8 text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground mb-1">Drop a PDF here or click to upload</p>
                <p className="text-sm text-muted-foreground">PDF files only</p>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <FileUp className="w-4 h-4" /> Choose PDF
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPdf(f); }} />
          </>
        )}

        {/* ── STEP 2: Create Signature ────────────────────────── */}
        {step === "signature" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
              <PenLine className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-medium text-foreground truncate">{pdfFile?.name}</span>
              <span className="text-muted-foreground shrink-0">· {pageCount} page{pageCount !== 1 ? "s" : ""}</span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              {(["draw", "type", "upload"] as SigMode[]).map((m) => {
                const labels = { draw: "Draw", type: "Type", upload: "Upload" };
                const Icons = { draw: PenLine, type: Type, upload: ImageIcon };
                const Icon = Icons[m];
                return (
                  <button key={m} onClick={() => setSigMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all ${sigMode === m ? "bg-white shadow text-indigo-600" : "text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="w-3.5 h-3.5" />{labels[m]}
                  </button>
                );
              })}
            </div>

            {/* Draw */}
            {sigMode === "draw" && (
              <div className="space-y-3">
                <div className="border-2 border-border rounded-xl overflow-hidden bg-white shadow-sm">
                  <canvas ref={drawCanvasRef} width={560} height={180}
                    className="w-full touch-none cursor-crosshair block"
                    onMouseDown={startDraw} onMouseMove={continueDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={continueDraw} onTouchEnd={endDraw} />
                  <div className="mx-6 border-t-2 border-dashed border-slate-200 -mt-px" />
                  <p className="text-xs text-center text-muted-foreground py-2.5">Draw your signature above the line</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Clear
                  </Button>
                  <Button onClick={useDrawnSig} className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                    Use Signature <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Type */}
            {sigMode === "type" && (
              <div className="space-y-3">
                <input type="text" value={typedText} onChange={(e) => setTypedText(e.target.value)}
                  placeholder="Type your name…"
                  className="w-full border border-border rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
                <div className="flex gap-2 flex-wrap">
                  {FONTS.map((f, i) => (
                    <button key={i} onClick={() => setFontIdx(i)} style={{ fontFamily: f.css }}
                      className={`px-4 py-2 rounded-lg border text-lg transition-all ${fontIdx === i ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm" : "border-border hover:border-indigo-200 bg-white"}`}>
                      {typedText || "Signature"}
                    </button>
                  ))}
                </div>
                <div className="border-2 border-border rounded-xl overflow-hidden bg-white shadow-sm">
                  <canvas ref={typeCanvasRef} width={560} height={100} className="w-full block" />
                </div>
                <Button onClick={useTypedSig} disabled={!typedText.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 w-full">
                  Use Signature <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Upload image */}
            {sigMode === "upload" && (
              <>
                <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                  onClick={() => sigInputRef.current?.click()}>
                  <ImageIcon className="w-10 h-10 text-indigo-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground mb-0.5">Click to upload signature image</p>
                    <p className="text-xs text-muted-foreground">PNG with transparent background works best</p>
                  </div>
                </div>
                <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={onSigImageChange} />
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Place & Download ────────────────────────── */}
        {step === "place" && sigDataUrl && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-white disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium px-2 min-w-[70px] text-center">
                  {currentPage} / {pageCount}
                </span>
                <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
                  className="p-1.5 rounded hover:bg-white disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded hover:bg-white transition-colors">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium px-2 min-w-[46px] text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded hover:bg-white transition-colors">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setStep("signature")} className="text-xs text-indigo-600 hover:underline ml-auto flex items-center gap-1">
                <PenLine className="w-3.5 h-3.5" /> Change Signature
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Drag</span> to position ·{" "}
              <span className="font-medium text-foreground">Corner handles</span> to resize
            </p>

            {/* Page canvas + signature overlay */}
            <div className="relative overflow-auto rounded-xl border-2 border-border shadow-lg bg-slate-100"
              style={{ maxHeight: "70vh" }}>
              <div ref={previewRef} className="relative inline-block" style={{ minWidth: "100%" }}>

                {/* Rendered PDF page */}
                <canvas ref={pageCanvasRef} className="block w-full select-none" style={{ display: "block" }} />

                {/* Loading overlay */}
                {rendering && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                )}

                {/* Draggable resizable signature */}
                {!rendering && (
                  <div
                    ref={sigElRef}
                    className="absolute select-none cursor-grab active:cursor-grabbing"
                    style={{
                      left: sigPos.x, top: sigPos.y,
                      width: sigSize.w, height: sigSize.h,
                      touchAction: "none",
                    }}
                    onPointerDown={onSigPointerDown}
                  >
                    {/* Signature image */}
                    <img src={sigDataUrl} alt="sig" draggable={false}
                      className="w-full h-full object-contain pointer-events-none"
                      style={{ filter: confirmed ? "none" : "drop-shadow(0 2px 4px rgba(99,102,241,0.4))" }} />

                    {/* Border while not confirmed */}
                    {!confirmed && (
                      <div className="absolute inset-0 border-2 border-dashed border-indigo-400 rounded pointer-events-none" />
                    )}

                    {/* Resize corners */}
                    {!confirmed && (
                      <>
                        <div className={`${corner("-top-1.5 -left-1.5")} cursor-nwse-resize`} data-resize="tl" onPointerDown={onCornerPointerDown("tl")} />
                        <div className={`${corner("-top-1.5 -right-1.5")} cursor-nesw-resize`} data-resize="tr" onPointerDown={onCornerPointerDown("tr")} />
                        <div className={`${corner("-bottom-1.5 -left-1.5")} cursor-nesw-resize`} data-resize="bl" onPointerDown={onCornerPointerDown("bl")} />
                        <div className={`${corner("-bottom-1.5 -right-1.5")} cursor-nwse-resize`} data-resize="br" onPointerDown={onCornerPointerDown("br")} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!confirmed ? (
                <Button onClick={() => setConfirmed(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1">
                  <Check className="w-4 h-4" /> Confirm Position
                </Button>
              ) : (
                <div className="flex gap-2 items-center flex-1 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2">
                  <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-sm text-indigo-700 font-medium">Position confirmed</span>
                  <button onClick={() => setConfirmed(false)} className="ml-auto text-xs text-indigo-500 hover:underline">Edit</button>
                </div>
              )}

              <Button onClick={applyAndDownload} disabled={busy || !confirmed} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 disabled:opacity-50">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</> : <><Download className="w-4 h-4" /> Download Signed PDF</>}
              </Button>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
              <span className="text-sm text-foreground">Apply signature to all {pageCount} page{pageCount !== 1 ? "s" : ""}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
