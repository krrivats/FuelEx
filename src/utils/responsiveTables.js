/**
 * Phones: tables are shown as stacked cards (no sideways scrolling).
 * This copies each column heading onto its cells as `data-label`, which the CSS
 * (index.css, max-width: 768px) prints next to the value. Desktop is unaffected.
 */
export function labelTables(root) {
  if (!root) return;
  root.querySelectorAll('table.table').forEach((table) => {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const heads = [];
    Array.from(headRow.children).forEach((th) => {
      const span = Number(th.getAttribute('colspan')) || 1;
      const text = (th.textContent || '').replace(/\s+/g, ' ').trim();
      for (let i = 0; i < span; i += 1) heads.push(text);
    });
    table.querySelectorAll('tbody tr').forEach((tr) => {
      let col = 0;
      Array.from(tr.children).forEach((td) => {
        const span = Number(td.getAttribute('colspan')) || 1;
        if (span === 1 && heads[col] && td.getAttribute('data-label') !== heads[col]) {
          td.setAttribute('data-label', heads[col]);
        }
        col += span;
      });
    });
  });
}

/** Keeps labels fresh as pages render and data changes. Returns a cleanup function. */
export function watchTables(root) {
  if (!root || typeof MutationObserver === 'undefined') return () => {};
  let raf = 0;
  const run = () => { raf = 0; labelTables(root); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
  labelTables(root);
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
  return () => { observer.disconnect(); if (raf) cancelAnimationFrame(raf); };
}
