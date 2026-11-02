/**
 * « Comment nous avez-vous connus ? » : liste fixe des sources, partagée par l'inscription, le profil
 * du client, la demande de transfert et la fiche client de l'équipe. Les clés recoupent les canaux des
 * dépenses marketing, ce qui permet de calculer un coût d'acquisition par canal.
 */
export const ACQUISITION_SOURCES: { value: string; label: string }[] = [
  { value: 'ads', label: 'Une publicité en ligne (Facebook, Instagram, TikTok…)' },
  { value: 'influencer', label: 'Un influenceur' },
  { value: 'word_of_mouth', label: 'Un proche (bouche-à-oreille)' },
  { value: 'search', label: 'Une recherche sur Internet' },
  { value: 'print', label: 'Une affiche ou un flyer' },
  { value: 'event', label: 'Un événement' },
  { value: 'sponsoring', label: 'Un partenariat ou un sponsoring' },
  { value: 'walk_in', label: 'Je suis passé devant l’agence' },
  { value: 'partner', label: 'Un partenaire de FIMA AUTO' },
  { value: 'other', label: 'Autre' },
];

export const sourceLabel = (value: string | null | undefined) => ACQUISITION_SOURCES.find((source) => source.value === value)?.label ?? 'Non renseigné';
