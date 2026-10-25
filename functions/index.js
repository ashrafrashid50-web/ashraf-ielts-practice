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

// ---------------------------------------------------------------------------
// Grade 12 writing: AI-suggested marks. The instructor opens a script in Marking,
// this function reads the submission, asks Claude to mark it against the rubric,
// and stores a DRAFT in aiDrafts/{submissionId} (instructor-only collection).
// Nothing is sent to the student until the instructor approves/edits and saves.
// Requires the secret ANTHROPIC_API_KEY (see SETUP-AI-MARKING.txt).
// ---------------------------------------------------------------------------
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const RUBRIC = `Grade 11 Advanced / 12 General Writing Rubric (Part 1.2 essay). Score each criterion 0-5.
TASK COMPLETION: 5 addresses all parts of the prompt with relevant, clear, detailed ideas; develops points with detailed reasons, explanations, justifications or comparisons. 4 addresses all parts, one part less developed; most points supported, some lack detail. 3 addresses most parts; one part missing or only mentioned; ideas relevant but simple; limited reasons. 2 addresses only part of the prompt; more than one part missing or undeveloped; little support. 1 a few ideas loosely related to the prompt.
STRUCTURE: 5 well-developed paragraphs with clear topic sentences and supporting details; conventional features of the text type; suitable tone/formality; logical order; range of connectors; reads as a connected whole. 4 paragraphs with topic sentences and support; generally follows text type; developing awareness of audience; logical but some repetitive connectors. 3 paragraphs but topic sentences missing/unclear in some; limited text-type features; basic or sometimes incorrect linking. 2 at most one paragraph or connected sentences with little paragraphing; order unclear in places. 1 little order; isolated sentences or phrases.
GRAMMAR: 5 range of simple and complex sentences (relative clauses, conditionals, passives, reported speech, participle clauses) used flexibly with good control; occasional errors not affecting meaning. 4 simple and a wide range of complex sentences, generally good control; errors in complex structures noticeable but rarely affect meaning. 3 mainly simple and compound with some complex sentences, often inaccurate; errors sometimes affect meaning. 2 simple sentences with limited control; frequent errors affect meaning. 1 mainly fragments.
VOCABULARY: 5 wide range incl. less common, topic-specific and some abstract words used precisely; some repetition acceptable. 4 wide range appropriate to topic incl. less common words; some repetition or occasional inaccurate choices not affecting meaning. 3 mostly common vocabulary adequate for main ideas; repetition/inaccuracy sometimes confuses. 2 limited, repetitive; not sufficient for some parts; meaning often unclear. 1 too few appropriate words.
SPELLING AND PUNCTUATION: 5 almost all words correct incl. challenging ones; wide range of punctuation used accurately. 4 common and most challenging words correct; range of punctuation mostly correct, occasional errors. 3 most common words correct, challenging words often misspelled; capitals, periods, commas, question marks correct in most sentences. 2 some common words correct, frequent errors; capitals/periods inconsistent. 1 almost no words correct; little or no punctuation.
0 in ALL criteria (whole script): no response, unrelated to the task, or wholly copied from the question paper/source text/outside source including AI tools.`;

function extractJson(t) { const m = String(t || '').match(/\{[\s\S]*\}/); if (!m) throw Error('No JSON in reply'); return JSON.parse(m[0]); }
const clamp = (v, lo, hi) => { v = Math.round(Number(v) * 2) / 2; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };

async function isGrade12(test) {
  if (!test) return false;
  if (test.area === 'g12') return true;
  if (test.fromPractice) { const p = await admin.firestore().doc('tests/' + test.fromPractice).get(); return p.exists && p.get('area') === 'g12'; }
  return false;
}

async function suggestFor(subId) {
  const db = admin.firestore();
  const sub = await db.doc('submissions/' + subId).get();
  if (!sub.exists) throw Object.assign(Error('Submission not found.'), { http: 404 });
  const s = sub.data();
  if (s.source !== 'html-writing') throw Object.assign(Error('Not a writing submission.'), { http: 400 });
  const tSnap = await db.doc('tests/' + s.testId).get();
  const test = tSnap.exists ? tSnap.data() : null;
  if (!(await isGrade12(test))) throw Object.assign(Error('Not a Grade 12 writing test.'), { http: 400 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(Error('AI marking is not set up (missing ANTHROPIC_API_KEY).'), { http: 500 });

  const system = `You are an experienced UAE Grade 12 General English teacher marking an End-of-Term writing test. Be fair, consistent and evidence-based. The student is a B1-level learner.
The script has two parts.
PART 1.1 (15 marks): the student read a short text ("The Skills Employers Want": employers value more than grades - communication, teamwork, problem-solving, adaptability; communication and teamwork explained; work changes fast so flexibility and lifelong learning matter; students can build these skills through clubs, volunteering and group projects) and had to write the main ideas in their own words in 4-5 sentences. Award up to 15: coverage of the main ideas (up to 7), own words rather than copying (up to 4), language accuracy and clarity (up to 4). Copying whole sentences from the text should lose the "own words" marks.
PART 1.2 (25 marks): opinion essay, at least 200 words: which skills are most important for your future career; how students can develop them at school; whether schools should spend more time teaching work skills. Mark with this rubric:
${RUBRIC}
Return ONLY a JSON object, no other text:
{"p11": number 0-15 (halves allowed), "tc": 0-5, "st": 0-5, "gr": 0-5, "vo": 0-5, "sp": 0-5,
 "markedText": "the student's full script with corrections inserted in square brackets like [goed -> went] or [missing: the]; keep everything else exactly as written",
 "feedback": "4-7 short sentences to the student: 2 strengths, the main things to improve with one example from their writing, and one tip for next time. Simple B1 English.",
 "teacherNote": "1-2 sentences for the teacher only: anything suspicious (e.g. language far above the student's level, copied text, off-topic) or 'No concerns.'",
 "zero": true only if the whole script should get 0 under the rubric's 0 rule, otherwise false}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system, messages: [{ role: 'user', content: `Word count reported by the test: ${s.wordCount ?? 'unknown'}.\n\nSTUDENT SCRIPT:\n\n${String(s.response || '').slice(0, 20000)}` }] })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(Error('AI service error: ' + (body.error && body.error.message || r.status)), { http: 502 });
  const text = (body.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const j = extractJson(text);
  const d = j.zero === true
    ? { p11: 0, tc: 0, st: 0, gr: 0, vo: 0, sp: 0, zero: true }
    : { p11: clamp(j.p11, 0, 15), tc: clamp(j.tc, 0, 5), st: clamp(j.st, 0, 5), gr: clamp(j.gr, 0, 5), vo: clamp(j.vo, 0, 5), sp: clamp(j.sp, 0, 5), zero: false };
  d.p12 = d.tc + d.st + d.gr + d.vo + d.sp; d.total = d.p11 + d.p12;
  const draft = { ...d, markedText: String(j.markedText || s.response || '').slice(0, 40000), feedback: String(j.feedback || '').slice(0, 4000),
    teacherNote: String(j.teacherNote || '').slice(0, 1000), model: MODEL, createdAt: admin.firestore.FieldValue.serverTimestamp() };
  await db.doc('aiDrafts/' + subId).set(draft);
  delete draft.createdAt;
  return draft;
}

functions.http('suggestWritingMarks', async (req, res) => {
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
      return res.status(403).json({ error: 'Only the instructor can use AI marking.' });
    const { submissionId } = req.body || {};
    if (typeof submissionId !== 'string' || !submissionId) return res.status(400).json({ error: 'Missing submission.' });
    return res.json({ ok: true, draft: await suggestFor(submissionId) });
  } catch (e) {
    console.error(e);
    const code = String(e && e.code || '');
    if (code.startsWith('auth/')) return res.status(401).json({ error: 'Please sign in again.' });
    return res.status(e.http || 500).json({ error: e.message || 'AI marking failed.' });
  }
});
