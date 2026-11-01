'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { localHref, localeOf, pluralize, translator, type Lang, type Translate } from '@/lib/i18n';

type LangContextValue = {
  lang: Lang;
  t: Translate;
  locale: string;
  plural: (count: number, one: string, many: string) => string;
  href: (path: string) => string;
};

const make = (lang: Lang): LangContextValue => ({
  lang,
  t: translator(lang),
  locale: localeOf(lang),
  plural: (count, one, many) => pluralize(lang, count, one, many),
  href: (path) => localHref(lang, path),
});

const LangContext = createContext<LangContextValue>(make('fr'));

/** Langue du site public pour les composants client (français par défaut, anglais sous `/en`). */
export const useLang = () => useContext(LangContext);

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => make(lang), [lang]);
  // L'élément <html> est commun à tout le site : sa langue suit la page affichée.
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'fr';
    };
  }, [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
