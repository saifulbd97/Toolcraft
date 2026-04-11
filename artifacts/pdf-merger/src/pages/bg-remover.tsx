import { useCallback, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, Wand2, Upload, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "processing" | "done" | "error";

export default function BgRemover() {
  const [stage, setStage] = useState<Stage>("idle");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP)."); return;
    }
    setOriginalUrl(URL.createObjectURL(file));
    setResultUrl(null);
    setError(null);
    setStage("processing");

    const body = new FormData();
    body.append("image", file);

    try {
      const res = await fetch("/api/bg-remove", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setStage("done");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
      setStage("error");
    }
  }, []);

  const onFiles = useCallback((files: FileList | null) => {
    if (files?.[0]) processFile(files[0]);
  }, [processFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const reset = () => {
    setStage("idle"); setOriginalUrl(null); setResultUrl(null); setError(null);
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `bg-removed-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-14 z-40 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-white/90 backdrop-blur">
        <Link href="/">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </Link>
        <div className="h-4 w-px bg-border" />
        <Wand2 className="w-4 h-4 text-violet-500" />
        <span className="font-semibold text-sm">Background Remover</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Upload zone */}
        {stage === "idle" && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-colors py-16 px-6 text-center
              ${dragging ? "border-violet-400 bg-violet-50" : "border-border hover:border-violet-300 hover:bg-violet-50/40"}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Upload className="w-8 h-8 text-violet-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Drop an image here</p>
              <p className="text-sm text-muted-foreground mt-1">JPG, PNG, or WebP — or click to browse</p>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={e => onFiles(e.target.files)} />
          </div>
        )}

        {/* Processing */}
        {stage === "processing" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center animate-pulse">
              <Wand2 className="w-7 h-7 text-violet-500" />
            </div>
            <p className="text-sm text-muted-foreground">Removing background…</p>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive text-center max-w-sm">
              {error}
            </div>
            <Button variant="outline" onClick={reset} className="gap-2">
              <RefreshCcw className="w-4 h-4" /> Try Again
            </Button>
          </div>
        )}

        {/* Result */}
        {stage === "done" && resultUrl && originalUrl && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original</p>
                <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                  <img src={originalUrl} alt="original" className="w-full h-auto object-contain max-h-72" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Result</p>
                <div className="rounded-xl overflow-hidden border border-border"
                  style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 16px 16px" }}>
                  <img src={resultUrl} alt="result" className="w-full h-auto object-contain max-h-72" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={download} className="gap-2 bg-violet-600 hover:bg-violet-700">
                <Download className="w-4 h-4" /> Download PNG
              </Button>
              <Button variant="outline" onClick={reset} className="gap-2">
                <RefreshCcw className="w-4 h-4" /> Remove Another
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Powered by <a href="https://www.remove.bg" target="_blank" rel="noopener noreferrer"
            className="underline hover:text-foreground">remove.bg</a> — processed securely on the server
        </p>
      </div>
    </div>
  );
}
