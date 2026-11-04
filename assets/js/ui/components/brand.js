// ===================== UI: THE COMMUNITY'S BRAND =====================
// The header and desktop rail's wordmark, from config/club.js: every word in
// the text colour, the last one in gold ("Money <b>Padel</b>").
// Loads before app.js; declarations only.

function clubWordmarkHtml(){
  const words = (CLUB.wordmark && CLUB.wordmark.length) ? CLUB.wordmark : [CLUB.name];
  if(words.length === 1) return `<b>${escapeHtml(words[0])}</b>`;
  return `${words.slice(0, -1).map(escapeHtml).join(' ')} <b>${escapeHtml(words[words.length - 1])}</b>`;
}
