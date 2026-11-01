'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { refreshSiteContent } from '@/app/app/website/actions';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_FOOTER,
  DEFAULT_HOME,
  footerContent,
  homeContent,
  safeHref,
  type Faq,
  type FooterContent,
  type HomeContent,
  type Item,
  type Link,
  type SiteKey,
  type Step,
} from '@/lib/data/site-content';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { IconSelect, ImageField, ListEditor, TextRow } from './list-editor';

const blankItem = (): Item => ({ icon: 'star', title: '', text: '' });
const blankStep = (): Step => ({ title: '', text: '' });
const blankFaq = (): Faq => ({ q: '', a: '' });
const blankLink = (): Link => ({ label: '', href: '/' });

function Block({ title, children, toggle }: { title: string; children: React.ReactNode; toggle?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {toggle}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function Visible({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Switch checked={on} onCheckedChange={onChange} disabled={disabled} /> Afficher
    </label>
  );
}

function ItemsList({ items, onChange, disabled, addLabel }: { items: Item[]; onChange: (items: Item[]) => void; disabled?: boolean; addLabel: string }) {
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      blank={blankItem}
      addLabel={addLabel}
      disabled={disabled}
      render={(item, patch, index) => (
        <>
          <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
            <IconSelect value={item.icon} onChange={(icon) => patch({ icon })} disabled={disabled} />
            <TextRow id={`item-title-${addLabel}-${index}`} label="Titre" value={item.title} onChange={(title) => patch({ title })} disabled={disabled} />
          </div>
          <TextRow id={`item-text-${addLabel}-${index}`} label="Texte" value={item.text} onChange={(text) => patch({ text })} disabled={disabled} />
        </>
      )}
    />
  );
}

function FaqList({ items, onChange, disabled, scope }: { items: Faq[]; onChange: (items: Faq[]) => void; disabled?: boolean; scope: string }) {
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      blank={blankFaq}
      addLabel="Ajouter une question"
      disabled={disabled}
      render={(item, patch, index) => (
        <>
          <TextRow id={`${scope}-q-${index}`} label="Question" value={item.q} onChange={(q) => patch({ q })} disabled={disabled} />
          <Field label="Réponse" htmlFor={`${scope}-a-${index}`}>
            <Textarea id={`${scope}-a-${index}`} rows={2} value={item.a} disabled={disabled} onChange={(event) => patch({ a: event.target.value })} />
          </Field>
        </>
      )}
    />
  );
}

function LinksList({ items, onChange, disabled, scope, addLabel }: { items: Link[]; onChange: (items: Link[]) => void; disabled?: boolean; scope: string; addLabel: string }) {
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      blank={blankLink}
      addLabel={addLabel}
      disabled={disabled}
      render={(item, patch, index) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextRow id={`${scope}-label-${index}`} label="Libellé" value={item.label} onChange={(label) => patch({ label })} disabled={disabled} />
          <TextRow id={`${scope}-href-${index}`} label="Adresse (/page, https://…)" value={item.href} onChange={(href) => patch({ href })} disabled={disabled} />
        </div>
      )}
    />
  );
}

function HomeForm({ value, onChange, disabled }: { value: HomeContent; onChange: (value: HomeContent) => void; disabled?: boolean }) {
  const set = <K extends keyof HomeContent>(key: K, change: Partial<HomeContent[K]>) => onChange({ ...value, [key]: { ...value[key], ...change } });
  const { hero, strengths, catalog, steps, faq, partner, cta } = value;
  return (
    <div className="grid gap-4">
      <Block title="Bannière d’accueil">
        <TextRow id="hero-title" label="Titre" value={hero.title} onChange={(title) => set('hero', { title })} disabled={disabled} />
        <TextRow id="hero-subtitle" label="Sous-titre" value={hero.subtitle} onChange={(subtitle) => set('hero', { subtitle })} disabled={disabled} />
        <TextRow
          id="hero-words"
          label="Mots qui défilent (séparés par une virgule)"
          value={hero.words.join(', ')}
          onChange={(text) => set('hero', { words: text.split(',').map((word) => word.trimStart()) })}
          disabled={disabled}
        />
        <ImageField label="Image de fond" value={hero.image} fallback={DEFAULT_HOME.hero.image} folder="home" onChange={(image) => set('hero', { image })} disabled={disabled} />
      </Block>

      <Block title="Atouts">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextRow id="strengths-eyebrow" label="Sur-titre" value={strengths.eyebrow} onChange={(eyebrow) => set('strengths', { eyebrow })} disabled={disabled} />
          <TextRow id="strengths-title" label="Titre" value={strengths.title} onChange={(title) => set('strengths', { title })} disabled={disabled} />
        </div>
        <ItemsList items={strengths.items} onChange={(items) => set('strengths', { items })} disabled={disabled} addLabel="Ajouter un atout" />
      </Block>

      <Block title="Catalogue de véhicules" toggle={<Visible on={catalog.show} onChange={(show) => set('catalog', { show })} disabled={disabled} />}>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextRow id="catalog-eyebrow" label="Sur-titre" value={catalog.eyebrow} onChange={(eyebrow) => set('catalog', { eyebrow })} disabled={disabled} />
          <TextRow id="catalog-title" label="Titre" value={catalog.title} onChange={(title) => set('catalog', { title })} disabled={disabled} />
          <TextRow id="catalog-text" label="Texte" value={catalog.text} onChange={(text) => set('catalog', { text })} disabled={disabled} />
        </div>
        <p className="text-xs text-muted-foreground">Les véhicules affichés viennent de l’écran Véhicules (statut « disponible »).</p>
      </Block>

      <Block title="Comment ça marche" toggle={<Visible on={steps.show} onChange={(show) => set('steps', { show })} disabled={disabled} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextRow id="steps-eyebrow" label="Sur-titre" value={steps.eyebrow} onChange={(eyebrow) => set('steps', { eyebrow })} disabled={disabled} />
          <TextRow id="steps-title" label="Titre" value={steps.title} onChange={(title) => set('steps', { title })} disabled={disabled} />
        </div>
        <ItemsList items={steps.items} onChange={(items) => set('steps', { items })} disabled={disabled} addLabel="Ajouter une étape" />
      </Block>

      <Block title="Questions fréquentes" toggle={<Visible on={faq.show} onChange={(show) => set('faq', { show })} disabled={disabled} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextRow id="faq-eyebrow" label="Sur-titre" value={faq.eyebrow} onChange={(eyebrow) => set('faq', { eyebrow })} disabled={disabled} />
          <TextRow id="faq-title" label="Titre" value={faq.title} onChange={(title) => set('faq', { title })} disabled={disabled} />
        </div>
        <FaqList scope="faq" items={faq.items} onChange={(items) => set('faq', { items })} disabled={disabled} />
      </Block>

      <Block title="Bloc partenaires" toggle={<Visible on={partner.show} onChange={(show) => set('partner', { show })} disabled={disabled} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextRow id="partner-eyebrow" label="Sur-titre" value={partner.eyebrow} onChange={(eyebrow) => set('partner', { eyebrow })} disabled={disabled} />
          <TextRow id="partner-title" label="Titre" value={partner.title} onChange={(title) => set('partner', { title })} disabled={disabled} />
        </div>
        <Field label="Présentation" htmlFor="partner-text">
          <Textarea id="partner-text" rows={3} value={partner.text} disabled={disabled} onChange={(event) => set('partner', { text: event.target.value })} />
        </Field>
        <TextRow id="partner-button" label="Texte du bouton" value={partner.button} onChange={(button) => set('partner', { button })} disabled={disabled} />
        <ImageField label="Image" value={partner.image} fallback={DEFAULT_HOME.partner.image} folder="partners" onChange={(image) => set('partner', { image })} disabled={disabled} />
        <h3 className="text-sm font-medium">Étapes</h3>
        <ListEditor
          items={partner.steps}
          onChange={(items) => set('partner', { steps: items })}
          blank={blankStep}
          addLabel="Ajouter une étape"
          disabled={disabled}
          render={(item, patch, index) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextRow id={`pstep-title-${index}`} label="Titre" value={item.title} onChange={(title) => patch({ title })} disabled={disabled} />
              <TextRow id={`pstep-text-${index}`} label="Texte" value={item.text} onChange={(text) => patch({ text })} disabled={disabled} />
            </div>
          )}
        />
        <h3 className="text-sm font-medium">Avantages</h3>
        <ItemsList items={partner.benefits} onChange={(benefits) => set('partner', { benefits })} disabled={disabled} addLabel="Ajouter un avantage" />
        <h3 className="text-sm font-medium">Questions des partenaires</h3>
        <FaqList scope="pfaq" items={partner.faq} onChange={(items) => set('partner', { faq: items })} disabled={disabled} />
      </Block>

      <Block title="Appel à l’action (bas de page)">
        <TextRow id="cta-title" label="Titre" value={cta.title} onChange={(title) => set('cta', { title })} disabled={disabled} />
        <TextRow id="cta-text" label="Texte" value={cta.text} onChange={(text) => set('cta', { text })} disabled={disabled} />
      </Block>
    </div>
  );
}

function FooterForm({ value, onChange, disabled }: { value: FooterContent; onChange: (value: FooterContent) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-4">
      <Block title="Présentation">
        <TextRow id="footer-tagline" label="Phrase d’accroche" value={value.tagline} onChange={(tagline) => onChange({ ...value, tagline })} disabled={disabled} />
        <TextRow id="footer-note" label="Mention complémentaire (facultative)" value={value.note} onChange={(note) => onChange({ ...value, note })} disabled={disabled} />
        <p className="text-xs text-muted-foreground">Téléphone, WhatsApp, adresse et horaires se modifient dans Paramètres.</p>
      </Block>
      <Block title="Liens du pied de page">
        <LinksList scope="footer-link" items={value.links} onChange={(links) => onChange({ ...value, links })} disabled={disabled} addLabel="Ajouter un lien" />
      </Block>
      <Block title="Réseaux sociaux">
        <LinksList scope="footer-social" items={value.socials} onChange={(socials) => onChange({ ...value, socials })} disabled={disabled} addLabel="Ajouter un réseau" />
        <p className="text-xs text-muted-foreground">Exemple : libellé « Facebook », adresse https://facebook.com/votre-page.</p>
      </Block>
    </div>
  );
}

/** Nettoie les textes avant enregistrement : lignes vides retirées, adresses de liens sûres. */
function cleanHome(home: HomeContent): HomeContent {
  const items = (list: Item[]) => list.filter((item) => item.title.trim() || item.text.trim());
  const faqs = (list: Faq[]) => list.filter((entry) => entry.q.trim() && entry.a.trim());
  return {
    ...home,
    hero: { ...home.hero, words: home.hero.words.map((word) => word.trim()).filter(Boolean) },
    strengths: { ...home.strengths, items: items(home.strengths.items) },
    steps: { ...home.steps, items: items(home.steps.items) },
    faq: { ...home.faq, items: faqs(home.faq.items) },
    partner: {
      ...home.partner,
      steps: home.partner.steps.filter((step) => step.title.trim()),
      benefits: items(home.partner.benefits),
      faq: faqs(home.partner.faq),
    },
  };
}

function cleanFooter(footer: FooterContent): FooterContent {
  const links = (list: Link[]) => list.filter((link) => link.label.trim()).map((link) => ({ label: link.label.trim(), href: safeHref(link.href) }));
  return { ...footer, links: links(footer.links), socials: links(footer.socials) };
}

export function WebsiteEditor({ canEdit }: { canEdit: boolean }) {
  const [home, setHome] = useState<HomeContent | null>(null);
  const [footer, setFooter] = useState<FooterContent | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<SiteKey | null>(null);

  useEffect(() => {
    createClient()
      .from('site_content')
      .select('key,content')
      .then(({ data, error: failure }) => {
        if (failure) return setError(frenchError(failure));
        const byKey = Object.fromEntries((data ?? []).map((row) => [row.key, row.content]));
        setHome(homeContent(byKey.home));
        setFooter(footerContent(byKey.footer));
      });
  }, []);

  async function save(key: SiteKey) {
    setError('');
    setMessage('');
    setSaving(key);
    const content = key === 'home' ? cleanHome(home!) : cleanFooter(footer!);
    const { error: failure } = await createClient()
      .from('site_content')
      .upsert({ key, content: JSON.parse(JSON.stringify(content)) }, { onConflict: 'key' });
    if (failure) {
      setSaving(null);
      return setError(frenchError(failure));
    }
    await refreshSiteContent();
    setSaving(null);
    if (key === 'home') setHome(content as HomeContent);
    else setFooter(content as FooterContent);
    setMessage('Modifications publiées : elles sont visibles sur le site.');
  }

  function reset(key: SiteKey) {
    if (key === 'home') setHome(DEFAULT_HOME);
    else setFooter(DEFAULT_FOOTER);
    setMessage('Contenu d’origine rétabli ici : cliquez sur « Publier » pour l’appliquer au site.');
  }

  const actions = (key: SiteKey) => (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={!canEdit || saving !== null} onClick={() => save(key)}>
        {saving === key && <Loader2 className="animate-spin" />} Publier les modifications
      </Button>
      <Button type="button" variant="outline" disabled={!canEdit || saving !== null} onClick={() => reset(key)}>
        Rétablir le contenu d’origine
      </Button>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site web</h1>
          <p className="text-sm text-muted-foreground">Modifiez les textes, images, listes et sections du site public. Rien n’est visible avant d’avoir cliqué sur « Publier ».</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Voir le site
          </a>
        </Button>
      </div>
      {!canEdit && <FormMessage error="Vous pouvez consulter cet écran, mais vous n’avez pas le droit de modifier le site." />}
      <FormMessage error={error} message={error ? '' : message} />
      {!home || !footer ? (
        !error && <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Tabs defaultValue="home">
          <TabsList>
            <TabsTrigger value="home">Page d’accueil</TabsTrigger>
            <TabsTrigger value="footer">Pied de page</TabsTrigger>
          </TabsList>
          <TabsContent value="home" className="mt-4 grid gap-4">
            {actions('home')}
            <HomeForm value={home} onChange={setHome} disabled={!canEdit} />
            {actions('home')}
          </TabsContent>
          <TabsContent value="footer" className="mt-4 grid gap-4">
            {actions('footer')}
            <FooterForm value={footer} onChange={setFooter} disabled={!canEdit} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
