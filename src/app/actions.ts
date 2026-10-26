'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { offerById } from '@/data/offers';
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from '@/lib/auth';
import { bonusEligibility } from '@/lib/benefit';
import { isCategory } from '@/lib/categories';
import { addDays, isISODate, parseISO, toISO, today } from '@/lib/dates';
import { extractContract, type ExtractedContract } from '@/lib/extract';
import { historyOf, viewContract } from '@/lib/overview';
import * as repo from '@/lib/repo';

export interface FormState {
  error?: string;
}

const str = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? '').trim().slice(0, max);

function int(fd: FormData, key: string, min: number, max: number): number | null {
  const raw = str(fd, key);
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// ---------- Konto ----------

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  const name = str(fd, 'name', 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
  if (password.length < 10) return { error: 'Das Passwort braucht mindestens 10 Zeichen.' };
  if (fd.get('consent') !== 'on') return { error: 'Bitte Nutzungsbedingungen und Datenschutzerklärung akzeptieren.' };
  if (repo.findUserByEmail(email)) return { error: 'Für diese E-Mail-Adresse besteht bereits ein Konto.' };
  const id = repo.createUser(email, hashPassword(password), name);
  await createSession(id);
  redirect('/dashboard');
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const user = repo.findUserByEmail(str(fd, 'email').toLowerCase());
  if (!user || !verifyPassword(String(fd.get('password') ?? ''), user.pw_hash)) {
    return { error: 'E-Mail oder Passwort ist falsch.' };
  }
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/');
}

export async function saveProfile(fd: FormData): Promise<void> {
  const user = await requireUser();
  repo.updateProfile(user.id, str(fd, 'name', 120), str(fd, 'street', 120), str(fd, 'zip_city', 120));
  revalidatePath('/konto');
  redirect('/konto?gespeichert=1');
}

export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (str(fd, 'confirm') !== 'LÖSCHEN') return { error: 'Bitte zur Bestätigung LÖSCHEN eingeben.' };
  repo.deleteUser(user.id);
  await destroySession();
  redirect('/?geloescht=1');
}

// ---------- Verträge ----------

export async function saveContract(id: number | null, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const category = str(fd, 'category');
  const provider = str(fd, 'provider', 120);
  const price = Number(str(fd, 'monthly_price').replace(/['’\s]/g, '').replace(',', '.'));
  const startRaw = str(fd, 'start_date');
  const minTerm = int(fd, 'min_term_months', 0, 120);
  const renewal = int(fd, 'renewal_months', 0, 60);
  const notice = int(fd, 'notice_months', 0, 24);

  if (!isCategory(category)) return { error: 'Bitte eine Kategorie wählen.' };
  if (!provider) return { error: 'Bitte den Anbieter angeben.' };
  if (!Number.isFinite(price) || price < 0 || price > 100_000) return { error: 'Bitte einen gültigen Monatspreis in CHF angeben.' };
  if (startRaw && !isISODate(startRaw)) return { error: 'Vertragsbeginn ist kein gültiges Datum.' };
  if (minTerm === null || renewal === null || notice === null) return { error: 'Laufzeit, Verlängerung und Frist müssen ganze Monate sein.' };

  const input: repo.ContractInput = {
    category,
    provider,
    product: str(fd, 'product', 120),
    customer_number: str(fd, 'customer_number', 60),
    monthly_price: Math.round(price * 100) / 100,
    start_date: startRaw || null,
    min_term_months: minTerm,
    renewal_months: renewal,
    notice_months: notice,
    to_month_end: fd.get('to_month_end') === 'on' ? 1 : 0,
    notes: str(fd, 'notes', 2000),
  };

  let target = id;
  if (id === null) {
    target = repo.createContract(user.id, input);
  } else {
    if (!repo.getContract(user.id, id)) return { error: 'Vertrag nicht gefunden.' };
    repo.updateContract(user.id, id, input);
  }
  revalidatePath('/dashboard');
  redirect(`/vertraege/${target}`);
}

export async function removeContract(id: number): Promise<void> {
  const user = await requireUser();
  repo.deleteContract(user.id, id);
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function markCancelled(id: number): Promise<void> {
  const user = await requireUser();
  const contract = repo.getContract(user.id, id);
  if (!contract) redirect('/dashboard');
  const view = viewContract(contract, [], today());
  repo.setContractStatus(user.id, id, 'gekündigt', view.deadline.endDate);
  revalidatePath('/dashboard');
  redirect(`/vertraege/${id}`);
}

export async function reactivate(id: number): Promise<void> {
  const user = await requireUser();
  repo.setContractStatus(user.id, id, 'aktiv', null);
  revalidatePath('/dashboard');
  redirect(`/vertraege/${id}`);
}

// ---------- Rechnung einlesen ----------

export interface ImportState extends FormState {
  extracted?: ExtractedContract;
  seq?: number;
}

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export async function importInvoice(prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireUser();
  let text = str(fd, 'text', 50_000);
  const file = fd.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF_BYTES) return { error: 'PDF ist grösser als 5 MB.' };
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return { error: 'Bitte eine PDF-Datei hochladen.' };
    try {
      const { extractText } = await import('unpdf');
      const { text: pdfText } = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
      text = `${text}\n${pdfText}`;
    } catch {
      return { error: 'Die PDF-Datei konnte nicht gelesen werden. Bitte Text kopieren und einfügen.' };
    }
  }
  // Datensparsamkeit: Rohtext und Datei werden nicht gespeichert, nur die erkannten Felder zurückgegeben.
  if (!text.trim()) return { error: 'Bitte Rechnungstext einfügen oder ein PDF wählen.' };
  return { extracted: extractContract(text), seq: (prev.seq ?? 0) + 1 };
}

// ---------- Wechsel und Prämien ----------

export async function recordSwitch(contractId: number, offerId: string): Promise<void> {
  const user = await requireUser();
  const contract = repo.getContract(user.id, contractId);
  const offer = offerById(offerId);
  if (!contract || !offer || offer.category !== contract.category) redirect('/dashboard');
  const all = repo.listContracts(user.id);
  const switches = repo.listSwitches(user.id);
  const todayISO = today();
  const eligible = bonusEligibility(offer, historyOf(all, switches), todayISO) === null;
  const view = viewContract(contract, [], todayISO);
  // Annahme: Prämien werden meist innert 90 Tagen nach Vertragsstart gutgeschrieben.
  const expectedBy = toISO(addDays(parseISO(view.deadline.endDate), 90));
  repo.createSwitch(user.id, {
    contract_id: contract.id,
    offer_id: offer.id,
    new_provider: offer.provider,
    expected_bonus: eligible ? offer.bonusChf : 0,
    expected_by: expectedBy,
  });
  revalidatePath('/praemien');
  redirect('/praemien');
}

export async function updateSwitch(id: number, fd: FormData): Promise<void> {
  const user = await requireUser();
  const status = str(fd, 'status');
  if (status === 'erwartet' || status === 'erhalten' || status === 'reklamiert' || status === 'verfallen') {
    repo.setSwitchStatus(user.id, id, status);
  }
  revalidatePath('/praemien');
  redirect('/praemien');
}
