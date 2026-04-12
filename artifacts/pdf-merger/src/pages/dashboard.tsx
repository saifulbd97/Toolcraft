import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layers, ImagePlus, FileImage, Scissors, FileArchive, PenLine, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

const toolKeys = ["merge", "jpgToPdf", "pdfToJpg", "split", "compress", "sign"] as const;

const toolMeta = {
  merge:    { icon: Layers,      href: "/pdf/merge",      color: "bg-indigo-500",  lightColor: "bg-indigo-50",  textColor: "text-indigo-600",  borderColor: "hover:border-indigo-200",  shadowColor: "hover:shadow-indigo-100" },
  jpgToPdf: { icon: ImagePlus,   href: "/pdf/jpg-to-pdf", color: "bg-orange-500",  lightColor: "bg-orange-50",  textColor: "text-orange-600",  borderColor: "hover:border-orange-200",  shadowColor: "hover:shadow-orange-100" },
  pdfToJpg: { icon: FileImage,   href: "/pdf/pdf-to-jpg", color: "bg-emerald-500", lightColor: "bg-emerald-50", textColor: "text-emerald-600", borderColor: "hover:border-emerald-200", shadowColor: "hover:shadow-emerald-100" },
  split:    { icon: Scissors,    href: "/pdf/split",      color: "bg-purple-500",  lightColor: "bg-purple-50",  textColor: "text-purple-600",  borderColor: "hover:border-purple-200",  shadowColor: "hover:shadow-purple-100" },
  compress: { icon: FileArchive, href: "/pdf/compress",   color: "bg-sky-500",     lightColor: "bg-sky-50",     textColor: "text-sky-600",     borderColor: "hover:border-sky-200",     shadowColor: "hover:shadow-sky-100" },
  sign:     { icon: PenLine,     href: "/pdf/sign",       color: "bg-rose-500",    lightColor: "bg-rose-50",    textColor: "text-rose-600",    borderColor: "hover:border-rose-200",    shadowColor: "hover:shadow-rose-100" },
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="mb-10">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />{t.backToHome}
            </Button>
          </Link>
        </div>

        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            {t.dashTitle}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {t.dashSubtitle}
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {toolKeys.map((key) => {
            const meta = toolMeta[key];
            const Icon = meta.icon;
            const tool = t.tools[key];
            return (
              <motion.div key={meta.href} variants={cardVariants}>
                <Link href={meta.href}>
                  <div
                    className={`group relative bg-card border border-border rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${meta.borderColor} ${meta.shadowColor}`}
                    data-testid={`card-tool-${key}`}
                  >
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${meta.lightColor} ${meta.textColor} mb-5 transition-transform duration-200 group-hover:scale-110`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground mb-1.5">{tool.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
                    <div className={`absolute bottom-0 left-0 h-0.5 w-0 rounded-b-2xl ${meta.color} transition-all duration-300 group-hover:w-full`} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
