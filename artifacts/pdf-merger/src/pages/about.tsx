import { motion } from "framer-motion";
import { Mail, MapPin } from "lucide-react";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

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
              alt="Mohammad Saiful Islam"
              className="w-full h-full object-cover object-top"
            />
          </div>
        </div>

        {/* Name & tagline */}
        <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
          Mohammad Saiful Islam
        </h1>
        <p className="text-sm text-indigo-500 font-medium mb-6">Creator of Toolcraft</p>

        <div className="h-px bg-border mx-auto w-16 mb-6" />

        {/* Info rows */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Bangladesh</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
            <a
              href="mailto:saifulbd97@gmail.com"
              className="hover:text-indigo-600 transition-colors"
            >
              saifulbd97@gmail.com
            </a>
          </div>
        </div>

        <div className="h-px bg-border mx-auto w-16 mb-6" />

        {/* Social links */}
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://www.facebook.com/saifulbd95"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors text-sm font-medium"
            aria-label="Facebook"
          >
            <FacebookIcon className="w-4 h-4 shrink-0" />
            Facebook
          </a>
          <a
            href="https://youtube.com/@visionsofeurope"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF0000]/10 text-[#FF0000] hover:bg-[#FF0000]/20 transition-colors text-sm font-medium"
            aria-label="YouTube"
          >
            <YouTubeIcon className="w-4 h-4 shrink-0" />
            YouTube
          </a>
        </div>

        {/* Bio */}
        <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
          Building free, fast, and privacy-friendly tools so everyone can work smarter — no sign-up required.
        </p>
      </motion.div>
    </div>
  );
}
