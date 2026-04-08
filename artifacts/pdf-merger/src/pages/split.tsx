import React, { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { FileUp, File as FileIcon, Scissors, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

type Mode = "all" | "range";

export default function Split() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("all");
  const [fromPage, setFromPage] = useState("1");
  const [toPage, setToPage] = useState("1");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file type", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    setFile(f);
    setIsSuccess(false);
    setError(null);
    setPageCount(null);
    setMode("all");

    setIsLoadingInfo(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/pdf/info", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Could not read PDF");
      const data = await res.json();
      setPageCount(data.pageCount);
      setFromPage("1");
      setToPage(String(data.pageCount));
    } catch {
      setError("Could not read the PDF. Please try a different file.");
    } finally {
      setIsLoadingInfo(false);
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [loadFile]);

  const handleSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setIsSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (mode === "range") {
        formData.append("from", fromPage);
        formData.append("to", toPage);
      }

      const response = await fetch("/api/pdf/split", { method: "POST", body: formData });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to split PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = mode === "range" ? `pages-${fromPage}-to-${toPage}.pdf` : "split-pages.zip";
      a.click();
      URL.revokeObjectURL(url);

      setIsSuccess(true);
      const desc = mode === "all"
        ? `All ${pageCount} pages saved as individual PDFs in a ZIP file.`
        : `Pages ${fromPage}–${toPage} extracted as a PDF.`;
      toast({ title: "Done!", description: desc });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
      toast({ title: "Split failed", description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => { setFile(null); setPageCount(null); setIsSuccess(false); setError(null); };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home"><ArrowLeft className="w-4 h-4" />All tools</Button></Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Split PDF</h1>
          <p className="text-muted-foreground text-lg">Split into individual pages or extract a custom page range.</p>
        </div>

        {!file ? (
          <Card
            className={cn("p-8 border-2 border-dashed transition-colors duration-200 cursor-pointer group",
              isDragging ? "border-purple-400 bg-purple-50/50" : "border-border hover:border-purple-300 hover:bg-muted/50"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="upload-zone"
          >
            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileInput} data-testid="input-file" />
            <div className="flex flex-col items-center justify-center space-y-4 text-center pointer-events-none">
              <div className="h-16 w-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-200">
                <FileUp className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">Drag & drop a PDF here</p>
                <p className="text-sm text-muted-foreground">PDF only — or click to browse</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded bg-purple-50 flex items-center justify-center text-purple-500"><FileIcon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                  {isLoadingInfo && " · Reading pages..."}
                  {pageCount !== null && ` · ${pageCount} page${pageCount !== 1 ? "s" : ""}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground shrink-0" data-testid="button-change-file">Change</Button>
            </div>

            {pageCount !== null && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("all")}
                    className={cn("flex-1 rounded-xl border-2 p-4 text-left transition-all",
                      mode === "all" ? "border-purple-400 bg-purple-50/50" : "border-border hover:border-purple-200"
                    )}
                    data-testid="mode-all"
                  >
                    <p className="font-medium text-sm text-foreground">Split all pages</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Download all {pageCount} pages as a ZIP of individual PDFs</p>
                  </button>
                  <button
                    onClick={() => setMode("range")}
                    className={cn("flex-1 rounded-xl border-2 p-4 text-left transition-all",
                      mode === "range" ? "border-purple-400 bg-purple-50/50" : "border-border hover:border-purple-200"
                    )}
                    data-testid="mode-range"
                  >
                    <p className="font-medium text-sm text-foreground">Extract page range</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Download a specific range of pages as one PDF</p>
                  </button>
                </div>

                {mode === "range" && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">From page</label>
                      <input
                        type="number" min={1} max={pageCount} value={fromPage}
                        onChange={(e) => setFromPage(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-400"
                        data-testid="input-from"
                      />
                    </div>
                    <div className="pt-5 text-muted-foreground text-sm">to</div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To page</label>
                      <input
                        type="number" min={1} max={pageCount} value={toPage}
                        onChange={(e) => setToPage(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-400"
                        data-testid="input-to"
                      />
                    </div>
                    <div className="pt-5 text-xs text-muted-foreground whitespace-nowrap">of {pageCount}</div>
                  </motion.div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}

            {isSuccess && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="bg-purple-50 text-purple-700 text-sm p-4 rounded-lg flex items-center justify-between border border-purple-200">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">Split successfully!</span></div>
                <Button variant="outline" size="sm" onClick={reset} data-testid="button-start-over">Split another</Button>
              </motion.div>
            )}

            {pageCount !== null && !isSuccess && (
              <Button size="lg" className="w-full sm:w-auto font-medium bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSplit} disabled={isProcessing || isLoadingInfo} data-testid="button-split">
                {isProcessing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing...</> : <><Scissors className="mr-2 h-5 w-5" />{mode === "all" ? `Split all ${pageCount} pages` : "Extract pages"}</>}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
