'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useLang } from './lang-provider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLang();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('Basculer le mode clair / sombre')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
