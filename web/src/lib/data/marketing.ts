import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { removeFiles, signedUrl, uniquePath, uploadFile } from './storage';

type Db = SupabaseClient<Database>;
export type Expense = Database['public']['Tables']['marketing_expenses']['Row'];
export type Campaign = Database['public']['Tables']['marketing_campaigns']['Row'];

export const CHANNELS: Record<string, string> = {
  ads: 'Publicité en ligne',
  influencer: 'Influenceur',
  print: 'Affiches, flyers, imprimés',
  event: 'Événement',
  sponsoring: 'Sponsoring, partenariat',
  other: 'Autre',
};

/** Valeur de location d'un véhicule prêté : prix journalier × jours (la dépense « en nature »). */
export const loanValue = (dailyPrice: number | null | undefined, days: number) => Math.max(0, Number(dailyPrice ?? 0)) * Math.max(0, days);

// ── Dépenses ──
export function listExpenses(db: Db) {
  return db.from('marketing_expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false });
}

export type ExpenseForm = {
  id?: string;
  spent_on: string;
  channel: string;
  label: string;
  amount: string;
  campaign_id: string;
  influencer_name: string;
  in_kind: boolean;
  vehicle_id: string;
  loan_days: string;
  notes: string;
  receipt_path: string | null;
};

export const EMPTY_EXPENSE = (): ExpenseForm => ({
  spent_on: new Date().toLocaleDateString('en-CA'),
  channel: 'ads',
  label: '',
  amount: '',
  campaign_id: 'none',
  influencer_name: '',
  in_kind: false,
  vehicle_id: 'none',
  loan_days: '',
  notes: '',
  receipt_path: null,
});

export const toExpenseForm = (expense: Expense): ExpenseForm => ({
  id: expense.id,
  spent_on: expense.spent_on,
  channel: expense.channel,
  label: expense.label,
  amount: String(expense.amount),
  campaign_id: expense.campaign_id ?? 'none',
  influencer_name: expense.influencer_name ?? '',
  in_kind: expense.in_kind,
  vehicle_id: expense.vehicle_id ?? 'none',
  loan_days: expense.loan_days === null ? '' : String(expense.loan_days),
  notes: expense.notes ?? '',
  receipt_path: expense.receipt_path,
});

export function validateExpense(form: ExpenseForm) {
  if (form.label.trim().length < 2) return 'Indiquez ce que la dépense a servi à payer.';
  if (!form.spent_on) return 'Indiquez la date.';
  if (form.amount.trim() === '' || !(Number(form.amount) >= 0)) return 'Le montant doit être un nombre positif ou nul.';
  if (form.in_kind && form.vehicle_id !== 'none' && !(Number(form.loan_days) >= 1)) return 'Indiquez le nombre de jours de prêt du véhicule.';
  return '';
}

export function saveExpense(db: Db, form: ExpenseForm, userId: string | null) {
  const row = {
    spent_on: form.spent_on,
    channel: form.channel,
    label: form.label.trim(),
    amount: Number(form.amount),
    campaign_id: form.campaign_id === 'none' ? null : form.campaign_id,
    influencer_name: form.channel === 'influencer' && form.influencer_name.trim() ? form.influencer_name.trim() : null,
    in_kind: form.in_kind,
    vehicle_id: form.in_kind && form.vehicle_id !== 'none' ? form.vehicle_id : null,
    loan_days: form.in_kind && form.vehicle_id !== 'none' && form.loan_days ? Number(form.loan_days) : null,
    notes: form.notes.trim() || null,
    receipt_path: form.receipt_path,
  };
  return form.id
    ? db.from('marketing_expenses').update(row).eq('id', form.id).select().single()
    : db.from('marketing_expenses').insert({ ...row, created_by: userId }).select().single();
}

/** Supprime la dépense puis son justificatif éventuel. */
export async function deleteExpense(db: Db, expense: Expense) {
  const { error } = await db.from('marketing_expenses').delete().eq('id', expense.id);
  if (error) return error;
  if (expense.receipt_path) await removeFiles(db, 'marketing-receipts', [expense.receipt_path]);
  return null;
}

export async function uploadReceipt(db: Db, file: File) {
  const path = uniquePath('receipts', file);
  const { error } = await uploadFile(db, 'marketing-receipts', path, file);
  return { path: error ? null : path, error };
}

export const receiptUrl = (db: Db, path: string) => signedUrl(db, 'marketing-receipts', path, 120);
export const discardReceipt = (db: Db, path: string) => removeFiles(db, 'marketing-receipts', [path]);

// ── Campagnes ──
export function listCampaigns(db: Db) {
  return db.from('marketing_campaigns').select('*').order('starts_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
}

export type CampaignForm = { id?: string; name: string; starts_on: string; ends_on: string; budget: string; notes: string };
export const EMPTY_CAMPAIGN: CampaignForm = { name: '', starts_on: '', ends_on: '', budget: '', notes: '' };

export function saveCampaign(db: Db, form: CampaignForm, userId: string | null) {
  const row = {
    name: form.name.trim(),
    starts_on: form.starts_on || null,
    ends_on: form.ends_on || null,
    budget: form.budget.trim() === '' ? null : Number(form.budget),
    notes: form.notes.trim() || null,
  };
  return form.id
    ? db.from('marketing_campaigns').update(row).eq('id', form.id).select().single()
    : db.from('marketing_campaigns').insert({ ...row, created_by: userId }).select().single();
}

export function deleteCampaign(db: Db, id: string) {
  return db.from('marketing_campaigns').delete().eq('id', id);
}

/** Total des dépenses par clé (canal, campagne…). */
export function totalsBy(expenses: Expense[], key: (expense: Expense) => string) {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(key(expense), (totals.get(key(expense)) ?? 0) + Number(expense.amount));
  return [...totals].sort((a, b) => b[1] - a[1]);
}
