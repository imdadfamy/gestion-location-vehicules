'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { itemFor } from './staff-menu';

/** En-tête du back-office : bouton de menu, thème et cloche de notifications. */
export function StaffHeader({ unread, showNotifications }: { unread: number; showNotifications: boolean }) {
  const title = itemFor(usePathname())?.title ?? 'Espace de gestion';
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" aria-label="Afficher ou masquer le menu" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-1">
        {showNotifications && (
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/app/notifications" aria-label={`Notifications (${unread} non lues)`}>
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Link>
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
