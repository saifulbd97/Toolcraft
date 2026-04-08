import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Layers,
  ImagePlus,
  FileImage,
  Scissors,
  FileArchive,
} from "lucide-react";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDFs and images into one document.",
    icon: Layers,
    href: "/merge",
    color: "bg-indigo-500",
    lightColor: "bg-indigo-50",
    textColor: "text-indigo-600",
    borderColor: "hover:border-indigo-200",
    shadowColor: "hover:shadow-indigo-100",
  },
  {
    title: "JPG to PDF",
    description: "Convert JPG, PNG images into a PDF document.",
    icon: ImagePlus,
    href: "/jpg-to-pdf",
    color: "bg-orange-500",
    lightColor: "bg-orange-50",
    textColor: "text-orange-600",
    borderColor: "hover:border-orange-200",
    shadowColor: "hover:shadow-orange-100",
  },
  {
    title: "PDF to JPG",
    description: "Extract pages from a PDF as high-quality images.",
    icon: FileImage,
    href: "/pdf-to-jpg",
    color: "bg-emerald-500",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "hover:border-emerald-200",
    shadowColor: "hover:shadow-emerald-100",
  },
  {
    title: "Split PDF",
    description: "Separate a PDF into individual pages or ranges.",
    icon: Scissors,
    href: "/split",
    color: "bg-purple-500",
    lightColor: "bg-purple-50",
    textColor: "text-purple-600",
    borderColor: "hover:border-purple-200",
    shadowColor: "hover:shadow-purple-100",
  },
  {
    title: "Compress PDF",
    description: "Reduce PDF file size while keeping quality high.",
    icon: FileArchive,
    href: "/compress",
    color: "bg-sky-500",
    lightColor: "bg-sky-50",
    textColor: "text-sky-600",
    borderColor: "hover:border-sky-200",
    shadowColor: "hover:shadow-sky-100",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function Dashboard() {
  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            PDF Tools
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Everything you need to work with PDFs — free, fast, and easy to use.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.div key={tool.href} variants={cardVariants}>
                <Link href={tool.href}>
                  <div
                    className={`group relative bg-card border border-border rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${tool.borderColor} ${tool.shadowColor}`}
                    data-testid={`card-tool-${tool.href.replace("/", "")}`}
                  >
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${tool.lightColor} ${tool.textColor} mb-5 transition-transform duration-200 group-hover:scale-110`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground mb-1.5">
                      {tool.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                    <div className={`absolute bottom-0 left-0 h-0.5 w-0 rounded-b-2xl ${tool.color} transition-all duration-300 group-hover:w-full`} />
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
