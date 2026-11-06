// Envia els avisos de cites i tasques amb Web Push.
// Tot és en un sol fitxer perquè es pugui enganxar a l'editor de Supabase.
// Està escrit sense tipus perquè les proves el puguin executar amb Node.

const TIME_ZONE = 'Europe/Madrid';
const MORNING_HOUR = 8;
const EVENING_HOUR = 20;
const encoder = new TextEncoder();

const fromBase64Url = (value) =>
  Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')),
    (char) => char.charCodeAt(0),
  );

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function concat(...parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hkdf(salt, secret, info, length) {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

const ecJwk = (publicRaw, privateD) => ({
  kty: 'EC',
  crv: 'P-256',
  x: toBase64Url(publicRaw.slice(1, 33)),
  y: toBase64Url(publicRaw.slice(33, 65)),
  ...(privateD ? { d: privateD } : {}),
});

const P256 = { name: 'ECDH', namedCurve: 'P-256' };

/**
 * Xifra un missatge per a un navegador (RFC 8291).
 * asKeys i salt només s'indiquen a les proves; normalment són aleatoris.
 */
export async function encryptPayload(message, p256dh, auth, asKeys = null, salt = null) {
  const uaPublic = fromBase64Url(p256dh);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, P256, false, []);

  let asPrivate;
  let asPublic;
  if (asKeys) {
    asPublic = fromBase64Url(asKeys.publicKey);
    asPrivate = await crypto.subtle.importKey(
      'jwk', ecJwk(asPublic, asKeys.privateKey), P256, false, ['deriveBits'],
    );
  } else {
    const pair = await crypto.subtle.generateKey(P256, true, ['deriveBits']);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }

  const saltBytes = salt ? fromBase64Url(salt) : crypto.getRandomValues(new Uint8Array(16));
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256),
  );

  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(fromBase64Url(auth), shared, keyInfo, 32);
  const contentKey = await hkdf(saltBytes, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(saltBytes, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const padded = concat(encoder.encode(message), new Uint8Array([2]));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(saltBytes, recordSize, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** Capçalera que identifica qui envia l'aviso (VAPID). */
export async function vapidAuthorization(endpoint, vapid, now = Date.now()) {
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: vapid.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'jwk',
    ecJwk(fromBase64Url(vapid.publicKey), vapid.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsigned),
  );
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${vapid.publicKey}`;
}

const madridParts = (instant) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    time: `${parts.hour}:${parts.minute}`,
  };
};

const nextDate = (isoDate) => {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const agendaLine = (event) =>
  event.all_day ? event.title : `${madridParts(new Date(event.starts_at)).time} ${event.title}`;

const eventsOn = (agenda, date) =>
  agenda
    .filter((event) => madridParts(new Date(event.starts_at)).date === date)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

/**
 * Prioritat: membres marcats a l'app, convidats de la família, i si no n'hi ha, tothom.
 */
function recipientsOf(event, members, assignees) {
  const assigned = members.filter((member) =>
    assignees.some((row) => row.event_uid === event.uid && row.member_id === member.id),
  );
  if (assigned.length) return assigned;

  const invited = members.filter((member) =>
    (event.attendee_emails ?? []).includes(member.email),
  );
  return invited.length ? invited : members;
}

function agendaReminders(agenda, members, assignees, date, title, moment) {
  const events = eventsOn(agenda, date);
  return members.flatMap((member) => {
    const own = events.filter((event) => recipientsOf(event, members, assignees).includes(member));
    if (!own.length) return [];
    return [{
      key: `agenda-${date}-${moment}-${member.id}`,
      title,
      body: own.map(agendaLine).join('\n'),
      memberId: member.id,
      target: 'setmana',
    }];
  });
}

/**
 * Decideix què toca avisar en aquest moment.
 * Al matí: cites i tasques d'avui. Al vespre: cites de demà.
 */
export function buildReminders(now, agenda, tasks, members, assignees = []) {
  const { date, hour } = madridParts(now);
  const reminders = [];

  if (hour === EVENING_HOUR) {
    reminders.push(...agendaReminders(agenda, members, assignees, nextDate(date), 'Demà', 'vespre'));
  }

  if (hour === MORNING_HOUR) {
    reminders.push(...agendaReminders(agenda, members, assignees, date, 'Avui', 'mati'));

    const groups = new Map();
    for (const task of tasks) {
      if (task.done_at || task.due_date !== date) continue;
      const owner = task.assignee_id ?? null;
      groups.set(owner, [...(groups.get(owner) ?? []), task.title]);
    }
    for (const [memberId, titles] of groups) {
      reminders.push({
        key: `tasques-${date}-${memberId ?? 'tothom'}`,
        title: 'Tasques d\'avui',
        body: titles.join('\n'),
        memberId,
        target: 'casa',
      });
    }
  }
  return reminders;
}

async function sendPush(subscription, message, vapid, fetcher) {
  const body = await encryptPayload(message, subscription.p256dh, subscription.auth);
  return fetcher(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidAuthorization(subscription.endpoint, vapid),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: '43200',
      urgency: 'normal',
    },
    body,
  });
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Atén la petició de la tasca programada. */
export async function handle(request, env, fetcher = fetch, now = new Date()) {
  if (!env.cronSecret || request.headers.get('x-family-cron') !== env.cronSecret) {
    return json(401, { error: 'no autoritzat' });
  }

  const rest = `${env.supabaseUrl}/rest/v1`;
  const headers = {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
    'content-type': 'application/json',
    'content-profile': 'family',
    'accept-profile': 'family',
  };
  const read = async (path) => {
    const response = await fetcher(`${rest}/${path}`, { headers });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  };

  // Una còpia de l'aviso per a cada membre, que l'app mostra a Novetats.
  const addToInbox = async (reminder, recipients) => {
    if (!recipients.length) return [];
    const saved = await fetcher(`${rest}/reminder_inbox`, {
      method: 'POST',
      headers: { ...headers, prefer: 'return=representation' },
      body: JSON.stringify(
        recipients.map((member) => ({
          member_id: member.id,
          title: reminder.title,
          body: reminder.body,
          target: reminder.target,
        })),
      ),
    });
    if (!saved.ok) throw new Error(`desar novetats: ${saved.status}`);
    return saved.json();
  };

  const input = await request.json().catch(() => ({}));
  const [subscriptions, agenda, tasks, members, assignees] = await Promise.all([
    read('push_subscriptions?select=*'),
    input.test ? [] : read('agenda_events?select=*'),
    input.test ? [] : read('tasks?select=*'),
    input.test ? [] : read('members?select=id,email'),
    input.test ? [] : read('event_assignees?select=*'),
  ]);

  const reminders = input.test
    ? [{ key: null, title: 'Family', body: 'Els avisos funcionen.', memberId: null }]
    : buildReminders(now, agenda, tasks, members, assignees);

  let sent = 0;
  for (const reminder of reminders) {
    // Es reserva abans d'enviar: si ja hi era, un altre intent ja se n'ha encarregat.
    if (reminder.key) {
      const claim = await fetcher(`${rest}/sent_reminders?on_conflict=key`, {
        method: 'POST',
        headers: { ...headers, prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ key: reminder.key }),
      });
      if (!claim.ok) throw new Error(`reservar: ${claim.status}`);
      if (!(await claim.json()).length) continue;
    }

    const recipients = members.filter(
      (member) => !reminder.memberId || member.id === reminder.memberId,
    );
    const inbox = reminder.key ? await addToInbox(reminder, recipients) : [];

    const targets = subscriptions.filter(
      (subscription) => !reminder.memberId || subscription.member_id === reminder.memberId,
    );

    for (const subscription of targets) {
      const entry = inbox.find((row) => row.member_id === subscription.member_id);
      const message = JSON.stringify({
        title: reminder.title,
        body: reminder.body,
        tag: entry?.id,
      });
      const response = await sendPush(subscription, message, env.vapid, fetcher);
      if (response.ok) sent += 1;
      // El mòbil ja no vol avisos, o ha reinstal·lat l'app.
      if (response.status === 404 || response.status === 410) {
        await fetcher(
          `${rest}/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
          { method: 'DELETE', headers },
        );
      }
    }
  }
  // Les novetats de fa més d'un mes ja no es mostren.
  const limit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await fetcher(`${rest}/reminder_inbox?created_at=lt.${encodeURIComponent(limit)}`, {
    method: 'DELETE',
    headers,
  });

  return json(200, { reminders: reminders.length, sent });
}

const runtime = globalThis.Deno;
if (runtime) {
  runtime.serve((request) =>
    handle(request, {
      cronSecret: runtime.env.get('FAMILY_CRON_SECRET'),
      supabaseUrl: runtime.env.get('SUPABASE_URL'),
      serviceKey: runtime.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      vapid: {
        publicKey: runtime.env.get('FAMILY_VAPID_PUBLIC_KEY'),
        privateKey: runtime.env.get('FAMILY_VAPID_PRIVATE_KEY'),
        subject: runtime.env.get('FAMILY_VAPID_SUBJECT'),
      },
    }).catch((error) => json(500, { error: error.message })),
  );
}
