import { motion } from "framer-motion";
import { Mail, MapPin } from "lucide-react";

export default function About() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-20">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {/* Profile photo */}
        <div className="flex justify-center mb-6">
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-indigo-100 shadow-lg">
            <img
              src={`${base}/profile.jpg`}
              alt="Mohammad Siful Islam"
              className="w-full h-full object-cover object-top"
            />
          </div>
        </div>

        {/* Name */}
        <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
          Mohammad Siful Islam
        </h1>
        <p className="text-sm text-indigo-500 font-medium mb-6">Creator of Toolcraft</p>

        {/* Divider */}
        <div className="h-px bg-border mx-auto w-16 mb-6" />

        {/* Info rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
            <a
              href="mailto:saifulbd97@gmail.com"
              className="hover:text-indigo-600 transition-colors"
            >
              saifulbd97@gmail.com
            </a>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Bangladesh</span>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
          Building free, fast, and privacy-friendly tools so everyone can work smarter — no sign-up required.
        </p>
      </motion.div>
    </div>
  );
}
