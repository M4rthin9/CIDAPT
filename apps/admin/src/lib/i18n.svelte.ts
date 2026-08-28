export type Lang = 'th' | 'en';

const LANG_KEY = 'cida-admin-lang';

/**
 * Admin UI language. Thai is the default because the operators work in Thai;
 * English is the fallback for the bilingual content editors.
 *
 * Shared module-level state so the topbar toggle drives every screen at once
 * rather than each component holding its own copy.
 */
class LangStore {
  current = $state<Lang>(read());

  get value(): Lang {
    return this.current;
  }

  set(next: Lang) {
    this.current = next;
    localStorage.setItem(LANG_KEY, next);
  }

  toggle() {
    this.set(this.current === 'th' ? 'en' : 'th');
  }

  /** Picks the matching half of a Thai/English pair. */
  pick(th: string, en: string): string {
    return this.current === 'th' ? th : en;
  }
}

function read(): Lang {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'th';
}

export const lang = new LangStore();

/** `t('ไทย', 'English')` — shorthand for the active language. */
export function t(th: string, en: string): string {
  return lang.pick(th, en);
}

/** Satang are the storage unit everywhere; baht only ever appear at the edges. */
export function formatSatang(satang: number | null | undefined): string {
  if (satang === null || satang === undefined) return '—';
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Unix seconds → local date-time string. */
export function formatDate(unix: number | null | undefined): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString(lang.value === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Unix seconds → `YYYY-MM-DD` for `<input type="date">`. */
export function toDateInput(unix: number | null | undefined): string {
  if (!unix) return '';
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → unix seconds, or null when the field is blank. */
export function fromDateInput(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(`${value}T00:00:00`);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Unix seconds → `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function toDateTimeInput(unix: number | null | undefined): string {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` → unix seconds, or null when the field is blank. */
export function fromDateTimeInput(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}
