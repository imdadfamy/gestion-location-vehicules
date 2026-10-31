import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import BlurText from '@/components/BlurText';

/** Mise en page des écrans de connexion : visuel de marque à gauche, formulaire à droite. */
export function AuthShell({
  image,
  eyebrow,
  title,
  text,
  points,
  children,
}: {
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  points?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#06232b] text-white lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06232b] via-[#06232b]/60 to-[#06232b]/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="size-4" /> Retour à l’accueil
          </Link>
          <div className="max-w-md">
            <p className="text-sm font-medium tracking-widest text-[#5fd3df] uppercase">{eyebrow}</p>
            <BlurText
              text={title}
              animateBy="words"
              delay={60}
              className="mt-3 text-4xl font-semibold tracking-tight"
            />
            <p className="mt-3 text-white/75">{text}</p>
            {points && (
              <ul className="mt-6 space-y-2 text-sm text-white/80">
                {points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#5fd3df]" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="FIMA AUTO" className="h-8 w-auto self-start" />
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex w-full max-w-sm items-center justify-between lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" /> Accueil
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-color.png" alt="FIMA AUTO" className="h-7 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="FIMA AUTO" className="hidden h-7 w-auto dark:block" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
