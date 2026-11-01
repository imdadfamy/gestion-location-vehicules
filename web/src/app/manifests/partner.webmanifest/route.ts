/** Application installable de l'espace partenaire : s'ouvre sur le tableau de bord. */
export function GET() {
  return Response.json(
    {
      name: 'FIMA AUTO – Espace partenaire',
      short_name: 'FIMA AUTO',
      description: 'Vos véhicules, locations et revenus FIMA AUTO.',
      start_url: '/partner',
      scope: '/',
      display: 'standalone',
      background_color: '#06232b',
      theme_color: '#06232b',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
