import { NextResponse } from 'next/server';

/**
 * Pays du visiteur d'après son adresse IP, sans service tiers : Vercel l'indique dans l'en-tête
 * `x-vercel-ip-country` (code ISO à deux lettres). Rien n'est enregistré ; en local ou hors Vercel
 * l'en-tête est absent et `country` vaut null.
 */
export function GET(request: Request) {
  const country = request.headers.get('x-vercel-ip-country');
  return NextResponse.json({ country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null }, { headers: { 'Cache-Control': 'no-store' } });
}
