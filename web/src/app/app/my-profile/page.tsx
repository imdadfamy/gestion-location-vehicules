import { Suspense } from 'react';
import { MyProfileForm } from '@/components/staff/my-profile-form';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata = { title: 'Mes informations' };

/** Ancien nom complet découpé en prénom / nom quand les champs dédiés sont vides. */
function fallbackParts(fullName: string | null) {
  const text = (fullName ?? '').includes('@') ? '' : (fullName ?? '').trim();
  const parts = text.split(/\s+/).filter(Boolean);
  return { first: parts.shift() ?? '', last: parts.join(' ') };
}

async function MyProfile() {
  const profile = await sessionProfile();
  if (!profile) return null;
  const parts = fallbackParts(profile.full_name);
  return (
    <MyProfileForm
      profileId={profile.id}
      role={profile.role}
      initial={{
        first_name: profile.first_name ?? parts.first,
        last_name: profile.last_name ?? parts.last,
        email: profile.email ?? '',
      }}
    />
  );
}

export default function MyProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 w-full max-w-2xl rounded-xl" />}>
      <MyProfile />
    </Suspense>
  );
}
