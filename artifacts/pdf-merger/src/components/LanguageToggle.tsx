import { useTranslation } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, t, toggleLang } = useTranslation();
  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur-sm px-3.5 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
      aria-label="Toggle language"
      data-testid="lang-toggle"
    >
      <span className={lang === "en" ? "text-foreground font-semibold" : "text-muted-foreground"}>EN</span>
      <span className="text-muted-foreground">|</span>
      <span className={lang === "bn" ? "text-foreground font-semibold" : "text-muted-foreground"}>বাংলা</span>
    </button>
  );
}
