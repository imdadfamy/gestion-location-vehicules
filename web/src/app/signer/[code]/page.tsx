import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ContractSigning } from '@/components/signing/contract-signing';

// Page privée : le code du lien ne doit être ni indexé ni transmis en en-tête Referer.
export const metadata: Metadata = {
  title: 'Signature du contrat',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

async function Signing({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ContractSigning code={code} />;
}

export default function SignerPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense>
      <Signing params={params} />
    </Suspense>
  );
}
