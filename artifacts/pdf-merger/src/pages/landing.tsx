import { Link } from "wouter";
import { motion } from "framer-motion";
import { FileText, ScanLine, Calculator, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface CategoryCard {
  key: string;
  icon: React.ElementType;
  href: string;
  color: string;
  lightColor: string;
  textColor: string;
  borderHover: string;
  shadowHover: string;
  barColor: string;
  available: boolean;
}

const categories: CategoryCard[] = [
  {
    key: "pdfTools",
    icon: FileText,
    href: "/pdf",
    color: "bg-indigo-500",
    lightColor: "bg-indigo-50",
    textColor: "text-indigo-600",
    borderHover: "hover:border-indigo-200",
    shadowHover: "hover:shadow-indigo-100",
    barColor: "bg-indigo-500",
    available: true,
  },
  {
    key: "scanner",
    icon: ScanLine,
    href: "/scanner",
    color: "bg-amber-500",
    lightColor: "bg-amber-50",
    textColor: "text-amber-600",
    borderHover: "hover:border-amber-200",
    shadowHover: "hover:shadow-amber-100",
    barColor: "bg-amber-500",
    available: true,
  },
  {
    key: "incomeCalc",
    icon: Calculator,
    href: "/income",
    color: "bg-emerald-500",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderHover: "hover:border-emerald-200",
    shadowHover: "hover:shadow-emerald-100",
    barColor: "bg-emerald-500",
    available: true,
  },
];

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            {t.homeTagline}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-5 leading-tight">
            {t.homeTitle}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t.homeSubtitle}
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            const info = t.categories[cat.key as keyof typeof t.categories];
            return (
              <motion.div key={cat.key} variants={cardVariants}>
                {cat.available ? (
                  <Link href={cat.href}>
                    <div
                      className={`group relative bg-card border border-border rounded-2xl p-7 cursor-pointer transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl ${cat.borderHover} ${cat.shadowHover} h-full`}
                      data-testid={`card-category-${cat.key}`}
                    >
                      <CategoryCardContent cat={cat} Icon={Icon} info={info} />
                    </div>
                  </Link>
                ) : (
                  <div
                    className={`group relative bg-card border border-border rounded-2xl p-7 cursor-default opacity-80 h-full`}
                    data-testid={`card-category-${cat.key}`}
                  >
                    <CategoryCardContent cat={cat} Icon={Icon} info={info} comingSoon />
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <motion.p
          className="text-center text-sm text-muted-foreground mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          {t.homeFootnote}
        </motion.p>
      </div>
    </div>
  );
}

interface CardContentProps {
  cat: CategoryCard;
  Icon: React.ElementType;
  info: { title: string; description: string; tools: string[] };
  comingSoon?: boolean;
}

function CategoryCardContent({ cat, Icon, info, comingSoon }: CardContentProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${cat.lightColor} ${cat.textColor} transition-transform duration-200 group-hover:scale-110`}>
          <Icon className="w-7 h-7" />
        </div>
        {comingSoon ? (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded-full border border-border">
            {t.comingSoon}
          </span>
        ) : (
          <ArrowRight className={`w-5 h-5 ${cat.textColor} opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5`} />
        )}
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-2">{info.title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{info.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {info.tools.map((tool) => (
          <span key={tool} className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${cat.lightColor} ${cat.textColor}`}>
            {tool}
          </span>
        ))}
      </div>

      <div className={`absolute bottom-0 left-0 h-0.5 w-0 rounded-b-2xl ${cat.barColor} transition-all duration-300 group-hover:w-full`} />
    </>
  );
}
