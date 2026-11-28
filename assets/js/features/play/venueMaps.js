// ===================== WHERE A GAME IS: A GOOGLE MAPS LINK PER VENUE =====================
// Shaun, 28 Nov: "I want to be able to add a Google location too for the club
// we're playing at."
//
// Every game with a venue shows it as a Directions link. Until an Admin pins
// the place, that link is a Google Maps search for the venue's name; once an
// Admin pastes the venue's Google Maps link (Manage fixture › Google Maps
// link) it is saved for that venue -- every game there, past and future, opens
// the exact place. One shared, Admin-written document (moneypadel_venues):
//   { "<venue, lower case>": { name, url, by, at } }
// Declarations only.

const STORAGE_KEY_VENUES = 'moneypadel_venues';
let venueMapsState = {};
let venueMapsLoaded = null;   // the load in progress, or done

const venueKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

// A Google Maps link, pulled out of whatever was pasted (Share text often
// carries the place's name before the link). Null when there isn't one.
function googleMapsUrlFrom(text){
  const m = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  if(!m) return null;
  let u;
  try { u = new URL(m[0]); } catch(e){ return null; }
  if(u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  // google.com, google.co.uk, google.com.au, google.de ... and nothing after.
  const GOOGLE = '(?:google)\\.(?:com|[a-z]{2}|co\\.[a-z]{2}|com\\.[a-z]{2})';
  const ok = host === 'maps.app.goo.gl'
    || (host === 'goo.gl' && u.pathname.startsWith('/maps'))
    || new RegExp(`^maps\\.${GOOGLE}$`).test(host)
    || (new RegExp(`^${GOOGLE}$`).test(host) && u.pathname.startsWith('/maps'))
    || (host === 'g.co' && u.pathname.startsWith('/kgs'));
  if(!ok) return null;
  u.protocol = 'https:';
  return u.toString();
}

function savedVenueMap(venue){
  const v = venueMapsState[venueKey(venue)];
  return v && v.url ? v.url : '';
}

function venueMapUrl(venue){
  if(!String(venue || '').trim()) return '';
  return savedVenueMap(venue) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(venue).trim())}`;
}

const VENUE_PIN_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

// The venue as a link that opens Google Maps (the app, where it is installed).
function venueLinkHtml(venue){
  if(!String(venue || '').trim()) return '';
  ensureVenueMaps();
  const pinned = !!savedVenueMap(venue);
  return `<a class="venue-link" href="${escapeHtml(venueMapUrl(venue))}" target="_blank" rel="noopener" data-venue-pinned="${pinned}">
    ${VENUE_PIN_ICON}<span class="venue-link-name">${escapeHtml(String(venue).trim())}</span><span class="venue-link-go">Directions ›</span></a>`;
}

// Loaded once, on first use; what is on screen is redrawn when it arrives.
function ensureVenueMaps(){
  if(venueMapsLoaded) return venueMapsLoaded;
  venueMapsLoaded = (async () => {
    try {
      const v = await fsGet(STORAGE_KEY_VENUES);
      const parsed = v ? JSON.parse(v) : {};
      venueMapsState = parsed && typeof parsed === 'object' ? parsed : {};
    } catch(e){ venueMapsState = {}; }
    if(Object.keys(venueMapsState).length){
      if(typeof refreshShellScreen === 'function') refreshShellScreen();
    }
  })();
  return venueMapsLoaded;
}

// Pin (or, with an empty url, unpin) the venue's place. Admins only.
async function saveVenueMap(venue, url){
  const key = venueKey(venue);
  if(!key) return { ok: false, message: 'Add the venue first.' };
  if(!isUnlocked) return { ok: false, message: 'Only an Admin can pin a venue.' };
  await ensureVenueMaps();
  const next = { ...venueMapsState };
  if(url) next[key] = { name: String(venue).trim(), url, by: typeof fixtureAdminName === 'function' ? fixtureAdminName() : '', at: new Date().toISOString() };
  else delete next[key];
  try { await fsSet(STORAGE_KEY_VENUES, JSON.stringify(next)); }
  catch(e){ return { ok: false, message: 'The map link couldn’t be saved. Try again.' }; }
  venueMapsState = next;
  return { ok: true };
}
