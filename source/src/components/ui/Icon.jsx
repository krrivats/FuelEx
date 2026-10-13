/**
 * FuelEx icon set — one consistent 24px outline style (1.75 stroke).
 * Usage: <Icon name="fuel" /> · size via className="icon-sm" | "icon-lg"
 */
const P = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  list: 'M9 4h6v3H9z M8 5.5H6a1 1 0 00-1 1V20a1 1 0 001 1h12a1 1 0 001-1V6.5a1 1 0 00-1-1h-2 M9 12h6 M9 16h6',
  gauge: 'M12 14l4-4 M3.3 18a10 10 0 1117.4 0',
  card: 'M3 6h18v12H3z M3 10h18 M7 15h3',
  bank: 'M3 10l9-6 9 6 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 21h18',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z M9 8h6 M9 12h6',
  cash: 'M2 6h20v12H2z M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M6 12h.01 M18 12h.01',
  fuel: 'M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16 M3 21h12 M14 10h2a2 2 0 012 2v3a1.5 1.5 0 003 0V8l-3-3 M7 8h4',
  droplet: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  users: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1 M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M21 20v-1a4 4 0 00-3-3.9 M16 4.2a3.5 3.5 0 010 6.6',
  trending: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z M14 3v5h5 M9 13h6 M9 17h6',
  database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  settings: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  panel: 'M3 4h18v16H3z M9 4v16',
  chevron: 'M9 6l6 6-6 6',
  x: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 11v5 M12 8h.01',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.3-4.3',
  plus: 'M12 5v14 M5 12h14',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  inbox: 'M3 13l3-8h12l3 8v6H3z M3 13h5l1 3h6l1-3h5',
  share: 'M18 8a3 3 0 100-6 3 3 0 000 6z M6 15a3 3 0 100-6 3 3 0 000 6z M18 22a3 3 0 100-6 3 3 0 000 6z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4',
  download: 'M12 4v11 M7 11l5 5 5-5 M4 20h16',
  upload: 'M12 16V5 M7 9l5-5 5 5 M4 20h16',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4z M12 8a4 4 0 100 8 4 4 0 000-8z M17.5 6.5h.01',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4 M12 15v2',
  flask: 'M9 3h6 M10 3v6L4.5 18.5A1.7 1.7 0 006 21h12a1.7 1.7 0 001.5-2.5L14 9V3 M7 15h10',
  tool: 'M14.7 6.3a4 4 0 005 5L21 15l-6 6-3.5-3.5L3 9l4-4 3.5 3.5z',
};

export default function Icon({ name, className = '', title, ...rest }) {
  const d = P[name] || P.info;
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
      {...rest}
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={(i === 0 ? '' : 'M') + seg} />
      ))}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P);
