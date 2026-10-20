// Ashraf IELTS Practice: lets the instructor set a new password for a trainee.
// Only an active admin (users/{uid}.role == 'admin') can call it.
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
admin.initializeApp();

const ALLOWED = ['https://ashrafrashid50-web.github.io'];

functions.http('resetTraineePassword', async (req, res) => {
  const origin = req.get('origin') || '';
  if (ALLOWED.includes(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  try {
    const m = (req.get('authorization') || '').match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: 'Please sign in again.' });
    const caller = await admin.auth().verifyIdToken(m[1]);
    const me = await admin.firestore().doc('users/' + caller.uid).get();
    if (!me.exists || me.get('role') !== 'admin' || me.get('active') !== true)
      return res.status(403).json({ error: 'Only the instructor can reset passwords.' });

    const { uid, password } = req.body || {};
    if (typeof uid !== 'string' || !uid) return res.status(400).json({ error: 'Missing trainee.' });
    if (typeof password !== 'string' || password.length < 6 || password.length > 64)
      return res.status(400).json({ error: 'The new password must be 6 to 64 characters.' });
    const target = await admin.firestore().doc('users/' + uid).get();
    if (!target.exists || target.get('role') === 'admin')
      return res.status(400).json({ error: 'That account cannot be reset here.' });

    await admin.auth().updateUser(uid, { password });
    await admin.auth().revokeRefreshTokens(uid);
    await admin.firestore().doc('traineeSecrets/' + uid).set({
      username: target.get('username') || '',
      password,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    const code = String(e && e.code || '');
    if (code.startsWith('auth/id-token') || code === 'auth/argument-error')
      return res.status(401).json({ error: 'Please sign in again.' });
    if (code === 'auth/user-not-found') return res.status(404).json({ error: 'This trainee has no login account.' });
    return res.status(500).json({ error: 'The password could not be reset. Please try again.' });
  }
});
