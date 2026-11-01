/** Application installable de l'espace client : s'ouvre sur « Mon espace ». */
export function GET() {
  return Response.json(
    {
      name: 'FIMA AUTO – Mon espace',
      short_name: 'FIMA AUTO',
      description: 'Vos réservations, contrats et inspections FIMA AUTO.',
      start_url: '/client',
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
