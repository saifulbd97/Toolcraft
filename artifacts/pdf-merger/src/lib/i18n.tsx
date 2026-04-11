import React, { createContext, useContext, useState, useEffect } from "react";

export type Lang = "en" | "bn";

export interface Translations {
  langLabel: string;
  allTools: string;
  backToHome: string;
  comingSoon: string;
  // Landing page
  homeTagline: string;
  homeTitle: string;
  homeSubtitle: string;
  homeFootnote: string;
  categories: {
    pdfTools: { title: string; description: string; tools: string[] };
    scanner: { title: string; description: string; tools: string[] };
    incomeCalc: { title: string; description: string; tools: string[] };
    bgRemover: { title: string; description: string; tools: string[] };
  };
  dragToReorder: string;
  change: string;
  to: string;
  fromPage: string;
  toPage: string;
  // Dashboard
  dashTitle: string;
  dashSubtitle: string;
  tools: {
    merge: { title: string; description: string };
    jpgToPdf: { title: string; description: string };
    pdfToJpg: { title: string; description: string };
    split: { title: string; description: string };
    compress: { title: string; description: string };
  };
  // Merge page
  mergeTitle: string;
  mergeSubtitle: string;
  mergeDrop: string;
  mergeDropSub: string;
  mergeFilesLabel: (n: number) => string;
  merging: string;
  mergeBtn: string;
  mergedSuccess: string;
  mergeMore: string;
  // JPG to PDF page
  jpgTitle: string;
  jpgSubtitle: string;
  jpgDrop: string;
  jpgDropSub: string;
  jpgFilesLabel: (n: number) => string;
  converting: string;
  convertBtn: string;
  convertedSuccess: string;
  convertMore: string;
  // Split page
  splitTitle: string;
  splitSubtitle: string;
  splitDrop: string;
  splitDropSub: string;
  readingPages: string;
  pageCount: (n: number) => string;
  splitAll: string;
  splitAllDesc: (n: number) => string;
  extractRange: string;
  extractRangeDesc: string;
  ofPages: (n: number) => string;
  processing: string;
  splitAllBtn: (n: number) => string;
  extractBtn: string;
  splitSuccess: string;
  splitAnother: string;
  // Compress page
  compressTitle: string;
  compressSubtitle: string;
  compressDrop: string;
  compressDropSub: string;
  compressionLevel: string;
  qualityLow: string;
  qualityLowDesc: string;
  qualityMedium: string;
  qualityMediumDesc: string;
  qualityHigh: string;
  qualityHighDesc: string;
  compressionComplete: string;
  original: string;
  compressed: string;
  saved: string;
  downloadCompressed: string;
  compressAnother: string;
  alreadyOptimized: string;
  alreadyOptimizedDesc: string;
  afterCompression: string;
  tryAnotherFile: string;
  tryStronger: string;
  compressing: string;
  compressBtn: string;
  // Toasts
  invalidFileType: string;
  invalidFileTypePdfJpgPng: string;
  invalidFileTypeJpgPng: string;
  invalidFileTypePdf: string;
  moreFilesNeeded: string;
  moreFilesDesc: string;
  success: string;
  mergeSuccessDesc: string;
  mergeFailed: string;
  convertedToast: (n: number) => string;
  conversionFailed: string;
  doneToast: string;
  splitAllToastDesc: (n: number) => string;
  splitRangeToastDesc: (from: string, to: string) => string;
  splitFailed: string;
  compressFailed: string;
  // PDF to JPG page
  pdfToJpgTitle: string;
  pdfToJpgSubtitle: string;
  pdfToJpgDrop: string;
  pdfToJpgDropSub: string;
  convertToJpg: string;
  convertingToJpg: string;
  pdfToJpgSuccess: (n: number) => string;
  pdfToJpgAnother: string;
  downloadAll: string;
  downloadPage: (n: number) => string;
  pdfToJpgFailed: string;
  pdfToJpgPage: (n: number) => string;
}

const en: Translations = {
  langLabel: "বাংলা",
  allTools: "All PDF tools",
  backToHome: "Back to Home",
  comingSoon: "Coming Soon",
  homeTagline: "Free tools for everyone",
  homeTitle: "Your all-in-one toolkit",
  homeSubtitle: "Powerful tools to work smarter — PDF utilities, scanning, and financial calculators, all in one place.",
  homeFootnote: "More tools coming soon. All processing happens in your browser — your files stay private.",
  categories: {
    pdfTools: {
      title: "PDF Tools",
      description: "Merge, split, convert, and compress PDF files instantly without any software.",
      tools: ["Merge", "Split", "JPG → PDF", "PDF → JPG", "Compress"],
    },
    scanner: {
      title: "Scanner",
      description: "Scan documents using your camera and export as high-quality PDF or image files.",
      tools: ["Document Scan", "ID Card", "Receipt", "QR Code"],
    },
    incomeCalc: {
      title: "Income Calculator",
      description: "Calculate taxes, salary breakdowns, and financial projections with ease.",
      tools: ["Tax Estimator", "Salary Breakdown", "Take-home Pay"],
    },
    bgRemover: {
      title: "Background Remover",
      description: "Remove image backgrounds instantly using AI — powered by remove.bg.",
      tools: ["Remove BG", "Transparent PNG", "AI-powered"],
    },
  },
  dragToReorder: "Drag to reorder",
  change: "Change",
  to: "to",
  fromPage: "From page",
  toPage: "To page",
  dashTitle: "PDF Tools",
  dashSubtitle: "Everything you need to work with PDFs — free, fast, and easy to use.",
  tools: {
    merge: { title: "Merge PDF", description: "Combine multiple PDFs and images into one document." },
    jpgToPdf: { title: "JPG to PDF", description: "Convert JPG, PNG images into a PDF document." },
    pdfToJpg: { title: "PDF to JPG", description: "Extract pages from a PDF as high-quality images." },
    split: { title: "Split PDF", description: "Separate a PDF into individual pages or ranges." },
    compress: { title: "Compress PDF", description: "Reduce PDF file size while keeping quality high." },
  },
  mergeTitle: "Merge PDFs",
  mergeSubtitle: "Combine PDFs and images (JPG, PNG) into one document, quickly and securely.",
  mergeDrop: "Drag & drop PDFs or images here",
  mergeDropSub: "Supports PDF, JPG, and PNG — or click to browse",
  mergeFilesLabel: (n) => `Files to merge (${n})`,
  merging: "Merging...",
  mergeBtn: "Merge Files",
  mergedSuccess: "Merged successfully!",
  mergeMore: "Merge more",
  jpgTitle: "JPG to PDF",
  jpgSubtitle: "Convert JPG and PNG images into a single PDF document.",
  jpgDrop: "Drag & drop images here",
  jpgDropSub: "Supports JPG and PNG — or click to browse",
  jpgFilesLabel: (n) => `Images to convert (${n})`,
  converting: "Converting...",
  convertBtn: "Convert to PDF",
  convertedSuccess: "Converted successfully!",
  convertMore: "Convert more",
  splitTitle: "Split PDF",
  splitSubtitle: "Split into individual pages or extract a custom page range.",
  splitDrop: "Drag & drop a PDF here",
  splitDropSub: "PDF only — or click to browse",
  readingPages: "Reading pages...",
  pageCount: (n) => `${n} page${n !== 1 ? "s" : ""}`,
  splitAll: "Split all pages",
  splitAllDesc: (n) => `Download all ${n} pages as a ZIP of individual PDFs`,
  extractRange: "Extract page range",
  extractRangeDesc: "Download a specific range of pages as one PDF",
  ofPages: (n) => `of ${n}`,
  processing: "Processing...",
  splitAllBtn: (n) => `Split all ${n} pages`,
  extractBtn: "Extract pages",
  splitSuccess: "Split successfully!",
  splitAnother: "Split another",
  compressTitle: "Compress PDF",
  compressSubtitle: "Reduce your PDF file size while keeping it readable.",
  compressDrop: "Drag & drop a PDF here",
  compressDropSub: "PDF only — or click to browse",
  compressionLevel: "Compression level",
  qualityLow: "Strong",
  qualityLowDesc: "Smallest file, lower image quality",
  qualityMedium: "Balanced",
  qualityMediumDesc: "Good balance of size and quality",
  qualityHigh: "High quality",
  qualityHighDesc: "Minimal size reduction, best quality",
  compressionComplete: "Compression complete",
  original: "Original",
  compressed: "Compressed",
  saved: "Saved",
  downloadCompressed: "Download compressed PDF",
  compressAnother: "Compress another",
  alreadyOptimized: "File is already optimized",
  alreadyOptimizedDesc: "This PDF could not be reduced further — it's already well-compressed. Try the Strong compression level for a more aggressive attempt.",
  afterCompression: "After compression",
  tryAnotherFile: "Try another file",
  tryStronger: "Try stronger compression",
  compressing: "Compressing...",
  compressBtn: "Compress PDF",
  invalidFileType: "Invalid file type",
  invalidFileTypePdfJpgPng: "Only PDF, JPG, and PNG files are supported.",
  invalidFileTypeJpgPng: "Only JPG and PNG images are supported.",
  invalidFileTypePdf: "Please upload a PDF file.",
  moreFilesNeeded: "More files needed",
  moreFilesDesc: "Please upload at least 2 files to merge.",
  success: "Success",
  mergeSuccessDesc: "Files merged successfully. Download started.",
  mergeFailed: "Merge failed",
  convertedToast: (n) => `${n} image${n > 1 ? "s" : ""} converted to PDF.`,
  conversionFailed: "Conversion failed",
  doneToast: "Done!",
  splitAllToastDesc: (n) => `All ${n} pages saved as individual PDFs in a ZIP file.`,
  splitRangeToastDesc: (from, to) => `Pages ${from}–${to} extracted as a PDF.`,
  splitFailed: "Split failed",
  compressFailed: "Compression failed",
  pdfToJpgTitle: "PDF to JPG",
  pdfToJpgSubtitle: "Convert every PDF page into a high-quality JPG image.",
  pdfToJpgDrop: "Drag & drop a PDF here",
  pdfToJpgDropSub: "PDF only — or click to browse",
  convertToJpg: "Convert to JPG",
  convertingToJpg: "Converting...",
  pdfToJpgSuccess: (n) => `${n} page${n !== 1 ? "s" : ""} converted successfully`,
  pdfToJpgAnother: "Convert another",
  downloadAll: "Download all as ZIP",
  downloadPage: (n) => `Download page ${n}`,
  pdfToJpgFailed: "Conversion failed",
  pdfToJpgPage: (n) => `Page ${n}`,
};

const bn: Translations = {
  langLabel: "English",
  allTools: "সব পিডিএফ টুলস",
  backToHome: "হোমে ফিরুন",
  comingSoon: "শীঘ্রই আসছে",
  homeTagline: "সবার জন্য বিনামূল্যে টুলস",
  homeTitle: "আপনার সম্পূর্ণ টুলকিট",
  homeSubtitle: "স্মার্টভাবে কাজ করার জন্য শক্তিশালী টুলস — পিডিএফ ইউটিলিটি, স্ক্যানিং এবং আর্থিক ক্যালকুলেটর একটি জায়গায়।",
  homeFootnote: "আরও টুলস শীঘ্রই আসছে। সমস্ত প্রক্রিয়াকরণ আপনার ব্রাউজারে হয় — আপনার ফাইল সুরক্ষিত থাকে।",
  categories: {
    pdfTools: {
      title: "পিডিএফ টুলস",
      description: "কোনো সফটওয়্যার ছাড়াই তাৎক্ষণিকভাবে পিডিএফ মার্জ, স্প্লিট, রূপান্তর ও কম্প্রেস করুন।",
      tools: ["মার্জ", "স্প্লিট", "JPG → PDF", "PDF → JPG", "কম্প্রেস"],
    },
    scanner: {
      title: "স্ক্যানার",
      description: "ক্যামেরা ব্যবহার করে ডকুমেন্ট স্ক্যান করুন এবং উচ্চমানের পিডিএফ বা ছবি হিসেবে রপ্তানি করুন।",
      tools: ["ডকুমেন্ট স্ক্যান", "পরিচয়পত্র", "রসিদ", "QR কোড"],
    },
    incomeCalc: {
      title: "আয় ক্যালকুলেটর",
      description: "কর, বেতন বিভাজন এবং আর্থিক পূর্বাভাস সহজে হিসাব করুন।",
      tools: ["কর অনুমান", "বেতন বিভাজন", "নিট বেতন"],
    },
    bgRemover: {
      title: "ব্যাকগ্রাউন্ড রিমুভার",
      description: "AI দিয়ে তাৎক্ষণিকভাবে ছবির ব্যাকগ্রাউন্ড মুছুন — remove.bg দ্বারা চালিত।",
      tools: ["BG মুছুন", "স্বচ্ছ PNG", "AI-চালিত"],
    },
  },
  dragToReorder: "ক্রম পরিবর্তনে টেনে আনুন",
  change: "পরিবর্তন করুন",
  to: "থেকে",
  fromPage: "শুরু পৃষ্ঠা",
  toPage: "শেষ পৃষ্ঠা",
  dashTitle: "পিডিএফ টুলস",
  dashSubtitle: "পিডিএফ নিয়ে কাজ করতে যা দরকার — বিনামূল্যে, দ্রুত এবং সহজে ব্যবহারযোগ্য।",
  tools: {
    merge: { title: "পিডিএফ মার্জ", description: "একাধিক পিডিএফ ও ছবি একটি ডকুমেন্টে একত্রিত করুন।" },
    jpgToPdf: { title: "JPG থেকে পিডিএফ", description: "JPG, PNG ছবিকে পিডিএফ ডকুমেন্টে রূপান্তর করুন।" },
    pdfToJpg: { title: "পিডিএফ থেকে JPG", description: "পিডিএফ থেকে উচ্চমানের ছবি হিসেবে পৃষ্ঠা বের করুন।" },
    split: { title: "পিডিএফ বিভক্ত", description: "পিডিএফকে আলাদা পৃষ্ঠা বা নির্দিষ্ট রেঞ্জে বিভক্ত করুন।" },
    compress: { title: "পিডিএফ কম্প্রেস", description: "মান বজায় রেখে পিডিএফের আকার ছোট করুন।" },
  },
  mergeTitle: "পিডিএফ মার্জ করুন",
  mergeSubtitle: "পিডিএফ ও ছবি (JPG, PNG) দ্রুত ও নিরাপদে একটি ডকুমেন্টে একত্রিত করুন।",
  mergeDrop: "পিডিএফ বা ছবি এখানে টেনে আনুন",
  mergeDropSub: "PDF, JPG, PNG সাপোর্টেড — বা ক্লিক করে ব্রাউজ করুন",
  mergeFilesLabel: (n) => `মার্জ করার ফাইল (${n})`,
  merging: "মার্জ হচ্ছে...",
  mergeBtn: "ফাইল মার্জ করুন",
  mergedSuccess: "সফলভাবে মার্জ হয়েছে!",
  mergeMore: "আরও মার্জ করুন",
  jpgTitle: "JPG থেকে পিডিএফ",
  jpgSubtitle: "JPG ও PNG ছবিকে একটি পিডিএফ ডকুমেন্টে রূপান্তর করুন।",
  jpgDrop: "ছবি এখানে টেনে আনুন",
  jpgDropSub: "JPG ও PNG সাপোর্টেড — বা ক্লিক করে ব্রাউজ করুন",
  jpgFilesLabel: (n) => `রূপান্তরের ছবি (${n})`,
  converting: "রূপান্তর হচ্ছে...",
  convertBtn: "পিডিএফে রূপান্তর করুন",
  convertedSuccess: "সফলভাবে রূপান্তরিত হয়েছে!",
  convertMore: "আরও রূপান্তর করুন",
  splitTitle: "পিডিএফ বিভক্ত করুন",
  splitSubtitle: "আলাদা পৃষ্ঠায় বিভক্ত করুন বা কাস্টম রেঞ্জ বের করুন।",
  splitDrop: "পিডিএফ এখানে টেনে আনুন",
  splitDropSub: "শুধু PDF — বা ক্লিক করে ব্রাউজ করুন",
  readingPages: "পৃষ্ঠা পড়া হচ্ছে...",
  pageCount: (n) => `${n} পৃষ্ঠা`,
  splitAll: "সব পৃষ্ঠা বিভক্ত করুন",
  splitAllDesc: (n) => `${n}টি পৃষ্ঠা ZIP ফাইলে আলাদাভাবে ডাউনলোড করুন`,
  extractRange: "পৃষ্ঠার রেঞ্জ বের করুন",
  extractRangeDesc: "নির্দিষ্ট রেঞ্জের পৃষ্ঠাগুলো একটি পিডিএফে ডাউনলোড করুন",
  ofPages: (n) => `/ ${n}`,
  processing: "প্রসেস হচ্ছে...",
  splitAllBtn: (n) => `${n}টি পৃষ্ঠা বিভক্ত করুন`,
  extractBtn: "পৃষ্ঠা বের করুন",
  splitSuccess: "সফলভাবে বিভক্ত হয়েছে!",
  splitAnother: "আরেকটি বিভক্ত করুন",
  compressTitle: "পিডিএফ কম্প্রেস করুন",
  compressSubtitle: "পিডিএফ পাঠযোগ্য রেখে ফাইলের আকার ছোট করুন।",
  compressDrop: "পিডিএফ এখানে টেনে আনুন",
  compressDropSub: "শুধু PDF — বা ক্লিক করে ব্রাউজ করুন",
  compressionLevel: "কম্প্রেশন মাত্রা",
  qualityLow: "শক্তিশালী",
  qualityLowDesc: "সবচেয়ে ছোট ফাইল, কম ছবির মান",
  qualityMedium: "মধ্যম",
  qualityMediumDesc: "আকার ও মানের ভালো ভারসাম্য",
  qualityHigh: "উচ্চ মান",
  qualityHighDesc: "সামান্য আকার হ্রাস, সেরা মান",
  compressionComplete: "কম্প্রেশন সম্পন্ন",
  original: "মূল",
  compressed: "কম্প্রেসড",
  saved: "সাশ্রয়",
  downloadCompressed: "কম্প্রেসড পিডিএফ ডাউনলোড করুন",
  compressAnother: "আরেকটি কম্প্রেস করুন",
  alreadyOptimized: "ফাইল ইতিমধ্যে অপটিমাইজড",
  alreadyOptimizedDesc: "এই পিডিএফটি আরও কমানো সম্ভব হয়নি — এটি ইতিমধ্যে ভালোভাবে কম্প্রেসড। শক্তিশালী কম্প্রেশন চেষ্টা করুন।",
  afterCompression: "কম্প্রেশনের পরে",
  tryAnotherFile: "অন্য ফাইল চেষ্টা করুন",
  tryStronger: "শক্তিশালী কম্প্রেশন চেষ্টা করুন",
  compressing: "কম্প্রেস হচ্ছে...",
  compressBtn: "পিডিএফ কম্প্রেস করুন",
  invalidFileType: "ভুল ফাইলের ধরন",
  invalidFileTypePdfJpgPng: "শুধু PDF, JPG এবং PNG ফাইল সাপোর্টেড।",
  invalidFileTypeJpgPng: "শুধু JPG এবং PNG ছবি সাপোর্টেড।",
  invalidFileTypePdf: "অনুগ্রহ করে একটি PDF ফাইল আপলোড করুন।",
  moreFilesNeeded: "আরও ফাইল দরকার",
  moreFilesDesc: "মার্জ করতে কমপক্ষে ২টি ফাইল আপলোড করুন।",
  success: "সফল",
  mergeSuccessDesc: "ফাইলগুলো সফলভাবে মার্জ হয়েছে। ডাউনলোড শুরু হয়েছে।",
  mergeFailed: "মার্জ ব্যর্থ",
  convertedToast: (n) => `${n}টি ছবি পিডিএফে রূপান্তরিত হয়েছে।`,
  conversionFailed: "রূপান্তর ব্যর্থ",
  doneToast: "সম্পন্ন!",
  splitAllToastDesc: (n) => `${n}টি পৃষ্ঠা ZIP ফাইলে সংরক্ষিত হয়েছে।`,
  splitRangeToastDesc: (from, to) => `পৃষ্ঠা ${from}–${to} পিডিএফে বের করা হয়েছে।`,
  splitFailed: "বিভক্ত ব্যর্থ",
  compressFailed: "কম্প্রেশন ব্যর্থ",
  pdfToJpgTitle: "পিডিএফ থেকে JPG",
  pdfToJpgSubtitle: "প্রতিটি পিডিএফ পৃষ্ঠাকে উচ্চমানের JPG ছবিতে রূপান্তর করুন।",
  pdfToJpgDrop: "পিডিএফ এখানে টেনে আনুন",
  pdfToJpgDropSub: "শুধু PDF — বা ক্লিক করে ব্রাউজ করুন",
  convertToJpg: "JPG-তে রূপান্তর করুন",
  convertingToJpg: "রূপান্তর হচ্ছে...",
  pdfToJpgSuccess: (n) => `${n}টি পৃষ্ঠা সফলভাবে রূপান্তরিত হয়েছে`,
  pdfToJpgAnother: "আরেকটি রূপান্তর করুন",
  downloadAll: "সব ZIP হিসেবে ডাউনলোড করুন",
  downloadPage: (n) => `পৃষ্ঠা ${n} ডাউনলোড করুন`,
  pdfToJpgFailed: "রূপান্তর ব্যর্থ",
  pdfToJpgPage: (n) => `পৃষ্ঠা ${n}`,
};

const translations: Record<Lang, Translations> = { en, bn };

interface LangContextType {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  t: en,
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("pdf-tools-lang");
      if (saved === "en" || saved === "bn") return saved;
    } catch {}
    return "en";
  });

  useEffect(() => {
    try {
      localStorage.setItem("pdf-tools-lang", lang);
    } catch {}
  }, [lang]);

  const toggleLang = () => setLang((l) => (l === "en" ? "bn" : "en"));

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LangContext);
}
