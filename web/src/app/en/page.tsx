/** Page `/en` — accueil du site public en anglais (même contenu, textes traduits par `lib/i18n-en.ts`). */
import type { Metadata } from 'next';
import { HomeView } from '@/components/site/home-view';
import { getHomeContent } from '@/lib/data/site-content-server';

export const metadata: Metadata = { alternates: { canonical: '/en', languages: { fr: '/', en: '/en' } } };

export default async function EnglishHomePage() {
  const content = await getHomeContent('en');
  return <HomeView blocks={content.blocks} lang="en" />;
}
