import React, { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Download, FileUp, PenLine, Type, ImageIcon,
  RefreshCcw, Loader2, ChevronRight, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";

type Step = "upload" | "signature" | "place";
type SigMode = "draw" | "type" | "upload";

const FONTS = [
  { label: "Cursive", css: "'Segoe Script', 'Bradley Hand', cursive" },
  { label: "Print", css: "system-ui, sans-serif" },
  { label: "Mono", css: "ui-monospace, monospace" },
];

export default function PdfSign() {
  const [step, setStep] = useState<Step>("upload");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ pages: number; width: number; height: number } | null>(null);
  const [sigMode, setSigMode] = useState<SigMode>("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [fontIdx, setFontIdx] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);

  // Placement
  const [sigPos, setSigPos] = useState({ x: 60, y: 60 });
  const [sigSize, setSigSize] = useState({ w: 220, h: 80 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, ox: 0, oy: 0 });
  const [resizeStart, setResizeStart] = useState({ mx: 0, my: 0, ow: 0, oh: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ─── Upload PDF ────────────────────────────────────────────
  async function loadPdf(file: File) {
    if (file.type !== "application/pdf") return;
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    setPdfFile(file);
    setPdfInfo({ pages: doc.getPageCount(), width, height });
    setStep("signature");
    setSigDataUrl(null);
    setTypedText("");
  }

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
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
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
  function useDrawnSig() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    setSigDataUrl(canvas.toDataURL("image/png"));
    goToPlace();
  }

  function useTypedSig() {
    const canvas = typeCanvasRef.current;
    if (!canvas || !typedText.trim()) return;
    setSigDataUrl(canvas.toDataURL("image/png"));
    goToPlace();
  }

  function onSigImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setSigDataUrl(reader.result as string); goToPlace(); };
    reader.readAsDataURL(file);
  }

  function goToPlace() {
    setSigPos({ x: 60, y: 60 });
    setSigSize({ w: 220, h: 80 });
    setStep("place");
  }

  // ─── Drag & resize ─────────────────────────────────────────
  const onSigPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setDragStart({ mx: e.clientX, my: e.clientY, ox: sigPos.x, oy: sigPos.y });
  }, [sigPos]);

  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setResizing(true);
    setResizeStart({ mx: e.clientX, my: e.clientY, ow: sigSize.w, oh: sigSize.h });
  }, [sigSize]);

  useEffect(() => {
    if (!dragging && !resizing) return;
    function onMove(e: PointerEvent) {
      const dx = e.clientX - (dragging ? dragStart.mx : resizeStart.mx);
      const dy = e.clientY - (dragging ? dragStart.my : resizeStart.my);
      if (dragging) {
        const preview = previewRef.current;
        if (!preview) return;
        setSigPos({
          x: Math.max(0, Math.min(preview.clientWidth - sigSize.w, dragStart.ox + dx)),
          y: Math.max(0, Math.min(preview.clientHeight - sigSize.h, dragStart.oy + dy)),
        });
      }
      if (resizing) {
        setSigSize({ w: Math.max(60, resizeStart.ow + dx), h: Math.max(24, resizeStart.oh + dy) });
      }
    }
    function onUp() { setDragging(false); setResizing(false); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragging, resizing, dragStart, resizeStart, sigSize.w, sigSize.h]);

  // ─── Apply & download ──────────────────────────────────────
  async function applyAndDownload() {
    if (!pdfFile || !sigDataUrl || !pdfInfo) return;
    setBusy(true);
    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(pdfBytes);

      const res = await fetch(sigDataUrl);
      const imgBytes = new Uint8Array(await res.arrayBuffer());
      const sigImg = await doc.embedPng(imgBytes);

      const preview = previewRef.current;
      if (!preview) return;
      const pw = preview.clientWidth;
      const ph = preview.clientHeight;

      const xPdf = (sigPos.x / pw) * pdfInfo.width;
      const wPdf = (sigSize.w / pw) * pdfInfo.width;
      const hPdf = (sigSize.h / ph) * pdfInfo.height;
      const yPdf = pdfInfo.height - (sigPos.y / ph) * pdfInfo.height - hPdf;

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
      console.error("Sign failed:", err);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPdfFile(null);
    setPdfInfo(null);
    setSigDataUrl(null);
    setTypedText("");
    setStep("upload");
    clearCanvas();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const previewAspect = pdfInfo ? pdfInfo.height / pdfInfo.width : 1.414;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-14 z-10 bg-background">
        <Link href="/pdf">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <PenLine className="w-5 h-5 text-indigo-500" />
        <h1 className="font-semibold text-foreground">Add Signature</h1>
        {pdfFile && (
          <button onClick={reset} className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Start over">
            <RefreshCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step bar */}
      {step !== "upload" && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 text-xs">
          <div className={`flex items-center gap-1.5 font-medium ${step === "signature" ? "text-indigo-600" : "text-muted-foreground"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === "signature" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>1</span>
            Create Signature
          </div>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 font-medium ${step === "place" ? "text-indigo-600" : "text-muted-foreground"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === "place" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>2</span>
            Position & Download
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">

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
            {/* PDF info */}
            <div className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
              <PenLine className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-medium text-foreground truncate">{pdfFile?.name}</span>
              <span className="text-muted-foreground shrink-0">· {pdfInfo?.pages} page{pdfInfo?.pages !== 1 ? "s" : ""}</span>
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
                <div className="border-2 border-border rounded-xl overflow-hidden bg-white">
                  <canvas ref={drawCanvasRef} width={560} height={180} className="w-full touch-none cursor-crosshair block"
                    onMouseDown={startDraw} onMouseMove={continueDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={continueDraw} onTouchEnd={endDraw} />
                  <div className="mx-6 border-t border-dashed border-slate-200" />
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
                <div className="border-2 border-border rounded-xl overflow-hidden bg-white">
                  <canvas ref={typeCanvasRef} width={560} height={100} className="w-full block" />
                </div>
                <Button onClick={useTypedSig} disabled={!typedText.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 w-full">
                  Use Signature <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Upload */}
            {sigMode === "upload" && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                  onClick={() => sigInputRef.current?.click()}>
                  <ImageIcon className="w-10 h-10 text-indigo-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground mb-0.5">Click to upload signature image</p>
                    <p className="text-xs text-muted-foreground">PNG with transparent background works best</p>
                  </div>
                </div>
                <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={onSigImageChange} />
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Place & Download ────────────────────────── */}
        {step === "place" && sigDataUrl && pdfInfo && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Drag</span> the signature to position it.{" "}
              <span className="font-medium text-foreground">Drag the blue corner</span> to resize it.
            </p>

            {/* Page preview */}
            <div ref={previewRef}
              className="relative bg-white border-2 border-border rounded-xl shadow-sm overflow-hidden mx-auto select-none"
              style={{ width: "100%", paddingBottom: `${Math.min(previewAspect, 1.6) * 100}%` }}>

              {/* Page placeholder background */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-4/5 h-2 rounded bg-slate-200 mb-3" style={{ width: `${65 + (i % 3) * 10}%` }} />
                ))}
              </div>
              <div className="absolute bottom-3 right-4 text-[10px] text-muted-foreground pointer-events-none opacity-50">
                Page 1 of {pdfInfo.pages}
              </div>

              {/* Draggable signature */}
              <div
                className="absolute border-2 border-indigo-400 border-dashed rounded-lg cursor-grab active:cursor-grabbing shadow-md"
                style={{ left: sigPos.x, top: sigPos.y, width: sigSize.w, height: sigSize.h }}
                onPointerDown={onSigPointerDown}
              >
                <img src={sigDataUrl} alt="signature" className="w-full h-full object-contain pointer-events-none" />
                {/* Resize handle */}
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-500 rounded-sm cursor-se-resize shadow"
                  onPointerDown={onResizePointerDown}
                />
              </div>
            </div>

            {/* Apply to all */}
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded" />
              <span className="text-sm text-foreground">
                Apply to all {pdfInfo.pages} page{pdfInfo.pages !== 1 ? "s" : ""}
              </span>
            </label>

            <div className="flex gap-3 flex-wrap">
              <Button onClick={applyAndDownload} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1 min-w-[180px]">
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                  : <><Download className="w-4 h-4" /> Download Signed PDF</>}
              </Button>
              <Button variant="outline" onClick={() => setStep("signature")} className="gap-2">
                <PenLine className="w-4 h-4" /> Change Signature
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
