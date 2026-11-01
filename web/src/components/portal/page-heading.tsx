/** Titre de page des espaces client et partenaire. */
export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-primary uppercase">{eyebrow}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}
