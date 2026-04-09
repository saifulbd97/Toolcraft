import React, { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { FileUp, File as FileIcon, Image, ArrowLeft, AlertCircle, Loader2, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import JSZip from "jszip";

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

interface PageImage {
  pageNum: number;
  filename: string;
  url: string;
  blob: Blob;
}

export default function PdfToJpg() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<PageImage[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const loadFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: t.invalidFileType, description: t.invalidFileTypePdf, variant: "destructive" });
      return;
    }
    setFile(f);
    setPages([]);
    setZipBlob(null);
    setError(null);
  }, [toast, t]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [loadFile]);

  const handleConvert = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setPages([]);
    setZipBlob(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/pdf/pdf-to-jpg", { method: "POST", body: formData });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to convert PDF");
      }

      const blob = await response.blob();
      setZipBlob(blob);

      const zip = await JSZip.loadAsync(blob);
      const filenames = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();

      const extracted: PageImage[] = await Promise.all(
        filenames.map(async (filename, idx) => {
          const imgBlob = await zip.files[filename].async("blob");
          const url = URL.createObjectURL(new Blob([imgBlob], { type: "image/jpeg" }));
          return { pageNum: idx + 1, filename, url, blob: imgBlob };
        })
      );

      setPages(extracted);
      toast({ title: t.success, description: t.pdfToJpgSuccess(extracted.length) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
      toast({ title: t.pdfToJpgFailed, description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPage = (page: PageImage) => {
    const a = document.createElement("a");
    a.href = page.url;
    a.download = `page-${page.pageNum}.jpg`;
    a.click();
  };

  const downloadAll = () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pages.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setFile(null);
    setPages([]);
    setZipBlob(null);
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex items-center">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home"><ArrowLeft className="w-4 h-4" />{t.allTools}</Button></Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t.pdfToJpgTitle}</h1>
          <p className="text-muted-foreground text-lg">{t.pdfToJpgSubtitle}</p>
        </div>

        {!file ? (
          <Card
            className={cn("p-8 border-2 border-dashed transition-colors duration-200 cursor-pointer group",
              isDragging ? "border-emerald-400 bg-emerald-50/50" : "border-border hover:border-emerald-300 hover:bg-muted/50"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            data-testid="upload-zone"
          >
            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileInput} data-testid="input-file" />
            <div className="flex flex-col items-center justify-center space-y-4 text-center pointer-events-none">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-200">
                <FileUp className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">{t.pdfToJpgDrop}</p>
                <p className="text-sm text-muted-foreground">{t.pdfToJpgDropSub}</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded bg-emerald-50 flex items-center justify-center text-emerald-500"><FileIcon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              {pages.length === 0 && (
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground shrink-0" data-testid="button-change-file">{t.change}</Button>
              )}
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}

            {pages.length === 0 && !error && (
              <Button
                size="lg"
                className="w-full sm:w-auto font-medium bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={handleConvert}
                disabled={isProcessing}
                data-testid="button-convert"
              >
                {isProcessing
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t.convertingToJpg}</>
                  : <><Image className="mr-2 h-5 w-5" />{t.convertToJpg}</>
                }
              </Button>
            )}

            <AnimatePresence>
              {pages.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t.pdfToJpgSuccess(pages.length)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pages.length > 1 && (
                        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" onClick={downloadAll} data-testid="button-download-all">
                          <Download className="h-4 w-4" />{t.downloadAll}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={reset} data-testid="button-start-over">{t.pdfToJpgAnother}</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {pages.map((page) => (
                      <motion.div
                        key={page.pageNum}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: page.pageNum * 0.04 }}
                        className="group relative rounded-xl border border-border overflow-hidden bg-muted/30"
                        data-testid={`page-${page.pageNum}`}
                      >
                        <img
                          src={page.url}
                          alt={t.pdfToJpgPage(page.pageNum)}
                          className="w-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            className="bg-white text-emerald-700 hover:bg-emerald-50 gap-1.5 shadow text-xs"
                            onClick={() => downloadPage(page)}
                            data-testid={`button-download-page-${page.pageNum}`}
                          >
                            <Download className="h-3.5 w-3.5" />{t.downloadPage(page.pageNum)}
                          </Button>
                        </div>
                        <div className="px-2 py-1.5 border-t border-border bg-background/80 text-xs text-muted-foreground text-center">
                          {t.pdfToJpgPage(page.pageNum)}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
