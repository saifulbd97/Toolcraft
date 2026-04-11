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
type Phase = "loading" | "idle" | "scanning" | "captured" | "result";
type EnhanceMode = "bw" | "grayscale" | "color";
type ScannerMode = "document" | "id" | "receipt" | "qr";

const MODE_META: Record<ScannerMode, { label: string; defaultEnhance: EnhanceMode; hint: string }> = {
  document: { label: "Document Scan",  defaultEnhance: "bw",        hint: "Point at a document — edges highlight automatically" },
  id:       { label: "ID Card",        defaultEnhance: "color",     hint: "Align your ID card with the yellow guide" },
  receipt:  { label: "Receipt",        defaultEnhance: "grayscale", hint: "Hold the receipt upright within the guide" },
  qr:       { label: "QR Code",        defaultEnhance: "color",     hint: "Point camera at a QR code to scan instantly" },
};

function modeDefaultCorners(w: number, h: number, mode: ScannerMode): Corners {
  if (mode === "id") {
    // ISO/IEC 7810 ID-1: 85.6 × 54 mm → ratio ≈ 1.586 landscape
    const cw = Math.min(w * 0.78, h * 0.55 * 1.586);
    const ch = cw / 1.586;
    const x0 = (w - cw) / 2, y0 = (h - ch) / 2;
    return [{ x: x0, y: y0 }, { x: x0 + cw, y: y0 }, { x: x0 + cw, y: y0 + ch }, { x: x0, y: y0 + ch }];
  }
  if (mode === "receipt") {
    // Tall narrow portrait ~1:2.8
    const rw = Math.min(w * 0.52, h * 0.3);
    const rh = Math.min(h * 0.84, rw * 2.8);
    const x0 = (w - rw) / 2, y0 = (h - rh) / 2;
    return [{ x: x0, y: y0 }, { x: x0 + rw, y: y0 }, { x: x0 + rw, y: y0 + rh }, { x: x0, y: y0 + rh }];
  }
  return defaultCorners(w, h);
}

// ─── OpenCV loader ─────────────────────────────────────────────────────────
let cvPromise: Promise<boolean> | null = null;
function loadOpenCV(): Promise<boolean> {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise((resolve) => {
    const cv = (window as any).cv;
    if (cv?.Mat) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.8.0/opencv.js";
    script.async = true;
    const timer = setTimeout(() => resolve(false), 25000);
    script.onload = () => {
      const ready = () => { clearTimeout(timer); resolve(true); };
      const w = window as any;
      if (w.cv?.Mat) { ready(); return; }
      const prev = w.cv?.onRuntimeInitialized;
      if (w.cv) {
        w.cv.onRuntimeInitialized = () => { prev?.(); ready(); };
      } else {
        // cv might set itself later
        let attempts = 0;
        const poll = setInterval(() => {
          if ((window as any).cv?.Mat || ++attempts > 100) {
            clearInterval(poll);
            resolve(!!(window as any).cv?.Mat);
          }
        }, 200);
      }
    };
    script.onerror = () => { clearTimeout(timer); resolve(false); };
    document.head.appendChild(script);
  });
  return cvPromise;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function sortCorners(pts: Pt[]): Corners {
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / 4, y: pts.reduce((s, p) => s + p.y, 0) / 4 };
  const tl = pts.find(p => p.x < c.x && p.y < c.y) ?? pts[0];
  const tr = pts.find(p => p.x >= c.x && p.y < c.y) ?? pts[1];
  const br = pts.find(p => p.x >= c.x && p.y >= c.y) ?? pts[2];
  const bl = pts.find(p => p.x < c.x && p.y >= c.y) ?? pts[3];
  return [tl, tr, br, bl];
}

function defaultCorners(w: number, h: number): Corners {
  const m = Math.min(w, h) * 0.06;
  return [{ x: m, y: m }, { x: w - m, y: m }, { x: w - m, y: h - m }, { x: m, y: h - m }];
}

// ─── Edge detection ───────────────────────────────────────────────────────────
function detectCorners(canvas: HTMLCanvasElement): Corners | null {
  const cv = (window as any).cv;
  if (!cv?.Mat) return null;
  try {
    const src = cv.imread(canvas);
    const gray = new cv.Mat(); const blur = new cv.Mat();
    const edges = new cv.Mat(); const dilated = new cv.Mat();
    const contours = new cv.MatVector(); const hier = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 50, 150);
    const k = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, dilated, k);
    cv.findContours(dilated, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const minArea = canvas.width * canvas.height * 0.05;
    let best: Corners | null = null; let maxA = 0;
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > minArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > maxA) {
          maxA = area;
          const d = approx.data32S;
          best = sortCorners([
            { x: d[0], y: d[1] }, { x: d[2], y: d[3] },
            { x: d[4], y: d[5] }, { x: d[6], y: d[7] },
          ]);
        }
        approx.delete();
      }
      cnt.delete();
    }
    src.delete(); gray.delete(); blur.delete(); edges.delete();
    dilated.delete(); k.delete(); contours.delete(); hier.delete();
    return best;
  } catch { return null; }
}

// ─── Perspective warp ─────────────────────────────────────────────────────────
function warpWithCV(src: HTMLCanvasElement, c: Corners): HTMLCanvasElement | null {
  const cv = (window as any).cv;
  if (!cv?.Mat) return null;
  try {
    const w = Math.max(Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y), Math.hypot(c[2].x - c[3].x, c[2].y - c[3].y));
    const h = Math.max(Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y), Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y));
    const outW = Math.round(w); const outH = Math.round(h);
    const mat = cv.imread(src);
    const dst = new cv.Mat();
    const sp = cv.matFromArray(4, 1, cv.CV_32FC2, [c[0].x, c[0].y, c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y]);
    const dp = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
    const M = cv.getPerspectiveTransform(sp, dp);
    cv.warpPerspective(mat, dst, M, new cv.Size(outW, outH), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    const out = document.createElement("canvas"); out.width = outW; out.height = outH;
    cv.imshow(out, dst);
    mat.delete(); dst.delete(); sp.delete(); dp.delete(); M.delete();
    return out;
  } catch { return null; }
}

// Gaussian elimination for 8×8 system
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
  const MAX = 1400;
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
  const dstData = dstCanvas.getContext("2d")!.createImageData(outW, outH);
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
  dstCanvas.getContext("2d")!.putImageData(dstData, 0, 0);
  return dstCanvas;
}

function warpImage(src: HTMLCanvasElement, corners: Corners): HTMLCanvasElement {
  return warpWithCV(src, corners) ?? warpPure(src, corners);
}

// ─── Enhancement ─────────────────────────────────────────────────────────────
function enhance(src: HTMLCanvasElement, mode: EnhanceMode): HTMLCanvasElement {
  const cv = (window as any).cv;
  const out = document.createElement("canvas"); out.width = src.width; out.height = src.height;
  const ctx = out.getContext("2d")!;
  // Try OpenCV adaptive threshold for crisp B&W
  if (mode === "bw" && cv?.Mat) {
    try {
      const mat = cv.imread(src); const gray = new cv.Mat(); const thr = new cv.Mat(); const rgba = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(gray, thr, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);
      cv.cvtColor(thr, rgba, cv.COLOR_GRAY2RGBA);
      cv.imshow(out, rgba);
      mat.delete(); gray.delete(); thr.delete(); rgba.delete();
      return out;
    } catch { /* fall through */ }
  }
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height); const d = img.data;
  if (mode === "bw") {
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = g > 128 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  } else if (mode === "grayscale") {
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = Math.min(255, g * 1.1);
    }
  } else {
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.min(255, Math.max(0, (d[i]     - 128) * 1.3 + 140));
      d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - 128) * 1.3 + 140));
      d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - 128) * 1.3 + 140));
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Scanner() {
  // Read scanner mode from URL (component remounts on each navigation)
  const scannerMode = useMemo((): ScannerMode => {
    const m = new URLSearchParams(window.location.search).get("mode") ?? "document";
    return (["document", "id", "receipt", "qr"] as const).includes(m as ScannerMode)
      ? (m as ScannerMode) : "document";
  }, []);
  const meta = MODE_META[scannerMode];

  const [phase, setPhase] = useState<Phase>("loading");
  const [cvReady, setCvReady] = useState(false);
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
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadOpenCV().then(ok => { setCvReady(ok); setPhase("idle"); });
  }, []);

  const stopCam = useCallback(() => {
    if (detectTimer.current) { clearInterval(detectTimer.current); detectTimer.current = null; }
    if (qrTimer.current) { clearInterval(qrTimer.current); qrTimer.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  // Attach stream to <video> element AFTER phase="scanning" has rendered the element
  useEffect(() => {
    if (phase !== "scanning") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    // Set attributes imperatively (belt-and-suspenders on top of JSX attrs)
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.srcObject = stream;

    const onMeta = () => {
      console.log("[Scanner] loadedmetadata", video.videoWidth, "x", video.videoHeight);
      video.play()
        .then(() => {
          console.log("[Scanner] video playing", video.videoWidth, "x", video.videoHeight);
          setCamReady(true);
        })
        .catch(e => console.error("[Scanner] play() failed:", e));
    };

    // If metadata already loaded (e.g. stream reused), fire immediately
    if (video.readyState >= 1) { onMeta(); }
    else { video.addEventListener("loadedmetadata", onMeta, { once: true }); }

    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [phase]);

  // Edge-detection (document) OR QR scanning — starts once camera is ready
  useEffect(() => {
    if (!camReady) return;

    if (scannerMode === "qr") {
      // QR scanning loop using jsQR
      import("jsqr").then(({ default: jsQR }) => {
        qrTimer.current = setInterval(() => {
          const v = videoRef.current;
          if (!v || !v.videoWidth) return;
          const tmp = document.createElement("canvas");
          tmp.width = v.videoWidth; tmp.height = v.videoHeight;
          tmp.getContext("2d")!.drawImage(v, 0, 0);
          const imgData = tmp.getContext("2d")!.getImageData(0, 0, tmp.width, tmp.height);
          const code = jsQR(imgData.data, tmp.width, tmp.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            setQrResult(code.data);
            stopCam();
            setPhase("result");
          }
        }, 150);
      });
      return () => {
        if (qrTimer.current) { clearInterval(qrTimer.current); qrTimer.current = null; }
      };
    }

    // Document/ID/Receipt — edge detection with OpenCV (if ready)
    if (!cvReady) return;
    detectTimer.current = setInterval(() => {
      const v = videoRef.current;
      const ov = overlayRef.current;
      if (!v || !ov || !v.videoWidth) return;
      const tmp = document.createElement("canvas");
      tmp.width = v.videoWidth; tmp.height = v.videoHeight;
      tmp.getContext("2d")!.drawImage(v, 0, 0);
      const pts = detectCorners(tmp);
      const ctx = ov.getContext("2d")!;
      ov.width = tmp.width; ov.height = tmp.height;
      ctx.clearRect(0, 0, ov.width, ov.height);
      if (pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = "rgba(34,197,94,.18)";
        ctx.fill();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = Math.max(2, ov.width * 0.003);
        ctx.stroke();
        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(6, ov.width * 0.012), 0, Math.PI * 2);
          ctx.fillStyle = "#22c55e";
          ctx.fill();
        });
      }
    }, 250);
    return () => {
      if (detectTimer.current) { clearInterval(detectTimer.current); detectTimer.current = null; }
    };
  }, [camReady, cvReady, scannerMode, stopCam]);

  const startCam = useCallback(async (f: "environment" | "user" = "environment") => {
    setErr(null);
    setCamReady(false);
    stopCam();

    // Fallback constraint chain — start strict, relax if needed
    const profiles = [
      { video: { facingMode: f } },
      { video: { facingMode: { ideal: f } } },
      { video: true },
    ] as const;

    let stream: MediaStream | null = null;
    for (const constraints of profiles) {
      try {
        console.log("[Scanner] trying constraints:", JSON.stringify(constraints));
        stream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
        console.log("[Scanner] stream obtained:", stream.getVideoTracks()[0]?.label);
        break;
      } catch (e: any) {
        console.error("[Scanner] getUserMedia failed:", e.name, e.message, constraints);
        if (e.name === "NotAllowedError") {
          setErr("Camera permission denied. Please allow camera access in your browser settings.");
          return;
        }
      }
    }

    if (!stream) {
      setErr("Could not start camera. Make sure your device has a camera and try again.");
      return;
    }

    streamRef.current = stream;
    // Switch phase so the <video> element mounts; useEffect above will attach the stream
    setPhase("scanning");
  }, [stopCam]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stopCam();
    const detected = scannerMode !== "qr" ? detectCorners(c) : null;
    setCorners(detected ?? modeDefaultCorners(c.width, c.height, scannerMode));
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
    } catch { /* keep previous result */ }
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
    setQrResult(null); setCopied(false);
    setErr(null); setMode(meta.defaultEnhance); setCamReady(false); setPhase("idle");
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
    const pt: Pt = {
      x: ((e.clientX - r.left) / r.width) * captured.width,
      y: ((e.clientY - r.top) / r.height) * captured.height,
    };
    const nc = [...corners] as Corners; nc[dragging] = pt; setCorners(nc);
  };
  const onPtrUp = () => setDragging(null);

  const ModeBar = ({ onChange }: { onChange: (m: EnhanceMode) => void }) => (
    <div className="flex gap-2 justify-center">
      {(["bw", "grayscale", "color"] as const).map(m => (
        <button key={m} onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            mode === m ? "bg-indigo-600 text-white shadow" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}>
          {{ bw: "B&W Scan", grayscale: "Grayscale", color: "Color" }[m]}
        </button>
      ))}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Sub-header */}
      <div className="sticky top-14 z-40 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-white/90 backdrop-blur">
        <Link href="/"><button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" />Back</button></Link>
        <div className="h-4 w-px bg-border" />
        {scannerMode === "qr"
          ? <QrCode className="w-4 h-4 text-amber-500" />
          : <ScanLine className="w-4 h-4 text-amber-500" />}
        <span className="font-semibold text-sm">{meta.label}</span>
        {!cvReady && phase !== "loading" && scannerMode !== "qr" && (
          <span className="ml-auto text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Basic mode</span>
        )}
      </div>

      {err && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{err}</div>
      )}

      {/* LOADING */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading scanner engine…</p>
        </div>
      )}

      {/* IDLE */}
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
                ? "Place your ID card on a flat surface and capture it."
                : scannerMode === "receipt"
                ? "Hold the receipt upright and capture for a clean scan."
                : cvReady ? "Point at a document — edges are detected automatically." : "Capture the document and adjust corners manually."}
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

      {/* SCANNING */}
      {phase === "scanning" && (
        <div className="flex flex-col" style={{ height: "calc(100dvh - 7rem)" }}>
          <div className="relative flex-1 bg-black overflow-hidden">
            {/* Video: object-cover fills the viewport, no black bars */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Canvas overlay for edge-detection highlight */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            {/* Loading spinner while camera initialises */}
            {!camReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-white text-sm">Starting camera…</p>
              </div>
            )}
            {/* ID card guide rectangle */}
            {camReady && scannerMode === "id" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="border-2 border-yellow-400 rounded-lg shadow-lg"
                  style={{ width: "75%", aspectRatio: "85.6/54", boxShadow: "0 0 0 1000px rgba(0,0,0,0.45)" }} />
              </div>
            )}
            {/* Receipt guide rectangle */}
            {camReady && scannerMode === "receipt" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="border-2 border-yellow-400 rounded-lg"
                  style={{ width: "45%", aspectRatio: "1/2.8", boxShadow: "0 0 0 1000px rgba(0,0,0,0.45)" }} />
              </div>
            )}
            {/* QR scanning crosshair */}
            {camReady && scannerMode === "qr" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="relative w-52 h-52">
                  {/* Corner brackets */}
                  {[["top-0 left-0 border-t-2 border-l-2",""],["top-0 right-0 border-t-2 border-r-2",""],
                    ["bottom-0 left-0 border-b-2 border-l-2",""],["bottom-0 right-0 border-b-2 border-r-2",""]].map(([cls],i) => (
                    <div key={i} className={`absolute w-8 h-8 border-amber-400 ${cls} rounded-sm`} />
                  ))}
                  {/* Scan line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-amber-400/80 animate-[scanLine_2s_ease-in-out_infinite]"
                    style={{ animation: "scanLine 2s ease-in-out infinite" }} />
                </div>
              </div>
            )}
            {/* Hint banner */}
            {camReady && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-10">
                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
                  {meta.hint}
                </span>
              </div>
            )}
          </div>
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

      {/* CAPTURED — corner adjust */}
      {phase === "captured" && captured && corners && (
        <div className="flex flex-col">
          <div className="bg-indigo-50 border-b border-indigo-100 text-center px-4 py-2.5">
            <p className="text-sm text-indigo-700 font-medium">Drag the blue handles to align the document boundary</p>
          </div>

          {/* Image + corner handles */}
          <div ref={wrapRef} className="relative bg-black select-none" style={{ touchAction: "none" }}
            onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerLeave={onPtrUp}>
            <img src={captured.toDataURL()} alt="captured" className="w-full h-auto block" draggable={false} />
            <svg className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${captured.width} ${captured.height}`} preserveAspectRatio="none">
              <polygon points={corners.map(c => `${c.x},${c.y}`).join(" ")}
                fill="rgba(99,102,241,.18)" stroke="#6366f1" strokeWidth={captured.width * 0.004} />
            </svg>
            {corners.map((c, i) => (
              <div key={i}
                className="absolute w-7 h-7 rounded-full bg-indigo-600 border-3 border-white shadow-lg cursor-grab active:cursor-grabbing touch-none -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${(c.x / captured.width) * 100}%`, top: `${(c.y / captured.height) * 100}%`, borderWidth: 3 }}
                onPointerDown={e => onPtrDown(e, i)} />
            ))}
          </div>

          <div className="px-4 py-4 border-t border-border space-y-3">
            <div>
              <p className="text-xs text-center text-muted-foreground mb-2">Output mode</p>
              <ModeBar onChange={m => setMode(m)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1 gap-2"><RefreshCcw className="w-4 h-4" />Retake</Button>
              <Button onClick={() => process()} disabled={busy} className="flex-1 gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {busy ? "Processing…" : "Apply & Scan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT — QR mode */}
      {phase === "result" && scannerMode === "qr" && qrResult && (
        <div className="flex flex-col items-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
            <QrCode className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">QR Code Decoded</p>
            <div className="w-full max-w-sm rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm break-all text-foreground font-mono">
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

      {/* RESULT — Document / ID / Receipt mode */}
      {phase === "result" && scannerMode !== "qr" && (
        <div className="flex flex-col items-center px-4 py-6 gap-5 max-w-lg mx-auto w-full">
          <div className="w-full rounded-xl overflow-hidden border border-border shadow-md bg-white">
            {busy
              ? <div className="aspect-[3/4] flex items-center justify-center bg-muted"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              : resultUrl && <img src={resultUrl} alt="Scanned document" className="w-full h-auto" />}
          </div>

          <div className="space-y-1.5 text-center w-full">
            <p className="text-xs text-muted-foreground">Enhancement mode</p>
            <ModeBar onChange={m => { setMode(m); reprocess(m); }} />
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
