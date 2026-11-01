import Link from 'next/link';
import { ArrowRight, MessageCircle, Quote } from 'lucide-react';
import { Suspense, cache } from 'react';
import AnimatedContent from '@/components/AnimatedContent';
import SpotlightCard from '@/components/SpotlightCard';
import { Hero } from '@/components/site/hero';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SiteIcon } from '@/components/site/site-icon';
import { CatalogView } from '@/components/site/catalog-view';
import { TransferSection } from '@/components/site/transfer-section';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { companyContact, whatsappLink } from '@/lib/data/public-catalog';
import { safeHref, youtubeEmbed, type Block, type BlockData, type Faq, type FooterContent, type Link as MenuLink, type Announcement } from '@/lib/data/site-content';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

function SectionTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-medium tracking-widest text-primary uppercase">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-muted-foreground">{text}</p>}
    </div>
  );
}

function FaqList({ items }: { items: Faq[] }) {
  return (
    <Accordion type="single" collapsible className="mt-8 rounded-2xl border bg-card px-5">
      {items.map(({ q, a }, index) => (
        <AccordionItem key={index} value={`faq-${index}`} className="last:border-b-0">
          <AccordionTrigger>{q}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** Coordonnées lues une seule fois par requête, même si plusieurs blocs les affichent. */
const getCompany = cache(async () => companyContact(await createClient()));

/** Le catalogue filtrable (le même que celui de la page Véhicules), avec le numéro WhatsApp de l'agence. */
async function Catalog({ count }: { count: number }) {
  const company = await getCompany();
  return <CatalogView whatsappPhone={company?.whatsapp_phone} pageSize={Math.max(1, count)} />;
}

/** Transfert aéroport, avec le numéro WhatsApp de l'agence pour envoyer la demande. */
async function Transfer({ content, anchor }: { content: BlockData['transfer']; anchor: boolean }) {
  const company = await getCompany();
  return <TransferSection content={content} whatsappPhone={company?.whatsapp_phone} anchor={anchor} />;
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

/** Bouton WhatsApp flottant : une question à poser, sans quitter la page. */
async function FloatingWhatsApp() {
  const company = await getCompany();
  const whatsapp = whatsappLink(company?.whatsapp_phone);
  if (!whatsapp) return null;
  return (
    <a
      href={whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Écrire sur WhatsApp"
      className="fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105 sm:size-auto sm:gap-2 sm:px-5 sm:py-3 sm:text-sm sm:font-medium"
    >
      <MessageCircle className="size-6 sm:size-5" />
      <span className="hidden sm:inline">Une question ?</span>
    </a>
  );
}

async function CompanyFooter({ draft }: { draft?: FooterContent }) {
  return <SiteFooter company={await getCompany()} draft={draft} />;
}

const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

function VideoEmbed({ url }: { url: string }) {
  const embed = youtubeEmbed(url);
  if (embed)
    return (
      <iframe
        src={embed}
        title="Vidéo"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="aspect-video w-full rounded-2xl border shadow-md"
      />
    );
  if (/^https?:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(url))
    return <video src={url} controls preload="metadata" className="aspect-video w-full rounded-2xl border bg-black shadow-md" />;
  return (
    <Button asChild variant="outline">
      <a href={safeHref(url)} target="_blank" rel="noopener noreferrer">
        Voir la vidéo
      </a>
    </Button>
  );
}

/** Une section de l'accueil ; `anchor` pose l'ancre de navigation (#etapes, #faq, #partenaires). */
function BlockView({ block, anchor, transfer }: { block: Block; anchor: boolean; transfer?: BlockData['transfer'] }) {
  switch (block.type) {
    case 'hero':
      return <Hero content={block.data} transfer={transfer} />;

    case 'transfer':
      return (
        <Suspense fallback={<section id={anchor ? 'transfert' : undefined} className="scroll-mt-20 bg-[#06232b] py-20"><div className="h-[36rem]" /></section>}>
          <Transfer content={block.data} anchor={anchor} />
        </Suspense>
      );

    case 'strengths': {
      const { eyebrow, title, items } = block.data;
      if (!items.length) return null;
      return (
        <section className="bg-[#06232b] py-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-center text-sm font-medium tracking-widest text-[#5fd3df] uppercase">{eyebrow}</p>
            <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, i) => (
                <AnimatedContent key={i} distance={40} delay={i * 0.08}>
                  <SpotlightCard theme="dark" spotlightColor="rgba(95, 211, 223, 0.25)" className="h-full p-6">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[#0792a4]/25 text-[#5fd3df]">
                      <SiteIcon name={item.icon} className="size-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/70">{item.text}</p>
                  </SpotlightCard>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'catalog': {
      const { eyebrow, title, text, count } = block.data;
      return (
        <section id={anchor ? 'vehicules' : undefined} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow={eyebrow} title={title} text={text} />
          <div className="mt-10">
            <Suspense fallback={<CatalogSkeleton />}>
              <Catalog count={count} />
            </Suspense>
          </div>
        </section>
      );
    }

    case 'steps': {
      const { eyebrow, title, items } = block.data;
      if (!items.length) return null;
      return (
        <section id={anchor ? 'etapes' : undefined} className="scroll-mt-20 overflow-x-clip border-y border-border/60 bg-band py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle eyebrow={eyebrow} title={title} />
            <ol className="relative mt-14 grid gap-10 md:grid-flow-col md:auto-cols-fr md:gap-6">
              <div aria-hidden className="absolute top-7 right-[12%] left-[12%] hidden h-px border-t-2 border-dashed border-primary/30 md:block" />
              {items.map((step, i) => (
                <AnimatedContent key={i} distance={30} delay={i * 0.1}>
                  <li className="relative flex flex-col items-center text-center">
                    <span className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-8 ring-muted/40">
                      <SiteIcon name={step.icon} className="size-6" />
                      <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-background text-xs font-semibold text-primary ring-2 ring-primary">
                        {i + 1}
                      </span>
                    </span>
                    <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">{step.text}</p>
                  </li>
                </AnimatedContent>
              ))}
            </ol>
          </div>
        </section>
      );
    }

    case 'faq': {
      const { eyebrow, title, items } = block.data;
      if (!items.length) return null;
      return (
        <section id={anchor ? 'faq' : undefined} className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow={eyebrow} title={title} />
          <FaqList items={items} />
        </section>
      );
    }

    case 'partner': {
      const partner = block.data;
      return (
        <section id={anchor ? 'partenaires' : undefined} className="scroll-mt-20 overflow-x-clip border-t border-border/60 bg-band py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
            <AnimatedContent direction="horizontal" distance={40} reverse>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={partner.image} alt="Partenaire FIMA AUTO" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lg" loading="lazy" />
            </AnimatedContent>
            <div>
              <p className="text-sm font-medium tracking-widest text-primary uppercase">{partner.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{partner.title}</h2>
              <p className="mt-3 text-muted-foreground">{partner.text}</p>
              <ol className="mt-6 space-y-3">
                {partner.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                    <span>
                      <strong>{step.title}</strong>
                      {step.text && <span className="text-muted-foreground"> — {step.text}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              <Button asChild size="lg" className="mt-8">
                <Link href="/partner/register">
                  {partner.button} <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
          {partner.benefits.length > 0 && (
            <div className="mx-auto mt-14 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
              {partner.benefits.map((item, i) => (
                <div key={i} className="rounded-2xl border bg-card p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <SiteIcon name={item.icon} className="size-5" />
                  </div>
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          )}
          {partner.faq.length > 0 && (
            <div className="mx-auto mt-14 max-w-3xl px-4">
              <h3 className="text-center text-xl font-semibold">Questions fréquentes pour les partenaires</h3>
              <FaqList items={partner.faq} />
            </div>
          )}
        </section>
      );
    }

    case 'cta': {
      const { title, text } = block.data;
      return (
        <section className="relative overflow-hidden bg-gradient-to-br from-primary to-[#06232b] py-16 text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
              {text && <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">{text}</p>}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/client/register">Créer mon compte</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/client/login">J’ai déjà un compte</Link>
              </Button>
              <Suspense fallback={null}>
                <WhatsAppButton />
              </Suspense>
            </div>
          </div>
        </section>
      );
    }

    case 'text_image': {
      const { eyebrow, title, text, image, imageSide, buttonLabel, buttonHref } = block.data;
      return (
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
          <div className={imageSide === 'left' ? 'lg:order-2' : undefined}>
            {eyebrow && <p className="text-sm font-medium tracking-widest text-primary uppercase">{eyebrow}</p>}
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
            <div className="mt-4 space-y-3 text-muted-foreground">
              {paragraphs(text).map((part, i) => (
                <p key={i}>{part}</p>
              ))}
            </div>
            {buttonLabel && (
              <Button asChild size="lg" className="mt-6">
                <Link href={safeHref(buttonHref)}>
                  {buttonLabel} <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lg" loading="lazy" />
        </section>
      );
    }

    case 'gallery': {
      const { eyebrow, title, images } = block.data;
      if (!images.length) return null;
      return (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionTitle eyebrow={eyebrow} title={title} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, i) => (
              <figure key={i} className="overflow-hidden rounded-2xl border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                {image.caption && <figcaption className="px-4 py-3 text-sm text-muted-foreground">{image.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      );
    }

    case 'announcement': {
      const { text, linkLabel, linkHref, tone } = block.data;
      return (
        <div className={tone === 'promo' ? 'bg-amber-400 text-amber-950' : 'bg-primary text-primary-foreground'}>
          <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 text-center text-sm font-medium">
            {text}
            {linkLabel && (
              <Link href={safeHref(linkHref)} className="inline-flex items-center gap-1 underline underline-offset-4">
                {linkLabel} <ArrowRight className="size-4" />
              </Link>
            )}
          </p>
        </div>
      );
    }

    case 'testimonials': {
      const { eyebrow, title, items } = block.data;
      if (!items.length) return null;
      return (
        <section className="border-y border-border/60 bg-band py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle eyebrow={eyebrow} title={title} />
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <figure key={i} className="flex flex-col rounded-2xl border bg-card p-6">
                  <Quote className="size-6 text-primary/40" aria-hidden />
                  <blockquote className="mt-3 flex-1 text-sm">{item.quote}</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <strong>{item.name}</strong>
                    {item.role && <span className="text-muted-foreground"> — {item.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'stats': {
      const { eyebrow, title, items } = block.data;
      if (!items.length) return null;
      return (
        <section className="bg-[#06232b] py-16 text-white">
          <div className="mx-auto max-w-6xl px-4">
            {eyebrow && <p className="text-center text-sm font-medium tracking-widest text-[#5fd3df] uppercase">{eyebrow}</p>}
            {title && <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-balance">{title}</h2>}
            <dl className="mt-10 grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, i) => (
                <div key={i}>
                  <dt className="order-2 mt-1 text-sm text-white/70">{item.label}</dt>
                  <dd className="text-4xl font-semibold text-[#5fd3df] sm:text-5xl">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      );
    }

    case 'video': {
      const { eyebrow, title, url, caption } = block.data;
      if (!url.trim()) return null;
      return (
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <SectionTitle eyebrow={eyebrow} title={title} />
          <div className="mt-8 flex justify-center">
            <VideoEmbed url={url.trim()} />
          </div>
          {caption && <p className="mt-3 text-sm text-muted-foreground">{caption}</p>}
        </section>
      );
    }

    case 'text': {
      const { title, text } = block.data;
      return (
        <section className="mx-auto max-w-3xl px-4 py-16">
          {title && <h2 className="text-3xl font-semibold tracking-tight text-balance">{title}</h2>}
          <div className="mt-4 space-y-4 text-muted-foreground">
            {paragraphs(text).map((part, i) => (
              <p key={i}>{part}</p>
            ))}
          </div>
        </section>
      );
    }
  }
}

/** Page d'accueil complète (publique ou aperçu d'un brouillon) à partir de ses sections ; les bandes alternent fond / bande teintée. */
export function HomeView({ blocks, footer, menu, announcement, lead }: { blocks: Block[]; footer?: FooterContent; menu?: MenuLink[]; announcement?: Announcement; lead?: React.ReactNode }) {
  const visible = blocks.filter((block) => block.show);
  const seen = new Set<string>();
  const overHero = !lead && visible[0]?.type === 'hero';
  const transfer = visible.find((block) => block.type === 'transfer')?.data as BlockData['transfer'] | undefined;
  return (
    <>
      <SiteHeader overHero={overHero} links={menu} announcement={announcement} />
      <main className={cn('flex-1', !overHero && 'pt-16')}>
        {lead}
        {visible.map((block) => {
          const anchor = !seen.has(block.type);
          seen.add(block.type);
          return <BlockView key={block.id} block={block} anchor={anchor} transfer={transfer} />;
        })}
      </main>
      <Suspense fallback={null}>
        <FloatingWhatsApp />
      </Suspense>
      <Suspense fallback={<SiteFooter company={null} />}>
        <CompanyFooter draft={footer} />
      </Suspense>
    </>
  );
}
