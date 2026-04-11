import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, ImageIcon, Loader2, RefreshCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BgRemover() {
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setOriginal(null);
    setResult(null);
    setErr(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErr("Please select an image file.");
      return;
    }
    setErr(null);
    setResult(null);
    setBusy(true);

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setOriginal(base64);
      try {
        const res = await fetch("/api/bg-remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        const data = await res.json() as { image?: string; error?: string };
        if (!res.ok || data.error) {
          setErr(data.error ?? "Failed to remove background. Please try again.");
        } else if (data.image) {
          setResult(data.image);
        }
      } catch {
        setErr("Network error. Please check your connection and try again.");
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => { setBusy(false); setErr("Could not read the file."); };
    reader.readAsDataURL(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "background-removed.png";
    a.click();
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-14 z-10">
        <Link href="/">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <Wand2 className="w-5 h-5 text-violet-500" />
        <h1 className="font-semibold text-foreground">Background Remover</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Upload area — shown when no image selected */}
        {!original && (
          <div
            className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center gap-5 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground mb-1">Drop an image here or click to upload</p>
              <p className="text-sm text-muted-foreground">JPG, PNG, WEBP — up to 12 MB</p>
            </div>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <ImageIcon className="w-4 h-4" /> Choose Image
            </Button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {/* Error banner */}
        {err && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {err}
          </div>
        )}

        {/* Processing state */}
        {original && busy && (
          <div className="mt-8 flex flex-col items-center gap-5">
            <img src={original} alt="original" className="max-h-64 rounded-xl object-contain shadow" />
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 text-violet-700 px-5 py-3 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Removing background…</span>
            </div>
          </div>
        )}

        {/* Result */}
        {original && !busy && result && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Original */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original</p>
                </div>
                <div className="p-3 bg-white">
                  <img src={original} alt="original" className="w-full max-h-64 object-contain rounded-lg" />
                </div>
              </div>
              {/* Result */}
              <div className="rounded-2xl border border-violet-200 overflow-hidden">
                <div className="bg-violet-50 px-4 py-2 border-b border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Background Removed</p>
                </div>
                <div className="p-3" style={{
                  background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 16px 16px"
                }}>
                  <img src={result} alt="result" className="w-full max-h-64 object-contain rounded-lg" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={download} className="bg-violet-600 hover:bg-violet-700 text-white gap-2 px-6">
                <Download className="w-4 h-4" /> Download PNG
              </Button>
              <Button variant="outline" onClick={reset} className="gap-2 px-6">
                <RefreshCcw className="w-4 h-4" /> Try Another
              </Button>
            </div>
          </div>
        )}

        {/* Original shown but no result yet and not busy (error case) */}
        {original && !busy && !result && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <img src={original} alt="original" className="max-h-48 rounded-xl object-contain shadow opacity-60" />
            <Button variant="outline" onClick={reset} className="gap-2">
              <RefreshCcw className="w-4 h-4" /> Try a Different Image
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
