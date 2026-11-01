import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { HomeView } from '@/components/site/home-view';
import { Skeleton } from '@/components/ui/skeleton';
import { can, isStaff } from '@/lib/auth';
import { footerContent, homeContent } from '@/lib/data/site-content';
import { sessionProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Aperçu du site', robots: { index: false, follow: false } };

/** Le site tel qu'il sera après publication : brouillons en cours, à défaut le contenu publié. */
async function Preview() {
  const profile = await sessionProfile();
  if (!profile || !isStaff(profile.role) || !can(profile, 'website')) redirect('/login');
  const db = await createClient();
  const [published, drafts] = await Promise.all([
    db.from('site_content').select('key,content'),
    db.from('site_content_drafts').select('key,content'),
  ]);
  const pick = (key: string) =>
    drafts.data?.find((row) => row.key === key)?.content ?? published.data?.find((row) => row.key === key)?.content ?? null;
  return (
    <>
      <p className="fixed top-2 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-xs font-medium text-amber-950 shadow">
        Aperçu — non publié
      </p>
      <HomeView blocks={homeContent(pick('home')).blocks} footer={footerContent(pick('footer'))} />
    </>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-svh w-full rounded-none" />}>
      <Preview />
    </Suspense>
  );
}
