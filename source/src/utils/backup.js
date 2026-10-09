/**
 * Backup helpers — UI-layer only. Reads/writes through the existing
 * repository export/import functions; never touches data formats.
 */
import { exportFuelExDataJson } from '../data/repository.js';

const LAST_BACKUP_KEY = 'fuelex-ui-lastbackup'; // UI preference, outside the FuelExData blob

export function getLastBackupAt() {
  try {
    const v = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

export function markBackupDone() {
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch { /* ignore */ }
}

export function backupFileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `FuelEx-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export function buildBackupFile() {
  const json = exportFuelExDataJson();
  const name = backupFileName();
  return { json, name, file: new File([json], name, { type: 'application/json' }) };
}

/** Summary used to compare "this device" with a backup before restoring. */
export function summarizeBackup(parsed) {
  const entries = parsed?.operations?.dailyEntries || [];
  const dates = entries.map(e => e.date).filter(Boolean).sort();
  return {
    entries: entries.length,
    latestDate: dates.length ? dates[dates.length - 1] : null,
    customers: (parsed?.masters?.customers || []).length,
    employees: (parsed?.masters?.employees || []).length,
  };
}

export function summarizeThisDevice() {
  try { return summarizeBackup(JSON.parse(exportFuelExDataJson())); }
  catch { return { entries: 0, latestDate: null, customers: 0, employees: 0 }; }
}

export function downloadBackup() {
  const { json, name } = buildBackupFile();
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  markBackupDone();
  return name;
}

export function canShareFiles() {
  try {
    const { file } = buildBackupFile();
    return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch { return false; }
}

/**
 * Opens the phone's share sheet (WhatsApp, Gmail, Drive…) with the backup file attached.
 * Returns 'shared' | 'cancelled' | 'downloaded'.
 */
export async function shareBackup() {
  const { file, name } = buildBackupFile();
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'FuelEx backup', text: `FuelEx backup ${name}` });
      markBackupDone();
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBackup();
  return 'downloaded';
}

export function describeAge(ts) {
  if (!ts) return 'Never';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
