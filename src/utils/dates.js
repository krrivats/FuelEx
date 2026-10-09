/**
 * Local-time date helpers.
 * `new Date().toISOString()` is UTC, so in India (UTC+5:30) it returns *yesterday*
 * between 00:00 and 05:30. Business dates must always use the device's local calendar.
 */
const p2 = (n) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Local month as YYYY-MM */
export function localMonth(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
