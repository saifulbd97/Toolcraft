import { useCallback, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, ImageIcon, Loader2, RefreshCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "preview" | "processing" | "done" | "error";

export default function BgRemover() {
  const [stage, setStage] = useState<Stage>("idle");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrMsg("Please upload an image file — JPG, PNG, or WebP.");
      return;
    }
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setResultUrl(null);
    setErrMsg(null);
    setProgress(0);
    setStage("preview");
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const removeBg = useCallback(async () => {
    if (!originalUrl) return;
    setStage("processing");
    setProgress(0);
    setErrMsg(null);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const resp = await fetch(originalUrl);
      const blob = await resp.blob();
      const resultBlob = await removeBackground(blob, {
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) setProgress(Math.round((current / total) * 100));
        },
      });
      const url = URL.createObjectURL(resultBlob);
      setResultUrl(url);
      setStage("done");
    } catch (e: any) {
      console.error("[BgRemover]", e);
      setErrMsg("Background removal failed. Please try a different image or reload the page.");
      setStage("error");
    }
  }, [originalUrl]);

  const downloadPng = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `bg-removed-${Date.now()}.png`;
    a.click();
  };

  const reset = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setOriginalUrl(null);
    setResultUrl(null);
    setStage("idle");
    setProgress(0);
    setErrMsg(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Sub-header */}
      <div className="sticky top-14 z-40 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-white/90 backdrop-blur">
        <Link href="/">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />Back
          </button>
        </Link>
        <div className="h-4 w-px bg-border" />
        <ImageIcon className="w-4 h-4 text-violet-500" />
        <span className="font-semibold text-sm">Background Remover</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Error */}
        {errMsg && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <X className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errMsg}</span>
          </div>
        )}

        {/* ── IDLE: drop zone ── */}
        {(stage === "idle" || stage === "error") && (
          <div
            onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-14 cursor-pointer transition-colors ${
              draggingOver
                ? "border-violet-400 bg-violet-50"
                : "border-border bg-muted/30 hover:border-violet-300 hover:bg-violet-50/50"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Upload className="w-8 h-8 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Drop an image here</p>
              <p className="text-sm text-muted-foreground mt-1">JPG, PNG, or WebP — or click to browse</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        )}

        {/* ── PREVIEW: show image + Remove button ── */}
        {stage === "preview" && originalUrl && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-[url('/checkerboard.svg')] bg-repeat">
              <img src={originalUrl} alt="Original" className="w-full h-auto block max-h-[60vh] object-contain" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="gap-2">
                <RefreshCcw className="w-4 h-4" />Change
              </Button>
              <Button onClick={removeBg} className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700">
                <ImageIcon className="w-4 h-4" />Remove Background
              </Button>
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {stage === "processing" && (
          <div className="space-y-5">
            {/* Thumbnail of original while processing */}
            {originalUrl && (
              <div className="rounded-2xl overflow-hidden border border-border shadow-sm opacity-50">
                <img src={originalUrl} alt="Processing" className="w-full h-auto block max-h-[60vh] object-contain" />
              </div>
            )}
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-violet-600 animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-violet-700">Removing background…</p>
                  <p className="text-xs text-violet-500 mt-0.5">
                    {progress === 0
                      ? "Loading AI model (first run may take ~30 s)…"
                      : `Processing — ${progress}%`}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-violet-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── DONE: show side-by-side comparison + download ── */}
        {stage === "done" && resultUrl && (
          <div className="space-y-5">
            {/* Comparison: original vs result */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-center text-muted-foreground">Original</p>
                <div className="rounded-xl overflow-hidden border border-border">
                  {originalUrl && <img src={originalUrl} alt="Original" className="w-full h-auto block" />}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-center text-muted-foreground">Background removed</p>
                {/* Checkerboard via inline CSS gradient to show transparency */}
                <div
                  className="rounded-xl overflow-hidden border border-border"
                  style={{
                    background:
                      "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 16px 16px",
                  }}
                >
                  <img src={resultUrl} alt="Result" className="w-full h-auto block" />
                </div>
              </div>
            </div>

            {/* Large result preview */}
            <div
              className="rounded-2xl overflow-hidden border border-border shadow-sm w-full"
              style={{
                background:
                  "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 16px 16px",
              }}
            >
              <img src={resultUrl} alt="Full result" className="w-full h-auto block max-h-[60vh] object-contain" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="gap-2">
                <RefreshCcw className="w-4 h-4" />New Image
              </Button>
              <Button onClick={downloadPng} className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700">
                <Download className="w-4 h-4" />Download PNG
              </Button>
            </div>
          </div>
        )}

        {/* Info footer */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          Processing happens entirely in your browser — your image is never uploaded to any server.
        </p>
      </div>
    </div>
  );
}
