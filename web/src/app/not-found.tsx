import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Page introuvable' };

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">Erreur 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        L’adresse demandée n’existe pas ou a été déplacée.
      </p>
      <Button asChild>
        <Link href="/">Retour à l’accueil</Link>
      </Button>
    </main>
  );
}
