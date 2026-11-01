import type { MetadataRoute } from 'next';

/** Permet d'installer le back-office sur l'écran d'accueil du téléphone (requis par l'iPhone pour les alertes). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FIMA AUTO – Espace de gestion',
    short_name: 'FIMA AUTO',
    description: 'Réservations, transferts et locations FIMA AUTO.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#06232b',
    theme_color: '#06232b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
