import { getMenuContent } from '@/lib/data/site-content-server';
import type { Link } from '@/lib/data/site-content';
import { SiteHeaderView } from './site-header-view';

/** En-tête du site public ; le menu est modifiable depuis « Site web » (`links` : menu en brouillon pour l'aperçu). */
export async function SiteHeader({ overHero = false, links }: { overHero?: boolean; links?: Link[] }) {
  return <SiteHeaderView overHero={overHero} links={links ?? (await getMenuContent()).links} />;
}
