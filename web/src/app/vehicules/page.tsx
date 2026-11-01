import type { Metadata } from 'next';
import { CatalogLead } from '@/components/site/catalog-lead';
import { HomeView } from '@/components/site/home-view';
import { getCatalogPage } from '@/lib/data/site-content-server';

export const metadata: Metadata = {
  title: 'Véhicules disponibles',
  description: 'Choisissez vos dates pour voir les véhicules FIMA AUTO réellement disponibles.',
};

export default async function VehiclesPage() {
  const content = await getCatalogPage();
  return <HomeView blocks={content.blocks} lead={<CatalogLead content={content} />} />;
}
