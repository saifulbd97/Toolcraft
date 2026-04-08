import React, { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import { FileUp, File as FileIcon, Image, X, GripVertical, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

interface UploadedFile {
  id: string;
  file: File;
}

function getFileIcon(type: string) {
  if (type === "application/pdf") return <FileIcon className="h-5 w-5" />;
  return <Image className="h-5 w-5" />;
}

function getFileTypeBadge(type: string) {
  if (type === "application/pdf") return "PDF";
  if (type === "image/jpeg") return "JPG";
  if (type === "image/png") return "PNG";
  return "FILE";
}

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((file) => ACCEPTED_TYPES.has(file.type));
    if (valid.length < newFiles.length) {
      toast({ title: t.invalidFileType, description: t.invalidFileTypePdfJpgPng, variant: "destructive" });
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid.map((file) => ({ id: Math.random().toString(36).substring(7), file }))]);
      setIsSuccess(false);
      setError(null);
    }
  }, [toast, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [addFiles]);

  const removeFile = useCallback((idToRemove: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== idToRemove));
    setIsSuccess(false);
    setError(null);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: t.moreFilesNeeded, description: t.moreFilesDesc, variant: "destructive" });
      return;
    }
    setIsMerging(true);
    setError(null);
    setIsSuccess(false);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f.file));
      const response = await fetch("/api/pdf/merge", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to merge files");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "merged.pdf"; a.click();
      URL.revokeObjectURL(url);
      setIsSuccess(true);
      toast({ title: t.success, description: t.mergeSuccessDesc });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      toast({ title: t.mergeFailed, description: message, variant: "destructive" });
    } finally {
      setIsMerging(false);
    }
  };

  const reset = () => { setFiles([]); setIsSuccess(false); setError(null); };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center mb-2">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home"><ArrowLeft className="w-4 h-4" />{t.allTools}</Button></Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t.mergeTitle}</h1>
          <p className="text-muted-foreground text-lg">{t.mergeSubtitle}</p>
        </div>

        <Card
          className={cn("p-8 border-2 border-dashed transition-colors duration-200 ease-in-out cursor-pointer relative overflow-hidden group",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          data-testid="upload-zone"
        >
          <input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="hidden" ref={fileInputRef} onChange={handleFileInput} data-testid="input-files" />
          <div className="flex flex-col items-center justify-center space-y-4 text-center pointer-events-none">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-200">
              <FileUp className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">{t.mergeDrop}</p>
              <p className="text-sm text-muted-foreground">{t.mergeDropSub}</p>
            </div>
          </div>
        </Card>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">{t.mergeFilesLabel(files.length)}</h2>
              <span className="text-xs text-muted-foreground">{t.dragToReorder}</span>
            </div>

            <Reorder.Group axis="y" values={files} onReorder={setFiles} className="space-y-2">
              <AnimatePresence>
                {files.map((file) => (
                  <Reorder.Item
                    key={file.id} value={file}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} whileDrag={{ scale: 1.02, zIndex: 10 }}
                    className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 shadow-sm"
                    data-testid={`row-file-${file.id}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors"><GripVertical className="h-5 w-5" /></div>
                    <div className="h-10 w-10 shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary">{getFileIcon(file.file.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{file.file.name}</p>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{getFileTypeBadge(file.file.type)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeFile(file.id)} data-testid={`button-remove-${file.id}`}>
                      <X className="h-4 w-4" />
                    </Button>
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
                className="bg-primary/10 text-primary text-sm p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">{t.mergedSuccess}</span></div>
                <Button variant="outline" size="sm" onClick={reset} data-testid="button-start-over">{t.mergeMore}</Button>
              </motion.div>
            )}

            <div className="pt-4 flex justify-end">
              <Button size="lg" className="w-full sm:w-auto font-medium" onClick={handleMerge} disabled={files.length < 2 || isMerging} data-testid="button-merge">
                {isMerging ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t.merging}</> : <><FileIcon className="mr-2 h-5 w-5" />{t.mergeBtn}</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
