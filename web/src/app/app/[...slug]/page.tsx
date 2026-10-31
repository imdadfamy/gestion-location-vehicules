import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Construction } from 'lucide-react';
import { requireModule } from '@/components/staff/require-module';
import { ALL_ITEMS } from '@/components/staff/staff-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Params = Promise<{ slug: string[] }>;

const itemFor = async (params: Params) => {
  const { slug } = await params;
  return ALL_ITEMS.find((entry) => entry.href === `/app/${slug.join('/')}`);
};

export async function generateMetadata({ params }: { params: Params }) {
  return { title: (await itemFor(params))?.title };
}

async function Pending({ params }: { params: Params }) {
  const item = await itemFor(params);
  if (!item) notFound();
  await requireModule(item);
  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Construction className="size-5" />
        </div>
        <CardTitle>{item.title}</CardTitle>
        <CardDescription>
          Cet écran est en cours de migration vers la nouvelle interface. Il reste disponible dans l’application
          actuelle en attendant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link href="/app">
            <ArrowLeft /> Tableau de bord
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Écrans du menu pas encore migrés vers la nouvelle interface (les autres adresses → 404). */
export default function PendingModule({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-6 h-48 max-w-xl rounded-xl" />}>
      <Pending params={params} />
    </Suspense>
  );
}
