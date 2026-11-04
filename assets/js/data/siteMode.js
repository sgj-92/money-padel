// ===================== SITE MODE: STANDINGS =====================
// mpstandings.sgj.luxe is the same app in a read-only "standings" mode for the
// group's WhatsApp (Shaun, 30 Oct): League (this month and every month before
// it), Power and Results -- nothing personal, nothing to submit, no Admin, and
// no way through to the full app. vercel.json sends every other path on that
// address back to the standings.
//
// It is the address that decides; `?standings` does the same anywhere, so it
// can be checked on a laptop or in tests.
//
// This hides the full app from the link; it does not secure the record. The
// shared storage is still open (Ledger, Section 3) -- the Admin sign-in for
// writes is the protection, and is planned before the full app goes to members.
//
// Loads before app.js; declarations only.

// The community's standings addresses come from config/club.js.
function isStandingsHost(host){
  return (CLUB.standingsHosts || []).some(re => re.test(String(host || '')));
}

function isStandingsMode(){
  if(typeof location === 'undefined') return false;
  return isStandingsHost(location.hostname)
    || /(?:^|&)standings(?:=[^&]*)?(?:&|$)/.test(String(location.search || '').replace(/^\?/, ''));
}
