// ===================== UI: SKELETONS WHILE READING =====================
// Shaun, 22 Nov: "skeleton loaders instead of blocking spinners." The shape
// of what is coming, shimmering, in place of "Reading…". The words are kept
// for screen readers. Declarations only.

// rows: how many lines; kind: 'rows' (label + value) | 'cards' (tall blocks)
function skeletonHtml(label, rows, kind){
  const n = Math.max(1, rows || 4);
  const one = kind === 'cards' ? '<div class="skel is-tall"></div>' : '<div class="skel-row"><div class="skel"></div><div class="skel"></div></div>';
  return `<div class="skel-list" role="status" aria-live="polite"><span class="sr-only">${escapeHtml(label || 'Loading…')}</span>${one.repeat(n)}</div>`;
}
