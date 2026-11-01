import { getMenuContent, getSettings } from '@/lib/data/site-content-server';
import type { Lang } from '@/lib/i18n';
import type { Announcement, Link } from '@/lib/data/site-content';
import { SiteHeaderView } from './site-header-view';

/** En-tête du site public ; menu et bandeau d'annonce modifiables depuis « Site web » (props : brouillons pour l'aperçu). */
export async function SiteHeader({ overHero = false, links, announcement, lang = 'fr' }: { overHero?: boolean; links?: Link[]; announcement?: Announcement; lang?: Lang }) {
  const [menu, settings] = await Promise.all([links ? null : getMenuContent(lang), announcement ? null : getSettings(lang)]);
  return <SiteHeaderView overHero={overHero} links={links ?? menu!.links} announcement={announcement ?? settings!.announcement} />;
}
