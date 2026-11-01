'use client';

import { usePathname } from 'next/navigation';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { switchedPath } from '@/lib/i18n';
import { useLang } from './lang-provider';

/** Bascule français ↔ anglais en restant sur la même page (recherche et ancre conservées). */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, t } = useLang();
  const pathname = usePathname();
  const target = lang === 'en' ? 'fr' : 'en';
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      aria-label={t('Changer de langue')}
      // Rechargement complet : la page de l'autre langue remplace l'ancienne (pas de doublon d'ancres en mémoire).
      onClick={() => window.location.assign(`${switchedPath(pathname, target)}${window.location.search}${window.location.hash}`)}
    >
      <Languages className="size-4" /> {target === 'en' ? 'EN' : 'FR'}
    </Button>
  );
}
