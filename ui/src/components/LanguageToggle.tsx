import cn from "classnames";
import { useLanguage, type AppLanguage } from "../i18n";
import "./LanguageToggle.scss";

export type LanguageToggleProps = {
  compact?: boolean;
  className?: string;
};

const LANGUAGES: ReadonlyArray<{
  code: AppLanguage;
  shortLabel: string;
  title: string;
}> = [
  { code: "pt", shortLabel: "PT", title: "Português (Brasil)" },
  { code: "en", shortLabel: "EN", title: "English" },
];

export default function LanguageToggle({
  compact = false,
  className,
}: LanguageToggleProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className={cn(
        "language-toggle",
        { "language-toggle--compact": compact },
        className
      )}
      role="group"
      aria-label={t("Selecionar idioma", "Select language")}
    >
      <span className="language-toggle__globe" aria-hidden="true">
        🌐
      </span>
      {LANGUAGES.map((entry) => {
        const active = language === entry.code;
        return (
          <button
            key={entry.code}
            type="button"
            className={cn("language-toggle__btn", { "is-active": active })}
            aria-pressed={active}
            title={entry.title}
            onClick={() => setLanguage(entry.code)}
          >
            {entry.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
