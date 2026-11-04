import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// La funció és un .ts sense tipus: es carrega com a JavaScript.
const source = await readFile(
  new URL('../supabase/functions/family-agenda-sync/index.ts', import.meta.url),
  'utf8',
);
const { handle, parseIcal, zonedInstant } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
);

const now = new Date('2026-11-04T12:00:00Z');

const calendar = (...events) =>
  [
    'BEGIN:VCALENDAR',
    ...events.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']),
    'END:VCALENDAR',
    '',
  ].join('\r\n');

test('cita normal amb zona horària', () => {
  const rows = parseIcal(
    calendar([
      'UID:a', 'SUMMARY:Dentista',
      'DTSTART;TZID=Europe/Madrid:20261110T093000',
      'DTEND;TZID=Europe/Madrid:20261110T101500',
    ]),
    now,
  );
  assert.deepEqual(rows, [{
    uid: 'a',
    title: 'Dentista',
    starts_at: '2026-11-10T08:30:00.000Z',
    ends_at: '2026-11-10T09:15:00.000Z',
    all_day: false,
  }]);
});

test('cita en UTC', () => {
  const [row] = parseIcal(calendar(['UID:a', 'DTSTART:20261110T083000Z']), now);
  assert.equal(row.starts_at, '2026-11-10T08:30:00.000Z');
  assert.equal(row.title, '(Sense títol)');
});

test('cita de tot el dia queda a mitjanit de Madrid', () => {
  const [row] = parseIcal(
    calendar(['UID:a', 'SUMMARY:Festa', 'DTSTART;VALUE=DATE:20261110', 'DTEND;VALUE=DATE:20261111']),
    now,
  );
  assert.equal(row.all_day, true);
  assert.equal(row.starts_at, '2026-11-09T23:00:00.000Z');
  assert.equal(row.ends_at, '2026-11-10T23:00:00.000Z');
});

test('cita de tres dies guarda el final', () => {
  const [row] = parseIcal(
    calendar(['UID:a', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20261204']),
    now,
  );
  assert.equal(row.starts_at, '2026-11-30T23:00:00.000Z');
  assert.equal(row.ends_at, '2026-12-03T23:00:00.000Z');
});

test('una cita llarga en curs es manté encara que hagi començat fa dies', () => {
  const rows = parseIcal(
    calendar(['UID:a', 'DTSTART;VALUE=DATE:20261030', 'DTEND;VALUE=DATE:20261106']),
    now,
  );
  assert.equal(rows.length, 1);
});

test('text amb escapaments i línies plegades', () => {
  const [row] = parseIcal(
    'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Dinar\\, avis\\;\r\n  i cosins\r\n'
      + 'DTSTART:20261110T083000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
    now,
  );
  assert.equal(row.title, 'Dinar, avis; i cosins');
});

test('es descarten les cites fora de la finestra i les anul·lades', () => {
  const rows = parseIcal(
    calendar(
      ['UID:vella', 'DTSTART:20260101T083000Z'],
      ['UID:llunyana', 'DTSTART:20270601T083000Z'],
      ['UID:anullada', 'STATUS:CANCELLED', 'DTSTART:20261110T083000Z'],
    ),
    now,
  );
  assert.deepEqual(rows, []);
});

test('repetició setmanal, també després d\'anys', () => {
  const rows = parseIcal(
    calendar([
      'UID:a', 'SUMMARY:Entrenament',
      'DTSTART;TZID=Europe/Madrid:20240101T181500',
      'DTEND;TZID=Europe/Madrid:20240101T193000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
    ]),
    now,
  );
  assert.equal(rows[0].uid, 'a_2026-11-04');
  assert.equal(rows[0].starts_at, '2026-11-04T17:15:00.000Z');
  assert.equal(rows[0].ends_at, '2026-11-04T18:30:00.000Z');
  assert.equal(rows[1].uid, 'a_2026-11-09');
  assert.equal(rows.length, 17);
});

test('la repetició manté l\'hora local amb el canvi d\'hora', () => {
  const later = new Date('2027-03-20T12:00:00Z');
  const rows = parseIcal(
    calendar([
      'UID:a', 'DTSTART;TZID=Europe/Madrid:20270301T100000', 'RRULE:FREQ=WEEKLY',
    ]),
    later,
  );
  assert.equal(rows[0].starts_at, '2027-03-22T09:00:00.000Z');
  assert.equal(rows[1].starts_at, '2027-03-29T08:00:00.000Z');
});

test('COUNT i UNTIL limiten la repetició', () => {
  const counted = parseIcal(
    calendar(['UID:a', 'DTSTART:20261102T083000Z', 'RRULE:FREQ=DAILY;COUNT=4']),
    now,
  );
  assert.deepEqual(counted.map((row) => row.uid), ['a_2026-11-04', 'a_2026-11-05']);

  const until = parseIcal(
    calendar(['UID:a', 'DTSTART:20261102T083000Z', 'RRULE:FREQ=WEEKLY;UNTIL=20261116T235959Z']),
    now,
  );
  assert.deepEqual(until.map((row) => row.uid), ['a_2026-11-09', 'a_2026-11-16']);
});

test('INTERVAL, mensual i anual', () => {
  const fortnight = parseIcal(
    calendar(['UID:a', 'DTSTART:20261102T083000Z', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO']),
    now,
  );
  assert.deepEqual(fortnight.slice(0, 2).map((row) => row.uid), ['a_2026-11-16', 'a_2026-11-30']);

  const secondTuesday = parseIcal(
    calendar(['UID:a', 'DTSTART:20261013T083000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU']),
    now,
  );
  assert.deepEqual(secondTuesday.map((row) => row.uid), ['a_2026-11-10', 'a_2026-12-08']);

  const lastFriday = parseIcal(
    calendar(['UID:a', 'DTSTART:20261030T083000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR']),
    now,
  );
  assert.deepEqual(lastFriday.map((row) => row.uid), ['a_2026-11-27', 'a_2026-12-25']);

  const birthday = parseIcal(
    calendar(['UID:a', 'DTSTART;VALUE=DATE:20101120', 'RRULE:FREQ=YEARLY']),
    now,
  );
  assert.deepEqual(birthday.map((row) => row.uid), ['a_2026-11-20']);
});

test('dies exclosos i cites modificades d\'una sèrie', () => {
  const rows = parseIcal(
    calendar(
      [
        'UID:a', 'SUMMARY:Classe',
        'DTSTART;TZID=Europe/Madrid:20261102T100000',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        'EXDATE;TZID=Europe/Madrid:20261109T100000',
      ],
      [
        'UID:a', 'SUMMARY:Classe moguda',
        'RECURRENCE-ID;TZID=Europe/Madrid:20261116T100000',
        'DTSTART;TZID=Europe/Madrid:20261117T120000',
      ],
    ),
    now,
  );
  assert.deepEqual(
    rows.map((row) => [row.uid, row.title]),
    [['a_2026-11-23', 'Classe'], ['a_2026-11-16', 'Classe moguda']],
  );
  assert.equal(rows[1].starts_at, '2026-11-17T11:00:00.000Z');
});

test('una cita anul·lada d\'una sèrie desapareix', () => {
  const rows = parseIcal(
    calendar(
      ['UID:a', 'DTSTART:20261109T083000Z', 'RRULE:FREQ=WEEKLY;COUNT=2'],
      ['UID:a', 'STATUS:CANCELLED', 'RECURRENCE-ID:20261116T083000Z', 'DTSTART:20261116T083000Z'],
    ),
    now,
  );
  assert.deepEqual(rows.map((row) => row.uid), ['a_2026-11-09']);
});

test('una regla desconeguda conserva la primera cita', () => {
  const rows = parseIcal(
    calendar(['UID:a', 'DTSTART:20261110T083000Z', 'RRULE:FREQ=HOURLY']),
    now,
  );
  assert.deepEqual(rows.map((row) => row.uid), ['a_2026-11-10']);
});

test('hora local a les dues bandes del canvi d\'hora', () => {
  const day = (text) => new Date(`${text}T00:00:00Z`);
  assert.equal(
    zonedInstant(day('2026-07-01'), [12, 0, 0], 'Europe/Madrid').toISOString(),
    '2026-07-01T10:00:00.000Z',
  );
  assert.equal(
    zonedInstant(day('2026-12-01'), [12, 0, 0], 'Europe/Madrid').toISOString(),
    '2026-12-01T11:00:00.000Z',
  );
});

const env = {
  cronSecret: 'secret',
  icalUrl: 'https://calendari.test/private.ics',
  supabaseUrl: 'https://projecte.test',
  serviceKey: 'clau',
};

const request = (secret) =>
  new Request('https://funcio.test', { headers: secret ? { 'x-family-cron': secret } : {} });

test('sense el secret no es fa res', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return new Response('x'); };
  assert.equal((await handle(request(), env, fetcher)).status, 401);
  assert.equal((await handle(request('dolent'), env, fetcher)).status, 401);
  assert.equal((await handle(request('x'), { ...env, cronSecret: '' }, fetcher)).status, 401);
  assert.equal(calls, 0);
});

test('un calendari erroni no esborra l\'agenda', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return new Response('<html>error</html>');
  };
  assert.equal((await handle(request('secret'), env, fetcher)).status, 502);
  assert.deepEqual(calls, [env.icalUrl]);
});

test('desa les cites i esborra les que ja no hi són', async () => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url === env.icalUrl) {
      const soon = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replaceAll('-', '');
      return new Response(calendar(['UID:a', 'SUMMARY:Cita', `DTSTART:${soon}T083000Z`]));
    }
    return new Response(null, { status: 201 });
  };

  const response = await handle(request('secret'), env, fetcher);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { events: 1 });

  const [, save, clean] = calls;
  assert.equal(save.method, 'POST');
  assert.ok(save.url.endsWith('/rest/v1/agenda_events?on_conflict=uid'));
  assert.equal(save.headers['content-profile'], 'family');
  assert.match(save.headers.prefer, /merge-duplicates/);
  const [row] = JSON.parse(save.body);
  assert.equal(row.uid, 'a');

  assert.equal(clean.method, 'DELETE');
  assert.ok(clean.url.includes(`updated_at=lt.${encodeURIComponent(row.updated_at)}`));
});
