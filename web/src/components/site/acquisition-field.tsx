'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACQUISITION_SOURCES } from '@/lib/acquisition';
import { cn } from '@/lib/utils';
import { useLang } from './lang-provider';

/**
 * Question facultative « Comment nous avez-vous connus ? », avec un détail libre pour les
 * influenceurs (nom ou code). `tone="dark"` s'accorde au formulaire de transfert sur fond sombre.
 */
export function AcquisitionField({
  idPrefix,
  source,
  detail,
  onSourceChange,
  onDetailChange,
  tone = 'light',
}: {
  idPrefix: string;
  source: string;
  detail: string;
  onSourceChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  tone?: 'light' | 'dark';
}) {
  const { t } = useLang();
  const dark = tone === 'dark';
  const control = dark ? 'border-white/20 bg-white/90 text-foreground' : undefined;
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-source`} className={cn(dark && 'text-white/80')}>
          {t('Comment nous avez-vous connus ? (facultatif)')}
        </Label>
        <Select value={source || 'none'} onValueChange={(value) => onSourceChange(value === 'none' ? '' : value)}>
          <SelectTrigger id={`${idPrefix}-source`} className={cn('w-full', control)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('Je préfère ne pas répondre')}</SelectItem>
            {ACQUISITION_SOURCES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {source === 'influencer' && (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-detail`} className={cn(dark && 'text-white/80')}>
            {t('Nom de l’influenceur ou code (facultatif)')}
          </Label>
          <Input id={`${idPrefix}-detail`} value={detail} onChange={(event) => onDetailChange(event.target.value)} maxLength={120} className={control} />
        </div>
      )}
    </div>
  );
}
