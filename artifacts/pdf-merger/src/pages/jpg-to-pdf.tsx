import React, { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import { FileUp, Image, X, GripVertical, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

interface UploadedFile {
  id: string;
  file: File;
}

function getTypeBadge(type: string) {
  if (type === "image/jpeg") return "JPG";
  if (type === "image/png") return "PNG";
  return "IMG";
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function JpgToPdf() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => ACCEPTED_IMAGE_TYPES.has(f.type));
    if (valid.length < newFiles.length) {
      toast({ title: "Invalid file type", description: "Only JPG and PNG images are supported.", variant: "destructive" });
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid.map((f) => ({ id: Math.random().toString(36).slice(2), file: f }))]);
      setIsSuccess(false);
      setError(null);
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [addFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setIsSuccess(false);
    setError(null);
  }, []);

  const handleConvert = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setIsSuccess(false);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f.file));

      const response = await fetch("/api/pdf/jpg-to-pdf", { method: "POST", body: formData });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to convert images");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted.pdf";
      a.click();
      URL.revokeObjectURL(url);

      setIsSuccess(true);
      toast({ title: "Converted!", description: `${files.length} image${files.length > 1 ? "s" : ""} converted to PDF.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
      toast({ title: "Conversion failed", description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home"><ArrowLeft className="w-4 h-4" />All tools</Button></Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">JPG to PDF</h1>
          <p className="text-muted-foreground text-lg">Convert JPG and PNG images into a single PDF document.</p>
        </div>

        <Card
          className={cn("p-8 border-2 border-dashed transition-colors duration-200 cursor-pointer group",
            isDragging ? "border-orange-400 bg-orange-50/50" : "border-border hover:border-orange-300 hover:bg-muted/50"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="upload-zone"
        >
          <input type="file" multiple accept="image/jpeg,image/png" className="hidden" ref={fileInputRef} onChange={handleFileInput} data-testid="input-files" />
          <div className="flex flex-col items-center justify-center space-y-4 text-center pointer-events-none">
            <div className="h-16 w-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform duration-200">
              <FileUp className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">Drag & drop images here</p>
              <p className="text-sm text-muted-foreground">Supports JPG and PNG — or click to browse</p>
            </div>
          </div>
        </Card>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Images to convert ({files.length})</h2>
              <span className="text-xs text-muted-foreground">Drag to reorder</span>
            </div>

            <Reorder.Group axis="y" values={files} onReorder={setFiles} className="space-y-2">
              <AnimatePresence>
                {files.map((f) => (
                  <Reorder.Item key={f.id} value={f}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} whileDrag={{ scale: 1.02, zIndex: 10 }}
                    className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 shadow-sm"
                    data-testid={`row-file-${f.id}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors"><GripVertical className="h-5 w-5" /></div>
                    <div className="h-10 w-10 shrink-0 rounded bg-orange-50 flex items-center justify-center text-orange-500"><Image className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{f.file.name}</p>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{getTypeBadge(f.file.type)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.file.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeFile(f.id)} data-testid={`button-remove-${f.id}`}><X className="h-4 w-4" /></Button>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>

            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </motion.div>
            )}

            {isSuccess && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="bg-orange-50 text-orange-700 text-sm p-4 rounded-lg flex items-center justify-between border border-orange-200">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">Converted successfully!</span></div>
                <Button variant="outline" size="sm" onClick={() => { setFiles([]); setIsSuccess(false); setError(null); }} data-testid="button-start-over">Convert more</Button>
              </motion.div>
            )}

            <div className="pt-4">
              <Button size="lg" className="w-full sm:w-auto font-medium bg-orange-500 hover:bg-orange-600 text-white" onClick={handleConvert} disabled={files.length === 0 || isProcessing} data-testid="button-convert">
                {isProcessing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Converting...</> : <><Image className="mr-2 h-5 w-5" />Convert to PDF</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
