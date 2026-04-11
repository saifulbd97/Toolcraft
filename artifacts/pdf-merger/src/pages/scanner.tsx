import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Camera, CameraOff, CheckCircle, ClipboardCopy,
  ExternalLink, FileDown, FlipHorizontal, Image as ImageIcon,
  Loader2, QrCode, RefreshCcw, ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pt { x: number; y: number }
type Corners = [Pt, Pt, Pt, Pt];
type Phase = "idle" | "scanning" | "captured" | "result";
type EnhanceMode = "color" | "clean" | "bw";
type ScannerMode = "document" | "id" | "receipt" | "qr";

const MODE_META: Record<ScannerMode, { label: string; defaultEnhance: EnhanceMode; hint: string }> = {
  document: { label: "Document Scan", defaultEnhance: "color", hint: "Drag the blue corners to align with your document" },
  id:       { label: "ID Card",       defaultEnhance: "color", hint: "Drag the blue corners to align with your ID card" },
  receipt:  { label: "Receipt",       defaultEnhance: "color", hint: "Drag the blue corners to align with your receipt" },
  qr:       { label: "QR Code",       defaultEnhance: "color", hint: "Point camera at a QR code to scan instantly" },
};

// ─── Default corners ──────────────────────────────────────────────────────────
function defaultCorners(w: number, h: number): Corners {
  const mx = w * 0.07;
  const my = h * 0.07;
  return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
}

// ID card ISO 7810 ratio: 85.60 × 53.98 mm ≈ 1.586
const ID_RATIO = 85.60 / 53.98;

function idCornersFromBox(x0: number, y0: number, x1: number, y1: number): Corners {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

function modeDefaultCorners(w: number, h: number, mode: ScannerMode): Corners {
  if (mode === "id") {
    // Zoom in to 75% of frame width — centres on likely card area, trims background
    const cw = Math.min(w * 0.75, h * 0.60 * ID_RATIO);
    const ch = cw / ID_RATIO;
    const x0 = (w - cw) / 2, y0 = (h - ch) / 2;
    return idCornersFromBox(x0, y0, x0 + cw, y0 + ch);
  }
  if (mode === "receipt") {
    const rw = Math.min(w * 0.52, h * 0.3);
    const rh = Math.min(h * 0.84, rw * 2.8);
    const x0 = (w - rw) / 2, y0 = (h - rh) / 2;
    return [{ x: x0, y: y0 }, { x: x0 + rw, y: y0 }, { x: x0 + rw, y: y0 + rh }, { x: x0, y: y0 + rh }];
  }
  return defaultCorners(w, h);
}

// ─── OpenCV loader (optional — used for warp & enhance only) ─────────────────
let cvPromise: Promise<void> | null = null;
function loadOpenCV(): Promise<void> {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise<void>((resolve) => {
    const cv = (window as any).cv;
    if (cv?.Mat) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.8.0/opencv.js";
    script.async = true;
    const timer = setTimeout(resolve, 25000);
    script.onload = () => {
      const w = window as any;
      const ready = () => { clearTimeout(timer); resolve(); };
      if (w.cv?.Mat) { ready(); return; }
      if (w.cv) {
        const prev = w.cv.onRuntimeInitialized;
        w.cv.onRuntimeInitialized = () => { prev?.(); ready(); };
      } else {
        let n = 0;
        const p = setInterval(() => { if ((window as any).cv?.Mat || ++n > 100) { clearInterval(p); resolve(); } }, 200);
      }
    };
    script.onerror = () => { clearTimeout(timer); resolve(); };
    document.head.appendChild(script);
  });
  return cvPromise;
}

// ─── Perspective warp ─────────────────────────────────────────────────────────
function warpWithCV(src: HTMLCanvasElement, c: Corners): HTMLCanvasElement | null {
  const cv = (window as any).cv;
  if (!cv?.Mat) return null;
  const mats: any[] = [];
  const t = <T,>(m: T): T => { mats.push(m); return m; };
  try {
    const topW = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
    const botW = Math.hypot(c[2].x - c[3].x, c[2].y - c[3].y);
    const leftH = Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y);
    const rightH = Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y);
    const outW = Math.round(Math.max(topW, botW));
    const outH = Math.round(Math.max(leftH, rightH));
    if (outW < 4 || outH < 4) return null;

    const mat = t(cv.imread(src));
    const dst = t(new cv.Mat());
    const sp = t(cv.matFromArray(4, 1, cv.CV_32FC2, [c[0].x, c[0].y, c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y]));
    const dp = t(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]));
    const M = t(cv.getPerspectiveTransform(sp, dp));
    cv.warpPerspective(mat, dst, M, new cv.Size(outW, outH), cv.INTER_CUBIC, cv.BORDER_REPLICATE);
    const out = document.createElement("canvas"); out.width = outW; out.height = outH;
    cv.imshow(out, dst);
    return out;
  } catch { return null; }
  finally { for (const m of mats) { try { m.delete(); } catch {} } }
}

// Pure-JS perspective warp fallback (Gaussian elimination homography)
function gauss(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let max = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[max][c])) max = r;
    [M[c], M[max]] = [M[max], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i];
    for (let j = i - 1; j >= 0; j--) M[j][n] -= M[j][i] * x[i];
  }
  return x;
}

function computeH(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = []; const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i]; const { x: dx, y: dy } = dst[i];
    A.push([-sx, -sy, -1, 0, 0, 0, dx * sx, dx * sy]); b.push(-dx);
    A.push([0, 0, 0, -sx, -sy, -1, dy * sx, dy * sy]); b.push(-dy);
  }
  return [...gauss(A, b), 1];
}

function applyH(H: number[], x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

function warpPure(srcCanvas: HTMLCanvasElement, c: Corners): HTMLCanvasElement {
  const MAX = 1600;
  let sc = srcCanvas;
  let corners = c;
  if (sc.width > MAX || sc.height > MAX) {
    const scale = MAX / Math.max(sc.width, sc.height);
    const tmp = document.createElement("canvas");
    tmp.width = Math.round(sc.width * scale); tmp.height = Math.round(sc.height * scale);
    tmp.getContext("2d")!.drawImage(sc, 0, 0, tmp.width, tmp.height);
    corners = c.map(p => ({ x: p.x * scale, y: p.y * scale })) as Corners;
    sc = tmp;
  }
  const outW = Math.round(Math.max(Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y), Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)));
  const outH = Math.round(Math.max(Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y), Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)));
  const srcData = sc.getContext("2d")!.getImageData(0, 0, sc.width, sc.height);
  const dstCanvas = document.createElement("canvas"); dstCanvas.width = outW; dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext("2d")!;
  const dstData = dstCtx.createImageData(outW, outH);
  const dst = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
  const H = computeH(dst as Pt[], corners as unknown as Pt[]);
  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const [sx, sy] = applyH(H, dx, dy);
      const ix = Math.round(sx); const iy = Math.round(sy);
      if (ix < 0 || iy < 0 || ix >= sc.width || iy >= sc.height) continue;
      const si = (iy * sc.width + ix) * 4; const di = (dy * outW + dx) * 4;
      dstData.data[di] = srcData.data[si]; dstData.data[di + 1] = srcData.data[si + 1];
      dstData.data[di + 2] = srcData.data[si + 2]; dstData.data[di + 3] = 255;
    }
  }
  dstCtx.putImageData(dstData, 0, 0);
  return dstCanvas;
}

function warpImage(src: HTMLCanvasElement, corners: Corners): HTMLCanvasElement {
  return warpWithCV(src, corners) ?? warpPure(src, corners);
}

// ─── Image enhancement ────────────────────────────────────────────────────────
function enhance(src: HTMLCanvasElement, mode: EnhanceMode): HTMLCanvasElement {
  const cv = (window as any).cv;
  const out = document.createElement("canvas"); out.width = src.width; out.height = src.height;
  const ctx = out.getContext("2d")!;
  const mats: any[] = [];
  const t = <T,>(m: T): T => { mats.push(m); return m; };
  const cleanup = () => { for (const m of mats) { try { m.delete(); } catch {} } };

  // ── Color: natural color, no processing ──────────────────────────────────
  if (mode === "color") {
    ctx.drawImage(src, 0, 0);
    return out;
  }

  // ── Clean: auto-levels per channel — boosts contrast, keeps full color ───
  if (mode === "clean") {
    if (cv?.Mat) {
      try {
        // Use LAB color space: apply CLAHE only on luminance (L), leave hue/sat unchanged
        const mat = t(cv.imread(src));
        const bgr = t(new cv.Mat());
        cv.cvtColor(mat, bgr, cv.COLOR_RGBA2BGR);
        const lab = t(new cv.Mat());
        cv.cvtColor(bgr, lab, cv.COLOR_BGR2Lab);
        const channels = new cv.MatVector();
        cv.split(lab, channels);
        const lCh = t(channels.get(0));
        try {
          const clahe = t(new cv.CLAHE(1.5, new cv.Size(8, 8)));
          clahe.apply(lCh, lCh);
        } catch { /* CLAHE unavailable */ }
        channels.set(0, lCh);
        const labOut = t(new cv.Mat());
        cv.merge(channels, labOut);
        const bgrOut = t(new cv.Mat());
        cv.cvtColor(labOut, bgrOut, cv.COLOR_Lab2BGR);
        const rgbaOut = t(new cv.Mat());
        cv.cvtColor(bgrOut, rgbaOut, cv.COLOR_BGR2RGBA);
        cv.imshow(out, rgbaOut);
        channels.delete();
        cleanup();
        return out;
      } catch { cleanup(); }
    }
    // Pure-JS fallback: auto-levels per channel (histogram stretch), keep colors
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i]   < rMin) rMin = d[i];   if (d[i]   > rMax) rMax = d[i];
      if (d[i+1] < gMin) gMin = d[i+1]; if (d[i+1] > gMax) gMax = d[i+1];
      if (d[i+2] < bMin) bMin = d[i+2]; if (d[i+2] > bMax) bMax = d[i+2];
    }
    const rR = Math.max(1, rMax - rMin);
    const gR = Math.max(1, gMax - gMin);
    const bR = Math.max(1, bMax - bMin);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.round((d[i]   - rMin) * 255 / rR));
      d[i+1] = Math.min(255, Math.round((d[i+1] - gMin) * 255 / gR));
      d[i+2] = Math.min(255, Math.round((d[i+2] - bMin) * 255 / bR));
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // ── B&W: gentle adaptive threshold — details visible, not over-darkened ──
  if (cv?.Mat) {
    try {
      const mat = t(cv.imread(src));
      const gray = t(new cv.Mat());
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      const blurred = t(new cv.Mat());
      cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
      // Large block (71) + high C (30) = soft threshold — only truly dark pixels
      // turn black; mid-tones and details are preserved rather than forced to white
      const thr = t(new cv.Mat());
      cv.adaptiveThreshold(blurred, thr, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 71, 30);
      const rgba = t(new cv.Mat());
      cv.cvtColor(thr, rgba, cv.COLOR_GRAY2RGBA);
      cv.imshow(out, rgba);
      cleanup();
      return out;
    } catch { cleanup(); }
  }
  // Pure-JS fallback: soft global threshold — 170 cutoff keeps most mid-tones white
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    const v = g > 170 ? 255 : g < 85 ? 0 : g;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Scanner() {
  const scannerMode = useMemo((): ScannerMode => {
    const m = new URLSearchParams(window.location.search).get("mode") ?? "document";
    return (["document", "id", "receipt", "qr"] as const).includes(m as ScannerMode)
      ? (m as ScannerMode) : "document";
  }, []);
  const meta = MODE_META[scannerMode];

  const [phase, setPhase] = useState<Phase>("idle");
  const [captured, setCaptured] = useState<HTMLCanvasElement | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [mode, setMode] = useState<EnhanceMode>(meta.defaultEnhance);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [dragging, setDragging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load OpenCV silently in the background (for warp + enhance only)
  useEffect(() => { loadOpenCV(); }, []);

  const stopCam = useCallback(() => {
    if (qrTimer.current) { clearInterval(qrTimer.current); qrTimer.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  // Attach stream to <video> after phase="scanning" mounts the element
  useEffect(() => {
    if (phase !== "scanning") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.srcObject = stream;
    const onMeta = () => {
      video.play()
        .then(() => setCamReady(true))
        .catch(e => console.error("[Scanner] play() failed:", e));
    };
    if (video.readyState >= 1) { onMeta(); }
    else { video.addEventListener("loadedmetadata", onMeta, { once: true }); }
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [phase]);

  // QR scanning loop
  useEffect(() => {
    if (!camReady || scannerMode !== "qr") return;
    import("jsqr").then(({ default: jsQR }) => {
      qrTimer.current = setInterval(() => {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;
        const tmp = document.createElement("canvas");
        tmp.width = v.videoWidth; tmp.height = v.videoHeight;
        tmp.getContext("2d")!.drawImage(v, 0, 0);
        const imgData = tmp.getContext("2d")!.getImageData(0, 0, tmp.width, tmp.height);
        const code = jsQR(imgData.data, tmp.width, tmp.height, { inversionAttempts: "dontInvert" });
        if (code?.data) { setQrResult(code.data); stopCam(); setPhase("result"); }
      }, 150);
    });
    return () => { if (qrTimer.current) { clearInterval(qrTimer.current); qrTimer.current = null; } };
  }, [camReady, scannerMode, stopCam]);

  const startCam = useCallback(async (f: "environment" | "user" = "environment") => {
    setErr(null); setCamReady(false); stopCam();
    const profiles = [
      { video: { facingMode: f } },
      { video: { facingMode: { ideal: f } } },
      { video: true },
    ] as const;
    let stream: MediaStream | null = null;
    for (const constraints of profiles) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
        break;
      } catch (e: any) {
        if (e.name === "NotAllowedError") {
          setErr("Camera permission denied. Please allow camera access in your browser settings.");
          return;
        }
      }
    }
    if (!stream) { setErr("Could not start camera. Make sure your device has a camera and try again."); return; }
    streamRef.current = stream;
    setPhase("scanning");
  }, [stopCam]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stopCam();
    // Always use mode-appropriate default corners — user will adjust manually
    setCorners(modeDefaultCorners(c.width, c.height, scannerMode));
    setCaptured(c);
    setPhase("captured");
  }, [stopCam, scannerMode]);

  const process = useCallback(async (overrideMode?: EnhanceMode) => {
    if (!captured || !corners) return;
    const m = overrideMode ?? mode;
    setBusy(true);
    await new Promise(r => setTimeout(r, 30));
    try {
      const warped = warpImage(captured, corners);
      const enhanced = enhance(warped, m);
      setResultUrl(enhanced.toDataURL("image/jpeg", 0.95));
      setPhase("result");
    } catch { setErr("Processing failed — please try again."); }
    setBusy(false);
  }, [captured, corners, mode]);

  const reprocess = useCallback(async (m: EnhanceMode) => {
    if (!captured || !corners) return;
    setMode(m);
    setBusy(true);
    await new Promise(r => setTimeout(r, 30));
    try {
      const warped = warpImage(captured, corners);
      setResultUrl(enhance(warped, m).toDataURL("image/jpeg", 0.95));
    } catch { /* keep previous */ }
    setBusy(false);
  }, [captured, corners]);

  const downloadJpg = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement("a"); a.href = resultUrl;
    a.download = `scan-${Date.now()}.jpg`; a.click();
  }, [resultUrl]);

  const downloadPdf = useCallback(async () => {
    if (!resultUrl) return;
    setBusy(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      const bytes = Uint8Array.from(atob(resultUrl.split(",")[1]), c => c.charCodeAt(0));
      const img = await pdf.embedJpg(bytes);
      const page = pdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      const blob = new Blob([await pdf.save()], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `scan-${Date.now()}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { setErr("PDF export failed."); }
    setBusy(false);
  }, [resultUrl]);

  const reset = useCallback(() => {
    stopCam(); setCaptured(null); setResultUrl(null); setCorners(null);
    setQrResult(null); setCopied(false); setErr(null);
    setMode(meta.defaultEnhance); setCamReady(false); setPhase("idle");
  }, [stopCam, meta.defaultEnhance]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const flipCam = useCallback(() => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next); startCam(next);
  }, [facing, startCam]);

  // Corner dragging
  const onPtrDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(idx);
  };
  const onPtrMove = (e: React.PointerEvent) => {
    if (dragging === null || !corners || !wrapRef.current || !captured) return;
    const r = wrapRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - r.left) / r.width)  * captured.width;
    const rawY = ((e.clientY - r.top)  / r.height) * captured.height;
    const pt: Pt = {
      x: Math.max(0, Math.min(captured.width,  rawX)),
      y: Math.max(0, Math.min(captured.height, rawY)),
    };

    if (scannerMode === "id") {
      // Locked-ratio resize: opposite corner (idx XOR 2) stays fixed
      // corners always stored as [TL, TR, BR, BL] in ID mode
      const oppIdx = dragging ^ 2;          // 0↔2, 1↔3
      const opp = corners[oppIdx];

      // Raw deltas from opposite corner to dragged point
      let dx = Math.abs(pt.x - opp.x);
      let dy = Math.abs(pt.y - opp.y);

      // Enforce ID_RATIO: expand whichever axis is too small
      if (dx / Math.max(dy, 0.001) > ID_RATIO) {
        dy = dx / ID_RATIO;
      } else {
        dx = dy * ID_RATIO;
      }

      // Direction signs based on which side the drag went
      const sx = pt.x >= opp.x ? 1 : -1;
      const sy = pt.y >= opp.y ? 1 : -1;

      // New dragged corner position (clamped)
      const nx = Math.max(0, Math.min(captured.width,  opp.x + sx * dx));
      const ny = Math.max(0, Math.min(captured.height, opp.y + sy * dy));

      // Rebuild all 4 corners as a clean rectangle
      const x0 = Math.min(opp.x, nx), y0 = Math.min(opp.y, ny);
      const x1 = Math.max(opp.x, nx), y1 = Math.max(opp.y, ny);
      setCorners(idCornersFromBox(x0, y0, x1, y1));
    } else {
      const nc = [...corners] as Corners; nc[dragging] = pt; setCorners(nc);
    }
  };
  const onPtrUp = () => setDragging(null);

  const EnhanceModeBar = ({ onChange }: { onChange: (m: EnhanceMode) => void }) => (
    <div className="flex gap-2 justify-center flex-wrap">
      {(["color", "clean", "bw"] as const).map(m => (
        <button key={m} onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            mode === m ? "bg-indigo-600 text-white shadow" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}>
          {{ color: "Color", clean: "Clean", bw: "B&W" }[m]}
        </button>
      ))}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
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
        {scannerMode === "qr"
          ? <QrCode className="w-4 h-4 text-amber-500" />
          : <ScanLine className="w-4 h-4 text-amber-500" />}
        <span className="font-semibold text-sm">{meta.label}</span>
      </div>

      {err && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* ── IDLE ── */}
      {phase === "idle" && (
        <div className="flex flex-col items-center justify-center min-h-[72vh] px-6 text-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            {scannerMode === "qr"
              ? <QrCode className="w-10 h-10 text-amber-500" />
              : <ScanLine className="w-10 h-10 text-amber-500" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">{meta.label}</h1>
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {scannerMode === "qr"
                ? "Point your camera at any QR code to instantly decode it."
                : scannerMode === "id"
                ? "Place your ID card on a flat surface, capture it, then drag the corners to align."
                : scannerMode === "receipt"
                ? "Hold the receipt upright, capture it, then drag the corners to align."
                : "Capture your document then drag the 4 blue corners to align the boundary."}
            </p>
          </div>
          {/* Mode selector pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {(["document", "id", "receipt", "qr"] as ScannerMode[]).map(m => (
              <a key={m} href={`?mode=${m}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  m === scannerMode
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                }`}>
                {MODE_META[m].label}
              </a>
            ))}
          </div>
          <Button onClick={() => startCam(facing)} size="lg" className="gap-2 px-10">
            <Camera className="w-5 h-5" /> Start Camera
          </Button>
        </div>
      )}

      {/* ── SCANNING ── */}
      {phase === "scanning" && (
        <div className="flex flex-col" style={{ height: "calc(100dvh - 7rem)" }}>
          <div className="relative flex-1 bg-black overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {/* Spinner while camera initialises */}
            {!camReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-white text-sm">Starting camera…</p>
              </div>
            )}

            {/* ID card guide */}
            {camReady && scannerMode === "id" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="border-2 border-yellow-400 rounded-lg"
                  style={{ width: "75%", aspectRatio: "85.6/54", boxShadow: "0 0 0 1000px rgba(0,0,0,0.45)" }} />
              </div>
            )}

            {/* Receipt guide */}
            {camReady && scannerMode === "receipt" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="border-2 border-yellow-400 rounded-lg"
                  style={{ width: "45%", aspectRatio: "1/2.8", boxShadow: "0 0 0 1000px rgba(0,0,0,0.45)" }} />
              </div>
            )}

            {/* QR crosshair */}
            {camReady && scannerMode === "qr" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="relative w-52 h-52">
                  {[["top-0 left-0 border-t-2 border-l-2"], ["top-0 right-0 border-t-2 border-r-2"],
                    ["bottom-0 left-0 border-b-2 border-l-2"], ["bottom-0 right-0 border-b-2 border-r-2"]].map(([cls], i) => (
                    <div key={i} className={`absolute w-8 h-8 border-amber-400 ${cls} rounded-sm`} />
                  ))}
                  <div className="absolute inset-x-0 h-0.5 bg-amber-400/80"
                    style={{ animation: "scanLine 2s ease-in-out infinite" }} />
                </div>
              </div>
            )}

            {/* Hint banner */}
            {camReady && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-10">
                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
                  {scannerMode === "qr" ? "Align QR code in the frame" : "Position document in frame, then tap capture"}
                </span>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-between px-8 py-4 bg-zinc-900">
            <button onClick={reset} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <CameraOff className="w-5 h-5" />
            </button>
            <button
              onClick={capture}
              disabled={!camReady}
              aria-label="Capture"
              className="w-16 h-16 rounded-full bg-white border-4 border-white/30 hover:scale-105 active:scale-95 transition-transform shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button onClick={flipCam} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <FlipHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── CAPTURED — corner adjustment ── */}
      {phase === "captured" && captured && corners && (
        <div className="flex flex-col">
          {/* Instruction banner */}
          <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2.5 text-center flex items-center justify-center gap-2 flex-wrap">
            <p className="text-sm text-indigo-700 font-medium">
              Drag the <span className="font-bold">blue circles</span> to align{" "}
              {scannerMode === "id" ? "your ID card" : "the 4 corners of your document"}
            </p>
            {scannerMode === "id" && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                🔒 1.6:1 ratio locked
              </span>
            )}
          </div>

          {/* Image + draggable corner handles */}
          <div
            ref={wrapRef}
            className="relative bg-black select-none"
            style={{ touchAction: "none" }}
            onPointerMove={onPtrMove}
            onPointerUp={onPtrUp}
            onPointerLeave={onPtrUp}
          >
            <img
              src={captured.toDataURL()}
              alt="captured"
              className="w-full h-auto block"
              draggable={false}
            />

            {/* Quad overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${captured.width} ${captured.height}`}
              preserveAspectRatio="none"
            >
              {/* Semi-transparent overlay outside the quad */}
              <defs>
                <mask id="quad-mask">
                  <rect width={captured.width} height={captured.height} fill="white" />
                  <polygon points={corners.map(c => `${c.x},${c.y}`).join(" ")} fill="black" />
                </mask>
              </defs>
              <rect
                width={captured.width} height={captured.height}
                fill="rgba(0,0,0,0.45)" mask="url(#quad-mask)"
              />
              {/* Crop boundary */}
              <polygon
                points={corners.map(c => `${c.x},${c.y}`).join(" ")}
                fill="rgba(99,102,241,0.12)"
                stroke="#6366f1"
                strokeWidth={Math.max(2, captured.width * 0.003)}
                strokeDasharray={`${captured.width * 0.015} ${captured.width * 0.008}`}
              />
              {/* Edge lines with corner index labels */}
              {corners.map((c, i) => {
                const next = corners[(i + 1) % 4];
                return <line key={i} x1={c.x} y1={c.y} x2={next.x} y2={next.y} stroke="#6366f1" strokeWidth={Math.max(1.5, captured.width * 0.002)} />;
              })}
            </svg>

            {/* Corner handle dots */}
            {corners.map((c, i) => (
              <div
                key={i}
                className="absolute z-10 touch-none cursor-grab active:cursor-grabbing"
                style={{
                  left: `${(c.x / captured.width) * 100}%`,
                  top: `${(c.y / captured.height) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onPointerDown={e => onPtrDown(e, i)}
              >
                {/* Outer ring for larger touch target */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Controls below the image */}
          <div className="px-4 py-4 border-t border-border space-y-3 bg-background">
            <div>
              <p className="text-xs text-center text-muted-foreground mb-2">Output mode</p>
              <EnhanceModeBar onChange={m => setMode(m)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1 gap-2">
                <RefreshCcw className="w-4 h-4" />Retake
              </Button>
              <Button onClick={() => process()} disabled={busy} className="flex-1 gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {busy ? "Processing…" : "Apply & Crop"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT — QR mode ── */}
      {phase === "result" && scannerMode === "qr" && qrResult && (
        <div className="flex flex-col items-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
            <QrCode className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center w-full">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">QR Code Decoded</p>
            <div className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm break-all text-foreground font-mono">
              {qrResult}
            </div>
          </div>
          <div className="flex gap-3 w-full max-w-sm">
            <Button variant="outline" onClick={() => copyToClipboard(qrResult)} className="flex-1 gap-2">
              <ClipboardCopy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            {/^https?:\/\//i.test(qrResult) && (
              <Button onClick={() => window.open(qrResult, "_blank")} className="flex-1 gap-2">
                <ExternalLink className="w-4 h-4" /> Open URL
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={reset} className="gap-2 text-muted-foreground">
            <RefreshCcw className="w-4 h-4" /> Scan Another
          </Button>
        </div>
      )}

      {/* ── RESULT — Document / ID / Receipt ── */}
      {phase === "result" && scannerMode !== "qr" && (
        <div className="flex flex-col items-center px-4 py-6 gap-5 max-w-lg mx-auto w-full">
          <div className="w-full rounded-xl overflow-hidden border border-border shadow-md bg-white">
            {busy
              ? <div className="aspect-[3/4] flex items-center justify-center bg-muted">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              : resultUrl && <img src={resultUrl} alt="Scanned document" className="w-full h-auto" />}
          </div>

          <div className="space-y-1.5 text-center w-full">
            <p className="text-xs text-muted-foreground">Enhancement mode</p>
            <EnhanceModeBar onChange={m => { setMode(m); reprocess(m); }} />
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={downloadJpg} className="flex-1 gap-2">
              <ImageIcon className="w-4 h-4" /> Download JPG
            </Button>
            <Button onClick={downloadPdf} disabled={busy} className="flex-1 gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Download PDF
            </Button>
          </div>

          <Button variant="ghost" onClick={reset} className="gap-2 text-muted-foreground">
            <RefreshCcw className="w-4 h-4" /> Scan Another
          </Button>
        </div>
      )}
    </div>
  );
}
