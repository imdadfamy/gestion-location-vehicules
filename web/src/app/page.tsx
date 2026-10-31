import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  FileSignature,
  Handshake,
  KeyRound,
  LineChart,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Suspense, cache } from 'react';
import AnimatedContent from '@/components/AnimatedContent';
import SpotlightCard from '@/components/SpotlightCard';
import { Hero } from '@/components/site/hero';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { VehicleCard } from '@/components/site/vehicle-card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { availableVehicles, companyContact, whatsappLink } from '@/lib/data/public-catalog';
import { createClient } from '@/lib/supabase/server';

const strengths = [
  { icon: <FileSignature />, title: 'Contrat en ligne', text: 'Signature simple et sécurisée, directement à l’écran.' },
  { icon: <ShieldCheck />, title: 'Véhicules contrôlés', text: 'Inspectés avant chaque location, photos à l’appui.' },
  { icon: <ReceiptText />, title: 'Prix clairs', text: 'Tarif, caution et total affichés avant de réserver.' },
  { icon: <MessageCircle />, title: 'Assistance WhatsApp', text: 'Une équipe disponible pour vous accompagner.' },
];

const steps = [
  { icon: <CalendarCheck />, title: 'Réservez', text: 'Choisissez vos dates et votre véhicule.' },
  { icon: <FileSignature />, title: 'Signez', text: 'Signez votre contrat en ligne, depuis votre espace.' },
  { icon: <KeyRound />, title: 'Récupérez', text: 'Inspection de départ, puis partez sereinement.' },
];

const faq = [
  ['Quels documents fournir ?', 'Une pièce d’identité et un permis de conduire valides.'],
  ['Comment fonctionne la caution ?', 'Son montant est affiché avant la réservation. Elle est restituée au retour, déduction faite d’éventuels dommages constatés.'],
  ['Puis-je annuler ?', 'Tant que votre réservation est en attente, vous pouvez l’annuler depuis votre espace. Ensuite, contactez l’agence.'],
  ['Le carburant est-il inclus ?', 'Le niveau de carburant est relevé à l’inspection de départ et indiqué au contrat.'],
  ['Y a-t-il un âge minimum ?', 'Les conditions sont précisées lors de la réservation.'],
  ['Livrez-vous le véhicule ?', 'Contactez l’agence pour connaître les options de livraison disponibles selon votre zone.'],
];

const partnerSteps = [
  { title: 'Proposez', text: 'Photos, conditions et prix souhaité.' },
  { title: 'On évalue', text: 'Prix et état du véhicule vérifiés.' },
  { title: 'Vous touchez vos revenus', text: 'À chaque location, avec un suivi automatique.' },
];

const partnerBenefits = [
  { icon: <LineChart />, title: 'Revenu sans effort', text: 'Vous fixez votre prix, on gère le reste.' },
  { icon: <Handshake />, title: 'Contrats pris en charge', text: 'Signatures et formalités gérées par nous.' },
  { icon: <Wrench />, title: 'Vous gardez le contrôle', text: 'Déclarez une maintenance à tout moment.' },
  { icon: <BadgeCheck />, title: 'Suivi en temps réel', text: 'Vos locations et revenus dans votre espace.' },
];

const partnerFaq = [
  ['Comment est fixé le prix final ?', 'Vous indiquez le prix que vous souhaitez toucher ; nous ajoutons notre marge pour fixer le prix affiché au client.'],
  ['Comment et quand suis-je payé ?', 'Vous suivez vos locations et vos revenus directement depuis votre espace partenaire.'],
  ['Quels documents dois-je fournir ?', 'Les photos du véhicule et ses informations ; le reste est géré lors de l’évaluation.'],
  ['Puis-je retirer mon véhicule à tout moment ?', 'Oui, contactez l’agence pour toute demande de retrait.'],
];

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium tracking-widest text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-muted-foreground">{text}</p>}
    </div>
  );
}

/** Coordonnées lues une seule fois par requête, même si plusieurs blocs les affichent. */
const getCompany = cache(async () => companyContact(await createClient()));

/** Aperçu du catalogue : disponibilités lues à chaque visite. */
async function CatalogPreview() {
  const db = await createClient();
  const vehicles = await availableVehicles(db);
  const preview = vehicles.data.slice(0, 6);
  if (!preview.length)
    return (
      <p className="mt-10 text-center text-muted-foreground">
        Les véhicules disponibles s’affichent ici dès qu’ils sont publiés.
      </p>
    );
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {preview.map((vehicle, i) => (
        <AnimatedContent key={vehicle.id} distance={40} delay={(i % 3) * 0.08}>
          <VehicleCard
            vehicle={vehicle}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/vehicules?vehicule=${vehicle.id}`}>Voir</Link>
              </Button>
            }
          />
        </AnimatedContent>
      ))}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
      ))}
    </div>
  );
}

async function WhatsAppButton() {
  const company = await getCompany();
  const whatsapp = whatsappLink(company?.whatsapp_phone);
  if (!whatsapp) return null;
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
    >
      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
        <MessageCircle /> Nous contacter sur WhatsApp
      </a>
    </Button>
  );
}

async function CompanyFooter() {
  return <SiteFooter company={await getCompany()} />;
}

export default function HomePage() {
  return (
    <>
      <SiteHeader overHero />
      <main className="flex-1">
        <Hero />

        {/* Atouts : prolonge la bannière sombre */}
        <section className="bg-[#06232b] pb-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-center text-sm font-medium tracking-widest text-[#5fd3df] uppercase">
              Pourquoi FIMA AUTO
            </p>
            <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Une location simple et sans surprise
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {strengths.map((item, i) => (
                <AnimatedContent key={item.title} distance={40} delay={i * 0.08}>
                  <SpotlightCard theme="dark" spotlightColor="rgba(95, 211, 223, 0.25)" className="h-full p-6">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[#0792a4]/25 text-[#5fd3df] [&_svg]:size-5">
                      {item.icon}
                    </div>
                    <h3 className="mt-4 font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/70">{item.text}</p>
                  </SpotlightCard>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </section>

        {/* Catalogue */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionTitle eyebrow="Catalogue" title="Nos véhicules" text="Des modèles entretenus, prêts à partir." />
          <Suspense fallback={<CatalogSkeleton />}>
            <CatalogPreview />
          </Suspense>
          <div className="mt-10 text-center">
            <Button asChild size="lg">
              <Link href="/vehicules">
                Tout le catalogue <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        {/* Étapes */}
        <section id="etapes" className="scroll-mt-20 border-y bg-muted/40 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle eyebrow="Simplicité" title="Comment ça marche" />
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <AnimatedContent key={step.title} distance={30} delay={i * 0.1}>
                  <li className="relative h-full rounded-2xl border bg-card p-6">
                    <span className="text-5xl font-semibold text-primary/15">0{i + 1}</span>
                    <div className="mt-2 flex items-center gap-2 font-semibold [&_svg]:size-5 [&_svg]:text-primary">
                      {step.icon}
                      {step.title}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                  </li>
                </AnimatedContent>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow="Besoin d’aide" title="Questions fréquentes" />
          <Accordion type="single" collapsible className="mt-10">
            {faq.map(([question, answer]) => (
              <AccordionItem key={question} value={question}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Partenaires */}
        <section id="partenaires" className="scroll-mt-20 border-t bg-muted/40 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
            <AnimatedContent direction="horizontal" distance={40} reverse>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/partner-hero.jpg"
                alt="Partenaire FIMA AUTO"
                className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lg"
                loading="lazy"
              />
            </AnimatedContent>
            <div>
              <p className="text-sm font-medium tracking-widest text-primary uppercase">Devenez partenaire</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Rentabilisez votre véhicule inutilisé
              </h2>
              <p className="mt-3 text-muted-foreground">
                Proposez votre véhicule avec vos photos et le prix que vous souhaitez toucher. Nous l’évaluons, le
                publions et vous reversons votre part à chaque location.
              </p>
              <ol className="mt-6 space-y-3">
                {partnerSteps.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span>
                      <strong>{step.title}</strong>{' '}
                      <span className="text-muted-foreground">— {step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Button asChild size="lg" className="mt-8">
                <Link href="/partner/register">
                  Devenir partenaire <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-14 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {partnerBenefits.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-card p-5">
                <div className="text-primary [&_svg]:size-5">{item.icon}</div>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-14 max-w-3xl px-4">
            <h3 className="text-center text-xl font-semibold">Questions fréquentes pour les partenaires</h3>
            <Accordion type="single" collapsible className="mt-6">
              {partnerFaq.map(([question, answer]) => (
                <AccordionItem key={question} value={question}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Appel à l'action */}
        <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prêt à partir ?</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/client/register">Créer mon compte</Link>
              </Button>
              <Suspense fallback={null}>
                <WhatsAppButton />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <Suspense fallback={<SiteFooter company={null} />}>
        <CompanyFooter />
      </Suspense>
    </>
  );
}
