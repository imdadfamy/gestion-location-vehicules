'use client';

import { Field } from '@/components/staff/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_DATA,
  TRANSFER_CATEGORIES,
  type Block,
  type Faq,
  type GalleryImage,
  type Item,
  type Link,
  type Stat,
  type Step,
  type Testimonial,
  type TransferRoute,
} from '@/lib/data/site-content';
import { IconSelect, ImageField, ListEditor, TextRow } from './list-editor';

type Props = { disabled?: boolean };

const blankItem = (): Item => ({ icon: 'star', title: '', text: '' });
const blankStep = (): Step => ({ title: '', text: '' });
const blankFaq = (): Faq => ({ q: '', a: '' });
const blankLink = (): Link => ({ label: '', href: '/' });
const blankImage = (): GalleryImage => ({ url: '', caption: '' });
const blankTestimonial = (): Testimonial => ({ name: '', role: '', quote: '' });
const blankRoute = (): TransferRoute => ({ from: 'Aéroport de Cotonou', to: '', price: '', prices: {} });
const blankStat = (): Stat => ({ value: '', label: '' });

function Area({ id, label, value, onChange, disabled, rows = 3 }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; rows?: number }) {
  return (
    <Field label={label} htmlFor={id}>
      <Textarea id={id} rows={rows} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function ItemsList({ items, onChange, disabled, addLabel, scope }: Props & { items: Item[]; onChange: (items: Item[]) => void; addLabel: string; scope: string }) {
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
            <TextRow id={`${scope}-title-${index}`} label="Titre" value={item.title} onChange={(title) => patch({ title })} disabled={disabled} />
          </div>
          <TextRow id={`${scope}-text-${index}`} label="Texte" value={item.text} onChange={(text) => patch({ text })} disabled={disabled} />
        </>
      )}
    />
  );
}

export function FaqList({ items, onChange, disabled, scope }: Props & { items: Faq[]; onChange: (items: Faq[]) => void; scope: string }) {
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
          <Area id={`${scope}-a-${index}`} label="Réponse" rows={2} value={item.a} onChange={(a) => patch({ a })} disabled={disabled} />
        </>
      )}
    />
  );
}

export function LinksList({ items, onChange, disabled, scope, addLabel }: Props & { items: Link[]; onChange: (items: Link[]) => void; scope: string; addLabel: string }) {
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

function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** Champs d'édition d'une section selon son type. */
export function BlockForm({ block, onChange, disabled }: Props & { block: Block; onChange: (block: Block) => void }) {
  const id = block.id;
  switch (block.type) {
    case 'hero': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          <TextRow id={`${id}-subtitle`} label="Sous-titre" value={d.subtitle} onChange={(subtitle) => set({ subtitle })} disabled={disabled} />
          <TextRow
            id={`${id}-words`}
            label="Mots qui défilent (séparés par une virgule)"
            value={d.words.join(', ')}
            onChange={(text) => set({ words: text.split(',').map((word) => word.trimStart()) })}
            disabled={disabled}
          />
          <ImageField label="Image de fond" value={d.image} fallback={DEFAULT_DATA.hero.image} folder="home" onChange={(image) => set({ image })} disabled={disabled} />
        </div>
      );
    }
    case 'strengths': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <ItemsList scope={id} items={d.items} onChange={(items) => set({ items })} disabled={disabled} addLabel="Ajouter un atout" />
        </div>
      );
    }
    case 'catalog': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
            <TextRow id={`${id}-text`} label="Texte" value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
          </div>
          <Field label="Véhicules affichés avant « Voir plus »" htmlFor={`${id}-count`} className="sm:w-56">
            <Select value={String(d.count)} onValueChange={(count) => set({ count: Number(count) })} disabled={disabled}>
              <SelectTrigger id={`${id}-count`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 6, 9, 12].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} véhicules
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">Cette section affiche le catalogue complet (dates, filtres, fiche du véhicule). Les véhicules viennent de l’écran Véhicules (statut « disponible »).</p>
        </div>
      );
    }
    case 'transfer': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <Area id={`${id}-text`} label="Présentation" rows={2} value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
          <TextRow id={`${id}-button`} label="Texte du bouton WhatsApp (après l’envoi de la demande)" value={d.button} onChange={(button) => set({ button })} disabled={disabled} />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Étapes</p>
            <ItemsList scope={`${id}-steps`} items={d.steps} onChange={(steps) => set({ steps })} disabled={disabled} addLabel="Ajouter une étape" />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Questions fréquentes sur le transfert</p>
            <FaqList scope={`${id}-faq`} items={d.faq} onChange={(faq) => set({ faq })} disabled={disabled} />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Trajets et prix fixes</p>
            <ListEditor
              items={d.routes}
              onChange={(routes) => set({ routes })}
              blank={blankRoute}
              addLabel="Ajouter un trajet"
              disabled={disabled}
              render={(item, patch, index) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextRow id={`${id}-from-${index}`} label="Départ" value={item.from} onChange={(from) => patch({ from })} disabled={disabled} />
                    <TextRow id={`${id}-to-${index}`} label="Arrivée" value={item.to} onChange={(to) => patch({ to })} disabled={disabled} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <TextRow id={`${id}-price-${index}`} label="Prix de base (FCFA)" value={item.price} onChange={(price) => patch({ price })} disabled={disabled} />
                    {TRANSFER_CATEGORIES.map((category) => (
                      <TextRow
                        key={category}
                        id={`${id}-price-${category}-${index}`}
                        label={`${category} (si différent)`}
                        value={item.prices?.[category] ?? ''}
                        onChange={(value) => patch({ prices: { ...item.prices, [category]: value } })}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </>
              )}
            />
            <p className="text-xs text-muted-foreground">Le prix de base s’applique à tous les véhicules ; remplissez une catégorie seulement si son prix diffère. Sans prix, le trajet s’affiche « Sur devis ». Les demandes arrivent dans l’écran Transferts.</p>
          </div>
        </div>
      );
    }
    case 'steps': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <ItemsList scope={id} items={d.items} onChange={(items) => set({ items })} disabled={disabled} addLabel="Ajouter une étape" />
        </div>
      );
    }
    case 'faq': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <FaqList scope={id} items={d.items} onChange={(items) => set({ items })} disabled={disabled} />
        </div>
      );
    }
    case 'partner': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <Area id={`${id}-text`} label="Présentation" value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
          <TextRow id={`${id}-button`} label="Texte du bouton WhatsApp (après l’envoi de la demande)" value={d.button} onChange={(button) => set({ button })} disabled={disabled} />
          <ImageField label="Image" value={d.image} fallback={DEFAULT_DATA.partner.image} folder="partners" onChange={(image) => set({ image })} disabled={disabled} />
          <h4 className="text-sm font-medium">Étapes</h4>
          <ListEditor
            items={d.steps}
            onChange={(steps) => set({ steps })}
            blank={blankStep}
            addLabel="Ajouter une étape"
            disabled={disabled}
            render={(item, patch, index) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextRow id={`${id}-pstep-title-${index}`} label="Titre" value={item.title} onChange={(title) => patch({ title })} disabled={disabled} />
                <TextRow id={`${id}-pstep-text-${index}`} label="Texte" value={item.text} onChange={(text) => patch({ text })} disabled={disabled} />
              </div>
            )}
          />
          <h4 className="text-sm font-medium">Avantages</h4>
          <ItemsList scope={`${id}-benefit`} items={d.benefits} onChange={(benefits) => set({ benefits })} disabled={disabled} addLabel="Ajouter un avantage" />
          <h4 className="text-sm font-medium">Questions des partenaires</h4>
          <FaqList scope={`${id}-pfaq`} items={d.faq} onChange={(faq) => set({ faq })} disabled={disabled} />
        </div>
      );
    }
    case 'cta': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          <TextRow id={`${id}-text`} label="Texte" value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
          <p className="text-xs text-muted-foreground">Les boutons « Créer mon compte », « J’ai déjà un compte » et WhatsApp sont ajoutés automatiquement.</p>
        </div>
      );
    }
    case 'text_image': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <Area id={`${id}-text`} label="Texte (séparez les paragraphes par une ligne vide)" rows={5} value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
          <ImageField label="Image" value={d.image} fallback="" folder="home" onChange={(image) => set({ image })} disabled={disabled} />
          <Field label="Position de l’image" htmlFor={`${id}-side`} className="sm:w-56">
            <Select value={d.imageSide} onValueChange={(imageSide) => set({ imageSide: imageSide as 'left' | 'right' })} disabled={disabled}>
              <SelectTrigger id={`${id}-side`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">À droite</SelectItem>
                <SelectItem value="left">À gauche</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Pair>
            <TextRow id={`${id}-btn`} label="Texte du bouton (vide : pas de bouton)" value={d.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} disabled={disabled} />
            <TextRow id={`${id}-href`} label="Adresse du bouton" value={d.buttonHref} onChange={(buttonHref) => set({ buttonHref })} disabled={disabled} />
          </Pair>
        </div>
      );
    }
    case 'gallery': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <ListEditor
            items={d.images}
            onChange={(images) => set({ images })}
            blank={blankImage}
            addLabel="Ajouter une photo"
            disabled={disabled}
            render={(item, patch, index) => (
              <>
                <ImageField label={`Photo ${index + 1}`} value={item.url} fallback="" folder="home" onChange={(url) => patch({ url })} disabled={disabled} />
                <TextRow id={`${id}-cap-${index}`} label="Légende" value={item.caption} onChange={(caption) => patch({ caption })} disabled={disabled} />
              </>
            )}
          />
        </div>
      );
    }
    case 'announcement': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <TextRow id={`${id}-text`} label="Message" value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
          <Pair>
            <TextRow id={`${id}-link`} label="Texte du lien (facultatif)" value={d.linkLabel} onChange={(linkLabel) => set({ linkLabel })} disabled={disabled} />
            <TextRow id={`${id}-href`} label="Adresse du lien" value={d.linkHref} onChange={(linkHref) => set({ linkHref })} disabled={disabled} />
          </Pair>
          <Field label="Style" htmlFor={`${id}-tone`} className="sm:w-56">
            <Select value={d.tone} onValueChange={(tone) => set({ tone: tone as 'info' | 'promo' })} disabled={disabled}>
              <SelectTrigger id={`${id}-tone`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Information (couleur du site)</SelectItem>
                <SelectItem value="promo">Promotion (jaune)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    }
    case 'testimonials': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <ListEditor
            items={d.items}
            onChange={(items) => set({ items })}
            blank={blankTestimonial}
            addLabel="Ajouter un témoignage"
            disabled={disabled}
            render={(item, patch, index) => (
              <>
                <Pair>
                  <TextRow id={`${id}-name-${index}`} label="Nom" value={item.name} onChange={(name) => patch({ name })} disabled={disabled} />
                  <TextRow id={`${id}-role-${index}`} label="Qualité (ex. Client)" value={item.role} onChange={(role) => patch({ role })} disabled={disabled} />
                </Pair>
                <Area id={`${id}-quote-${index}`} label="Avis" rows={2} value={item.quote} onChange={(quote) => patch({ quote })} disabled={disabled} />
              </>
            )}
          />
          <p className="text-xs text-muted-foreground">N’affichez que de vrais avis de clients, avec leur accord.</p>
        </div>
      );
    }
    case 'stats': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <ListEditor
            items={d.items}
            onChange={(items) => set({ items })}
            blank={blankStat}
            addLabel="Ajouter un chiffre"
            disabled={disabled}
            render={(item, patch, index) => (
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <TextRow id={`${id}-value-${index}`} label="Chiffre (ex. 120+)" value={item.value} onChange={(value) => patch({ value })} disabled={disabled} />
                <TextRow id={`${id}-label-${index}`} label="Libellé" value={item.label} onChange={(label) => patch({ label })} disabled={disabled} />
              </div>
            )}
          />
          <p className="text-xs text-muted-foreground">Ne publiez que des chiffres exacts.</p>
        </div>
      );
    }
    case 'partner_logos': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <Field label="Nombre de logos à partir duquel la section s’affiche" htmlFor={`${id}-threshold`}>
            <Input
              id={`${id}-threshold`}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={d.threshold}
              disabled={disabled}
              onChange={(event) => set({ threshold: Math.min(50, Math.max(1, Math.round(Number(event.target.value)) || 1)) })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Les logos viennent des partenaires eux-mêmes (compte actif, nom commercial, logo et accord de publication). Rien à saisir ici : la section reste invisible tant que le seuil n’est pas atteint, puis chaque nouveau logo s’ajoute au défilement.
          </p>
        </div>
      );
    }
    case 'video': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <Pair>
            <TextRow id={`${id}-eyebrow`} label="Sur-titre" value={d.eyebrow} onChange={(eyebrow) => set({ eyebrow })} disabled={disabled} />
            <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          </Pair>
          <TextRow id={`${id}-url`} label="Adresse de la vidéo (YouTube ou fichier .mp4)" value={d.url} onChange={(url) => set({ url })} disabled={disabled} />
          <TextRow id={`${id}-caption`} label="Légende (facultatif)" value={d.caption} onChange={(caption) => set({ caption })} disabled={disabled} />
          <p className="text-xs text-muted-foreground">Sans adresse, la section n’est pas affichée.</p>
        </div>
      );
    }
    case 'text': {
      const d = block.data;
      const set = (patch: Partial<typeof d>) => onChange({ ...block, data: { ...d, ...patch } });
      return (
        <div className="grid gap-4">
          <TextRow id={`${id}-title`} label="Titre" value={d.title} onChange={(title) => set({ title })} disabled={disabled} />
          <Area id={`${id}-text`} label="Texte (séparez les paragraphes par une ligne vide)" rows={6} value={d.text} onChange={(text) => set({ text })} disabled={disabled} />
        </div>
      );
    }
  }
}
