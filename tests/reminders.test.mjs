import assert from 'node:assert/strict';
import { createDecipheriv, createECDH, hkdfSync, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// La funció és un .ts sense tipus: es carrega com a JavaScript.
const source = await readFile(
  new URL('../supabase/functions/family-reminders/index.ts', import.meta.url),
  'utf8',
);
const { buildReminders, encryptPayload, handle, vapidAuthorization } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
);

const b64 = (bytes) => Buffer.from(bytes).toString('base64url');

test('el xifratge coincideix amb l\'exemple de l\'RFC 8291', async () => {
  const body = await encryptPayload(
    'When I grow up, I want to be a watermelon',
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'BTBZMqHH6r4Tts7J_aSIgg',
    {
      publicKey: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      privateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    },
    'DGv6ra1nlYgDCS1FRnbzlw',
  );
  assert.equal(
    b64(body),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  );
});

function decrypt(body, browser, auth) {
  const salt = body.subarray(0, 16);
  const keyLength = body[20];
  const asPublic = body.subarray(21, 21 + keyLength);
  const cipher = body.subarray(21 + keyLength);
  const shared = browser.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), browser.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, info, 32));
  const key = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12));
  const decipher = createDecipheriv('aes-128-gcm', key, nonce);
  decipher.setAuthTag(cipher.subarray(-16));
  const plain = Buffer.concat([decipher.update(cipher.subarray(0, -16)), decipher.final()]);
  return plain.subarray(0, -1).toString();
}

function newBrowser() {
  const keys = createECDH('prime256v1');
  keys.generateKeys();
  const auth = Buffer.alloc(16, 7);
  return { keys, auth, p256dh: b64(keys.getPublicKey()), authText: b64(auth) };
}

test('un navegador pot desxifrar el missatge amb accents', async () => {
  const browser = newBrowser();
  const body = await encryptPayload('Demà: Barça', browser.p256dh, browser.authText);
  assert.equal(decrypt(Buffer.from(body), browser.keys, browser.auth), 'Demà: Barça');
});

function newVapid() {
  const keys = createECDH('prime256v1');
  keys.generateKeys();
  return {
    keys,
    publicKey: b64(keys.getPublicKey()),
    privateKey: b64(keys.getPrivateKey()),
    subject: 'mailto:avisos@example.com',
  };
}

test('la signatura VAPID és vàlida i indica el servei de destí', async () => {
  const vapid = newVapid();
  const header = await vapidAuthorization('https://push.example.com/abc/def', vapid, 1000000);
  const [, jwt, key] = /^vapid t=(.+), k=(.+)$/.exec(header);
  assert.equal(key, vapid.publicKey);

  const [head, claims, signature] = jwt.split('.');
  const payload = JSON.parse(Buffer.from(claims, 'base64url').toString());
  assert.equal(payload.aud, 'https://push.example.com');
  assert.equal(payload.sub, 'mailto:avisos@example.com');
  assert.equal(payload.exp, 1000 + 43200);

  const publicKey = {
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64(vapid.keys.getPublicKey().subarray(1, 33)),
      y: b64(vapid.keys.getPublicKey().subarray(33)),
    },
    format: 'jwk',
    dsaEncoding: 'ieee-p1363',
  };
  assert.ok(
    verify('sha256', Buffer.from(`${head}.${claims}`), publicKey, Buffer.from(signature, 'base64url')),
  );
});

const members = [
  { id: 'm1', email: 'una@example.com' },
  { id: 'm2', email: 'dos@example.com' },
];

const agenda = [
  { title: 'Dentista', starts_at: '2026-11-05T08:30:00Z', all_day: false },
  { title: 'Festa', starts_at: '2026-11-04T23:00:00Z', all_day: true },
  { title: 'Altre dia', starts_at: '2026-11-08T08:30:00Z', all_day: false },
];
const tasks = [
  { title: 'Rentadora', assignee_id: 'm1', due_date: '2026-11-05', done_at: null },
  { title: 'Feta', assignee_id: 'm1', due_date: '2026-11-05', done_at: '2026-11-04T10:00:00Z' },
  { title: 'Per a tothom', assignee_id: null, due_date: '2026-11-05', done_at: null },
  { title: 'Un altre dia', assignee_id: 'm2', due_date: '2026-11-06', done_at: null },
];

test('al vespre avisa de les cites de demà a cada membre', () => {
  const reminders = buildReminders(new Date('2026-11-04T19:07:00Z'), agenda, tasks, members);
  assert.deepEqual(reminders[0], {
    key: 'agenda-2026-11-05-vespre-m1',
    title: 'Demà',
    body: 'Festa\n09:30 Dentista',
    memberId: 'm1',
  });
  assert.equal(reminders[1].memberId, 'm2');
  assert.equal(reminders.length, 2);
});

test('al matí avisa de les cites i les tasques d\'avui', () => {
  const reminders = buildReminders(new Date('2026-11-05T07:07:00Z'), agenda, tasks, members);
  assert.deepEqual(reminders.map((item) => [item.key, item.body, item.memberId]), [
    ['agenda-2026-11-05-mati-m1', 'Festa\n09:30 Dentista', 'm1'],
    ['agenda-2026-11-05-mati-m2', 'Festa\n09:30 Dentista', 'm2'],
    ['tasques-2026-11-05-m1', 'Rentadora', 'm1'],
    ['tasques-2026-11-05-tothom', 'Per a tothom', null],
  ]);
});

test('una cita amb convidats només s\'avisa a ells', () => {
  const invited = [
    { title: 'Metge', starts_at: '2026-11-05T08:30:00Z', all_day: false, attendee_emails: ['dos@example.com'] },
    { title: 'Tothom', starts_at: '2026-11-05T10:30:00Z', all_day: false, attendee_emails: [] },
  ];
  const reminders = buildReminders(new Date('2026-11-05T07:07:00Z'), invited, [], members);
  assert.deepEqual(reminders.map((item) => [item.memberId, item.body]), [
    ['m1', '11:30 Tothom'],
    ['m2', '09:30 Metge\n11:30 Tothom'],
  ]);
});

test('si cap convidat és de la família, s\'avisa a tothom', () => {
  const outside = [
    { title: 'Reunió', starts_at: '2026-11-05T08:30:00Z', all_day: false, attendee_emails: ['fora@example.com'] },
  ];
  assert.equal(buildReminders(new Date('2026-11-05T07:07:00Z'), outside, [], members).length, 2);
});

test('l\'hora d\'enviar segueix l\'horari de Madrid a l\'estiu', () => {
  const summer = [{ title: 'Cita', starts_at: '2026-07-02T10:00:00Z', all_day: false }];
  assert.equal(buildReminders(new Date('2026-07-01T18:07:00Z'), summer, [], members).length, 2);
  assert.equal(buildReminders(new Date('2026-07-01T19:07:00Z'), summer, [], members).length, 0);
});

test('fora d\'hora no avisa de res', () => {
  assert.deepEqual(buildReminders(new Date('2026-11-04T12:07:00Z'), agenda, tasks, members), []);
});

const browser = newBrowser();
const vapid = newVapid();
const env = {
  cronSecret: 'secret',
  supabaseUrl: 'https://projecte.test',
  serviceKey: 'clau',
  vapid,
};

const post = (secret, body) =>
  new Request('https://funcio.test', {
    method: 'POST',
    headers: secret ? { 'x-family-cron': secret } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

function fakeServer({ claimed = [], pushStatus = 201 } = {}) {
  const pushes = [];
  const deleted = [];
  const fetcher = async (url, options = {}) => {
    if (url.startsWith('https://push.test')) {
      pushes.push({ url, ...options });
      return new Response(null, { status: pushStatus });
    }
    if (url.includes('/push_subscriptions') && options.method === 'DELETE') {
      deleted.push(decodeURIComponent(url));
      return new Response(null, { status: 204 });
    }
    if (url.includes('/push_subscriptions')) {
      return Response.json([
        { endpoint: 'https://push.test/1', member_id: 'm1', p256dh: browser.p256dh, auth: browser.authText },
        { endpoint: 'https://push.test/2', member_id: 'm2', p256dh: browser.p256dh, auth: browser.authText },
      ]);
    }
    if (url.includes('/members')) return Response.json(members);
    if (url.includes('/agenda_events')) return Response.json(agenda);
    if (url.includes('/tasks')) return Response.json(tasks);
    if (url.includes('/sent_reminders')) {
      const { key } = JSON.parse(options.body);
      return Response.json(claimed.includes(key) ? [] : [{ key }]);
    }
    throw new Error(`inesperat: ${url}`);
  };
  return { fetcher, pushes, deleted };
}

const morning = new Date('2026-11-05T07:07:00Z');

test('sense el secret no s\'envia res', async () => {
  const { fetcher, pushes } = fakeServer();
  assert.equal((await handle(post(), env, fetcher, morning)).status, 401);
  assert.equal(pushes.length, 0);
});

test('cada aviso arriba a qui toca, xifrat', async () => {
  const { fetcher, pushes } = fakeServer();
  const response = await handle(post('secret'), env, fetcher, morning);
  assert.deepEqual(await response.json(), { reminders: 4, sent: 5 });

  const titles = pushes.map((push) => [
    push.url,
    JSON.parse(decrypt(Buffer.from(push.body), browser.keys, browser.auth)).body,
  ]);
  assert.deepEqual(titles, [
    ['https://push.test/1', 'Festa\n09:30 Dentista'],
    ['https://push.test/2', 'Festa\n09:30 Dentista'],
    ['https://push.test/1', 'Rentadora'],
    ['https://push.test/1', 'Per a tothom'],
    ['https://push.test/2', 'Per a tothom'],
  ]);
  assert.equal(pushes[0].headers['content-encoding'], 'aes128gcm');
  assert.match(pushes[0].headers.authorization, /^vapid t=/);
});

test('un aviso ja enviat no es repeteix', async () => {
  const { fetcher, pushes } = fakeServer({
    claimed: ['agenda-2026-11-05-mati-m1', 'agenda-2026-11-05-mati-m2', 'tasques-2026-11-05-tothom'],
  });
  await handle(post('secret'), env, fetcher, morning);
  assert.deepEqual(pushes.map((push) => push.url), ['https://push.test/1']);
});

test('una subscripció caducada s\'esborra', async () => {
  const { fetcher, deleted } = fakeServer({ pushStatus: 410 });
  await handle(post('secret', { test: true }), env, fetcher, morning);
  assert.equal(deleted.length, 2);
  assert.ok(deleted[0].includes('endpoint=eq.https://push.test/1'));
});

test('l\'aviso de prova arriba a tothom a qualsevol hora', async () => {
  const { fetcher, pushes } = fakeServer();
  const response = await handle(
    post('secret', { test: true }), env, fetcher, new Date('2026-11-04T12:00:00Z'),
  );
  assert.deepEqual(await response.json(), { reminders: 1, sent: 2 });
  assert.equal(pushes.length, 2);
});
