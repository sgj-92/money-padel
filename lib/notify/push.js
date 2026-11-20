// ===================== NOTIFICATIONS: SENDING =====================
// Who is asking (a signed-in player or Admin of this community, proven by
// their own Firebase ID token), whose phones to reach (pushSubscriptions,
// read WITH that token -- the rules let members read them), and the send
// itself (Web Push, signed with the club's VAPID key from Vercel's
// environment). A phone that has gone away answers 404 / 410; its entry is
// deleted so it is not tried again.

'use strict';

const { uidOf } = require('../askClaude/admin.js');

// The public half of the key pair. The private half is VAPID_PRIVATE_KEY in
// Vercel and never in the repository. The page uses the same public key
// (features/players/notificationsScreen.js).
const VAPID_PUBLIC_KEY = 'BNDX1bn4mSdz5T4Fvh8G3mmFoSa__yXReUeukz9oEBrmixmKKP_LH-0Gg3RVhT7_2amaiNdAF0uUh8OjyjCCwAI';

const base = (projectId) => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// -> { ok, uid, name, admin } | { ok: false, status, message }
async function whoIsAsking({ token, projectId, fetchImpl }) {
  const uid = token && uidOf(token);
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { ok: false, status: 401, message: 'Sign in first.' };
  const get = (path) => fetchImpl(`${base(projectId)}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const admin = await get(`admins/${encodeURIComponent(uid)}`);
  if (admin.status === 401) return { ok: false, status: 401, message: 'Your sign-in has expired. Sign in again.' };
  if (admin.ok) { const f = (await admin.json()).fields || {}; return { ok: true, uid, admin: true, name: (f.name && f.name.stringValue) || 'An Admin' }; }
  const player = await get(`playerAccounts/${encodeURIComponent(uid)}`);
  if (player.ok) { const f = (await player.json()).fields || {}; if (f.player && f.player.stringValue) return { ok: true, uid, admin: false, name: f.player.stringValue }; }
  return { ok: false, status: 403, message: 'Only a signed-in player or Admin can send notifications.' };
}

// Every phone signed up for these players: [{ name, player, endpoint, keys }]
async function subscriptionsFor({ names, token, projectId, fetchImpl }) {
  if (!names.length) return [];
  const res = await fetchImpl(`${base(projectId)}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'pushSubscriptions' }],
      where: { fieldFilter: { field: { fieldPath: 'player' }, op: 'IN', value: { arrayValue: { values: names.map((n) => ({ stringValue: n })) } } } } } }),
  });
  if (!res.ok) { const e = new Error(`reading phones failed (${res.status})`); e.status = res.status; throw e; }
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => {
    const f = r.document.fields || {};
    const s = (k) => (f[k] && f[k].stringValue) || '';
    return { name: r.document.name, player: s('player'), endpoint: s('endpoint'), keys: { p256dh: s('p256dh'), auth: s('auth') } };
  }).filter((x) => x.endpoint && x.keys.p256dh && x.keys.auth);
}

async function forget({ docName, token, fetchImpl }) {
  try { await fetchImpl(`https://firestore.googleapis.com/v1/${docName}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch (e) { /* tried */ }
}

// -> { sent, gone, failed, problems: [{ status, detail }] } -- what the push
// services said when they refused, so a failed test can say why.
async function sendAll({ subs, payload, privateKey, subject, webpush, token, fetchImpl }) {
  let sent = 0, gone = 0, failed = 0;
  const problems = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload),
        { TTL: 12 * 3600, vapidDetails: { subject, publicKey: VAPID_PUBLIC_KEY, privateKey } });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { gone++; await forget({ docName: s.name, token, fetchImpl }); }
      else {
        failed++;
        problems.push({ status: (e && e.statusCode) || null, detail: String((e && (e.body || e.message)) || '').slice(0, 160) });
        console.error('push failed', e && e.statusCode, e && e.body);
      }
    }
  }));
  return { sent, gone, failed, problems };
}

module.exports = { VAPID_PUBLIC_KEY, whoIsAsking, subscriptionsFor, sendAll };
