// ===================== ASK CLAUDE: WHO MAY ASK =====================
// Only an Admin of this community. The page sends the signed-in Admin's
// Firebase ID token; we ask the community's own database for that Admin's
// entry WITH that token. The database rules let a signed-in person read only
// their own admins/{uid} entry, and Firestore checks the token's signature,
// project and expiry -- so a forged, expired or other project's token, a
// member's token, or none at all, all fail here.

'use strict';

function uidOf(token) {
  try {
    const part = String(token).split('.')[1];
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof json.user_id === 'string' ? json.user_id : (typeof json.sub === 'string' ? json.sub : null);
  } catch (e) { return null; }
}

async function verifyAdmin({ token, projectId, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const uid = token && uidOf(token);
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { ok: false, status: 401, message: 'Sign in as an Admin first.' };
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
  const res = await doFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) return { ok: false, status: 401, message: 'Your sign-in has expired. Sign in again.' };
  if (!res.ok) return { ok: false, status: 403, message: 'Only an Admin can ask Claude.' };
  const doc = await res.json();
  const f = doc.fields || {};
  return { ok: true, uid, name: (f.name && f.name.stringValue) || '', role: (f.role && f.role.stringValue) || '' };
}

module.exports = { verifyAdmin, uidOf };
