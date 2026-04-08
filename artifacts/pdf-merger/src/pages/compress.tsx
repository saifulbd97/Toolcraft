import React, { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { FileUp, File as FileIcon, FileArchive, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Download } from "lucide-react";
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

interface CompressResult {
  originalSize: number;
  compressedSize: number;
  downloadUrl: string;
}

export default function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file type", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
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

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/pdf/compress", { method: "POST", body: formData });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to compress PDF");
      }

      const originalSize = parseInt(response.headers.get("X-Original-Size") || "0", 10);
      const compressedSize = parseInt(response.headers.get("X-Compressed-Size") || "0", 10);

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      setResult({ originalSize: originalSize || file.size, compressedSize: compressedSize || blob.size, downloadUrl });
      toast({ title: "Compressed!", description: "Your PDF has been compressed and is ready to download." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
      toast({ title: "Compression failed", description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.downloadUrl;
    a.download = "compressed.pdf";
    a.click();
  };

  const reset = () => { setFile(null); setResult(null); setError(null); };

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home"><ArrowLeft className="w-4 h-4" />All tools</Button></Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Compress PDF</h1>
          <p className="text-muted-foreground text-lg">Reduce your PDF file size while keeping it readable.</p>
        </div>

        {!file ? (
          <Card
            className={cn("p-8 border-2 border-dashed transition-colors duration-200 cursor-pointer group",
              isDragging ? "border-sky-400 bg-sky-50/50" : "border-border hover:border-sky-300 hover:bg-muted/50"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="upload-zone"
          >
            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileInput} data-testid="input-file" />
            <div className="flex flex-col items-center justify-center space-y-4 text-center pointer-events-none">
              <div className="h-16 w-16 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform duration-200">
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
              <div className="h-10 w-10 shrink-0 rounded bg-sky-50 flex items-center justify-center text-sky-500"><FileIcon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              {!result && <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground shrink-0" data-testid="button-change-file">Change</Button>}
            </div>

            {result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-sky-50 border border-sky-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sky-700 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Compression complete
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Original</p>
                    <p className="text-sm font-semibold text-foreground">{formatFileSize(result.originalSize)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Compressed</p>
                    <p className="text-sm font-semibold text-foreground">{formatFileSize(result.compressedSize)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Saved</p>
                    <p className={cn("text-sm font-semibold", savings > 0 ? "text-sky-600" : "text-muted-foreground")}>
                      {savings > 0 ? `${savings}%` : "Already optimized"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button className="flex-1 bg-sky-500 hover:bg-sky-600 text-white" onClick={triggerDownload} data-testid="button-download">
                    <Download className="mr-2 h-4 w-4" />Download compressed PDF
                  </Button>
                  <Button variant="outline" onClick={reset} data-testid="button-start-over">Compress another</Button>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}

            {!result && (
              <Button size="lg" className="w-full sm:w-auto font-medium bg-sky-500 hover:bg-sky-600 text-white" onClick={handleCompress} disabled={isProcessing} data-testid="button-compress">
                {isProcessing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Compressing...</> : <><FileArchive className="mr-2 h-5 w-5" />Compress PDF</>}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
