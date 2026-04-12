import React, { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Download, FileUp, PenLine, Type, ImageIcon,
  RefreshCcw, Loader2, ChevronRight, RotateCcw, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";

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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ w: 612, h: 792 }); // PDF points
  const [pageCount, setPageCount] = useState(1);
  const [sigMode, setSigMode] = useState<SigMode>("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [fontIdx, setFontIdx] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  // Signature placement — committed state (CSS pixels)
  const [sigPos, setSigPos] = useState({ x: 40, y: 40 });
  const [sigSize, setSigSize] = useState({ w: 200, h: 72 });

  // Refs for zero-lag DOM drag (no React re-render during move)
  const sigElRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ mx: number; my: number; ow: number; oh: number; corner: ResizeCorner; ox: number; oy: number } | null>(null);
  const posRef = useRef({ x: 40, y: 40 });
  const sizeRef = useRef({ w: 200, h: 72 });
  const containerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Keep refs in sync with committed state
  useEffect(() => { posRef.current = sigPos; }, [sigPos]);
  useEffect(() => { sizeRef.current = sigSize; }, [sigSize]);

  // Revoke blob URL on cleanup
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  // ─── Upload PDF ────────────────────────────────────────────
  async function loadPdf(file: File) {
    if (file.type !== "application/pdf") return;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const url = URL.createObjectURL(file);
    setPdfFile(file);
    setPdfUrl(url);

    // Read page dimensions and count with pdf-lib
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const page = doc.getPage(0);
      const { width, height } = page.getSize();
      setPageSize({ w: width, h: height });
      setPageCount(doc.getPageCount());
    } catch { /* use defaults */ }

    setSigDataUrl(null);
    setTypedText("");
    setConfirmed(false);
    setStep("signature");
  }

  // ─── Draw signature ────────────────────────────────────────
  function getXY(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    const me = e as React.MouseEvent;
    return { x: (me.clientX - rect.left) * sx, y: (me.clientY - rect.top) * sy };
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

  // ─── Advance to placement ──────────────────────────────────
  function goToPlace(url: string) {
    setSigDataUrl(url);
    const pos = { x: 40, y: 40 };
    const size = { w: 200, h: 72 };
    setSigPos(pos);
    setSigSize(size);
    posRef.current = pos;
    sizeRef.current = size;
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

  // ─── Zero-lag drag & resize (direct DOM, no React re-renders) ──
  const getContainerH = useCallback(() => containerRef.current?.clientHeight ?? 600, []);
  const getContainerW = useCallback(() => containerRef.current?.clientWidth ?? 400, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const el = sigElRef.current;
      if (!el) return;

      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.mx;
        const dy = e.clientY - dragRef.current.my;
        const maxX = getContainerW() - sizeRef.current.w;
        const maxY = getContainerH() - sizeRef.current.h;
        const x = Math.max(0, Math.min(maxX, dragRef.current.ox + dx));
        const y = Math.max(0, Math.min(maxY, dragRef.current.oy + dy));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        posRef.current = { x, y };
      }

      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.mx;
        const dy = e.clientY - resizeRef.current.my;
        const c = resizeRef.current.corner;
        let w = resizeRef.current.ow, h = resizeRef.current.oh;
        let x = resizeRef.current.ox, y = resizeRef.current.oy;

        if (c === "br") { w = Math.max(60, w + dx); h = Math.max(24, h + dy); }
        if (c === "bl") { w = Math.max(60, w - dx); h = Math.max(24, h + dy); x = resizeRef.current.ox + resizeRef.current.ow - w; }
        if (c === "tr") { w = Math.max(60, w + dx); h = Math.max(24, h - dy); y = resizeRef.current.oy + resizeRef.current.oh - h; }
        if (c === "tl") { w = Math.max(60, w - dx); h = Math.max(24, h - dy); x = resizeRef.current.ox + resizeRef.current.ow - w; y = resizeRef.current.oy + resizeRef.current.oh - h; }

        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        sizeRef.current = { w, h };
        posRef.current = { x, y };
      }
    }

    function onUp() {
      if (dragRef.current || resizeRef.current) {
        setSigPos({ ...posRef.current });
        setSigSize({ ...sizeRef.current });
        // Re-enable iframe pointer events
        if (iframeRef.current) iframeRef.current.style.pointerEvents = "auto";
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
  }, [getContainerW, getContainerH]);

  function onSigPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.resize) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // Disable iframe pointer events while dragging to prevent capture
    if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";
    dragRef.current = { mx: e.clientX, my: e.clientY, ox: posRef.current.x, oy: posRef.current.y };
  }

  function onCornerDown(corner: ResizeCorner) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";
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
    if (!pdfFile || !sigDataUrl) return;
    setBusy(true);
    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(pdfBytes);

      const imgRes = await fetch(sigDataUrl);
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
      const sigImg = await doc.embedPng(imgBytes);

      const cw = getContainerW();
      const ch = getContainerH();

      // Map CSS px → PDF points
      const xPdf = (posRef.current.x / cw) * pageSize.w;
      const wPdf = (sizeRef.current.w / cw) * pageSize.w;
      const hPdf = (sizeRef.current.h / ch) * pageSize.h;
      const yPdf = pageSize.h - (posRef.current.y / ch) * pageSize.h - hPdf;

      const indices = applyToAll
        ? Array.from({ length: doc.getPageCount() }, (_, i) => i)
        : [0];

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
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfFile(null);
    setPdfUrl(null);
    setSigDataUrl(null);
    setTypedText("");
    setStep("upload");
    setConfirmed(false);
    clearCanvas();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Container height proportional to PDF page aspect ratio
  const aspectPct = (pageSize.h / pageSize.w) * 100;

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
          <button onClick={reset} className="ml-auto p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <RefreshCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step bar */}
      {step !== "upload" && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 text-xs">
          {[{ key: "signature", label: "Create Signature" }, { key: "place", label: "Position & Download" }].map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <div className={`flex items-center gap-1.5 font-medium ${step === s.key ? "text-indigo-600" : "text-muted-foreground"}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.key ? "bg-indigo-600 text-white" : "bg-muted-foreground/20"}`}>{i + 1}</span>
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className={`mx-auto px-4 py-8 ${step === "place" ? "max-w-4xl" : "max-w-2xl"}`}>

        {/* ── Upload ──────────────────────────────────────────── */}
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

        {/* ── Create Signature ──────────────────────────────── */}
        {step === "signature" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
              <PenLine className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-medium text-foreground truncate">{pdfFile?.name}</span>
              <span className="text-muted-foreground shrink-0">· {pageCount} page{pageCount !== 1 ? "s" : ""}</span>
            </div>

            {/* Mode tabs */}
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
                    onMouseDown={startDraw} onMouseMove={continueDraw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}
                    onTouchStart={startDraw} onTouchMove={continueDraw} onTouchEnd={() => setIsDrawing(false)} />
                  <div className="mx-6 border-t-2 border-dashed border-slate-200" />
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

            {/* Upload */}
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

        {/* ── Place & Download ──────────────────────────────── */}
        {step === "place" && sigDataUrl && pdfUrl && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground flex-1">
                <span className="font-medium text-foreground">Drag</span> to position ·{" "}
                <span className="font-medium text-foreground">Corner handles</span> to resize
              </p>
              <button onClick={() => setStep("signature")} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                <PenLine className="w-3.5 h-3.5" /> Change Signature
              </button>
            </div>

            {/* PDF iframe + signature overlay */}
            <div className="rounded-xl border-2 border-border shadow-lg overflow-hidden bg-white">
              {/* Sized to PDF page aspect ratio */}
              <div ref={containerRef} className="relative w-full" style={{ paddingBottom: `${Math.min(aspectPct, 130)}%` }}>
                {/* PDF preview via iframe */}
                <iframe
                  ref={iframeRef}
                  src={pdfUrl}
                  className="absolute inset-0 w-full h-full"
                  title="PDF Preview"
                  style={{ border: "none" }}
                />

                {/* Draggable resizable signature */}
                <div
                  ref={sigElRef}
                  className="absolute select-none z-10"
                  style={{
                    left: sigPos.x, top: sigPos.y,
                    width: sigSize.w, height: sigSize.h,
                    cursor: confirmed ? "default" : "grab",
                    touchAction: "none",
                  }}
                  onPointerDown={confirmed ? undefined : onSigPointerDown}
                >
                  <img src={sigDataUrl} alt="signature" draggable={false}
                    className="w-full h-full object-contain pointer-events-none" />

                  {!confirmed && (
                    <>
                      <div className="absolute inset-0 border-2 border-dashed border-indigo-400 rounded pointer-events-none" />
                      {/* 4 corner resize handles */}
                      {(["tl", "tr", "bl", "br"] as ResizeCorner[]).map((c) => (
                        <div key={c!} data-resize={c}
                          className={`absolute w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-sm shadow z-20
                            ${c === "tl" ? "-top-1.5 -left-1.5 cursor-nwse-resize" : ""}
                            ${c === "tr" ? "-top-1.5 -right-1.5 cursor-nesw-resize" : ""}
                            ${c === "bl" ? "-bottom-1.5 -left-1.5 cursor-nesw-resize" : ""}
                            ${c === "br" ? "-bottom-1.5 -right-1.5 cursor-nwse-resize" : ""}`}
                          onPointerDown={onCornerDown(c)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!confirmed ? (
                <Button onClick={() => setConfirmed(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1">
                  <Check className="w-4 h-4" /> Confirm Position
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-1 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2">
                  <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-sm text-indigo-700 font-medium">Position confirmed</span>
                  <button onClick={() => setConfirmed(false)} className="ml-auto text-xs text-indigo-500 hover:underline">Edit</button>
                </div>
              )}
              <Button onClick={applyAndDownload} disabled={busy || !confirmed}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 disabled:opacity-50">
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                  : <><Download className="w-4 h-4" /> Download Signed PDF</>}
              </Button>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded" />
              <span className="text-sm text-foreground">
                Apply to all {pageCount} page{pageCount !== 1 ? "s" : ""}
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
