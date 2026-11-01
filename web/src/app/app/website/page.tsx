import { Suspense } from 'react';
import { requireModule } from '@/components/staff/require-module';
import { WebsiteEditor } from '@/components/staff/website/website-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Site web' };

async function Website() {
  const profile = await requireModule({ module: 'website' });
  return <WebsiteEditor canEdit={can(profile, 'website', 'update')} canDelete={can(profile, 'website', 'delete')} />;
}

export default function WebsitePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-4xl rounded-xl" />}>
      <Website />
    </Suspense>
  );
}
