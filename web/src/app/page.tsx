/** Page `/` — accueil du site public en français (catalogue, transfert aéroport, contenu éditable depuis « Site web »). */
import type { Metadata } from 'next';
import { HomeView } from '@/components/site/home-view';
import { getHomeContent } from '@/lib/data/site-content-server';

export const metadata: Metadata = { alternates: { canonical: '/', languages: { fr: '/', en: '/en' } } };

export default async function HomePage() {
  const content = await getHomeContent();
  return <HomeView blocks={content.blocks} />;
}
