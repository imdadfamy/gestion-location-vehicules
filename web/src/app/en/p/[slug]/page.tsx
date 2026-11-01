import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HomeView } from '@/components/site/home-view';
import { Skeleton } from '@/components/ui/skeleton';
import { getPage } from '@/lib/data/site-content-server';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug, 'en');
  if (!page) return {};
  return { title: page.title || undefined, description: page.description || undefined };
}

async function PublishedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug, 'en');
  if (!page) notFound();
  return <HomeView blocks={page.blocks} lang="en" />;
}

/** Page supplémentaire du site, version anglaise (le contenu reste celui enregistré tant qu'il n'est pas traduit). */
export default function EnglishCustomPage(props: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-svh w-full rounded-none" />}>
      <PublishedPage params={props.params} />
    </Suspense>
  );
}
