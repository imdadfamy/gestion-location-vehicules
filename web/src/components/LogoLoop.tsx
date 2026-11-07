import { cn } from '@/lib/utils';

export type LogoItem = { name: string; url: string };

/**
 * Bandeau de logos seuls (aucun fond ni cadre ; en mode clair, le blanc d'un logo se fond dans la page) qui défile sans fin (style React Bits « Logo Loop »), en CSS pur : fluide, sans JavaScript,
 * en pause au survol, immobile si la personne a demandé moins d'animations. Le jeu de logos est répété jusqu'à
 * remplir la largeur, puis la piste entière est doublée pour que la boucle soit invisible.
 */
export default function LogoLoop({ logos, speed = 40, className }: { logos: LogoItem[]; speed?: number; className?: string }) {
  if (!logos.length) return null;
  const copies = Math.max(1, Math.ceil(8 / logos.length));
  const group = Array.from({ length: copies }, () => logos).flat();
  // Durée proportionnelle à la longueur de la piste, pour une vitesse constante quel que soit le nombre de logos.
  const duration = Math.max(12, (group.length * 176) / speed);
  return (
    <div
      className={cn('logo-loop relative overflow-hidden', className)}
      style={{ '--logo-loop-duration': `${duration}s` } as React.CSSProperties}
    >
      <ul className="logo-loop-track flex w-max items-center mix-blend-multiply dark:mix-blend-normal">
        {[0, 1].map((round) =>
          group.map((logo, i) => (
            <li key={`${round}-${i}`} aria-hidden={round === 1 || undefined} className="flex h-20 w-44 shrink-0 items-center justify-center px-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.url} alt={round === 0 ? logo.name : ''} title={logo.name} loading="lazy" className="max-h-14 max-w-full object-contain" />
            </li>
          )),
        )}
      </ul>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
