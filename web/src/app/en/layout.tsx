import type { Metadata } from 'next';
import { LangProvider } from '@/components/site/lang-provider';
import { getSettings } from '@/lib/data/site-content-server';

/** Titre et description anglais (référencement) ; le titre enregistré en français reste tel quel s'il a été personnalisé. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings('en');
  return {
    title: { absolute: settings.title },
    description: settings.description,
    openGraph: { title: settings.title, description: settings.description, images: ['/logo.jpg'], locale: 'en_GB' },
  };
}

/** Site public en anglais (`/en`) : mêmes pages et composants, textes en anglais. */
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <LangProvider lang="en">{children}</LangProvider>;
}
