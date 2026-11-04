// Copia el calendari Family de Google a family.agenda_events.
// Tot és en un sol fitxer perquè es pugui enganxar a l'editor de Supabase.
// Està escrit sense tipus perquè les proves el puguin executar amb Node.

const DAY = 24 * 60 * 60 * 1000;
const DAYS_BEFORE = 1;
const DAYS_AHEAD = 60;
const MAX_STEPS = 20000;
const DEFAULT_ZONE = 'Europe/Madrid';
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Dates sense hora ni zona, per calcular repeticions en hora local.
const utcDay = (year, month, day) => new Date(Date.UTC(year, month - 1, day));
const dayKey = (date) => date.toISOString().slice(0, 10);
const shift = (date, days) => new Date(date.getTime() + days * DAY);

function zoneOffset(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

/** Converteix una hora local d'una zona en un instant real. */
export function zonedInstant(date, time, timeZone) {
  const [hour, minute, second] = time;
  const wall = Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, second,
  );
  let instant = new Date(wall);
  for (let round = 0; round < 2; round += 1) {
    instant = new Date(wall - zoneOffset(instant, timeZone));
  }
  return instant;
}

function parseStamp(value, params) {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, utc] = match;
  return {
    date: utcDay(Number(year), Number(month), Number(day)),
    time: [Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0)],
    allDay: hour === undefined,
    zone: utc ? 'UTC' : (params.TZID ?? DEFAULT_ZONE),
  };
}

const stampInstant = (stamp) => zonedInstant(stamp.date, stamp.time, stamp.zone);

const unescapeText = (value) =>
  value
    .replace(/\\n/gi, '\n')
    .replace(/\\([,;\\])/g, '$1');

function parseRule(value) {
  const rule = Object.fromEntries(value.split(';').map((part) => part.split('=')));
  return {
    freq: rule.FREQ,
    interval: Number(rule.INTERVAL ?? 1),
    count: rule.COUNT ? Number(rule.COUNT) : null,
    until: rule.UNTIL ? parseStamp(rule.UNTIL, {}) : null,
    byDay: rule.BYDAY ? rule.BYDAY.split(',') : [],
    byMonthDay: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : [],
  };
}

/** Separa el fitxer en esdeveniments, amb les línies plegades ja unides. */
function readEvents(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { exdates: [] };
    } else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const [name, ...rawParams] = line.slice(0, colon).split(';');
      const value = line.slice(colon + 1);
      const params = Object.fromEntries(rawParams.map((part) => part.split('=')));

      if (name === 'UID') current.uid = value;
      if (name === 'SUMMARY') current.title = unescapeText(value);
      if (name === 'STATUS') current.status = value;
      if (name === 'DTSTART') current.start = parseStamp(value, params);
      if (name === 'DTEND') current.end = parseStamp(value, params);
      if (name === 'RRULE') current.rule = parseRule(value);
      if (name === 'RECURRENCE-ID') current.recurrenceId = parseStamp(value, params);
      if (name === 'EXDATE') {
        current.exdates.push(...value.split(',').map((part) => parseStamp(part, params)));
      }
    }
  }
  return events.filter((event) => event.uid && event.start);
}

const nthWeekdays = (year, month, weekday, nth) => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const matches = [];
  for (let day = 1; day <= lastDay; day += 1) {
    if (utcDay(year, month, day).getUTCDay() === weekday) matches.push(day);
  }
  if (nth === 0) return matches;
  const picked = nth > 0 ? matches[nth - 1] : matches[matches.length + nth];
  return picked ? [picked] : [];
};

function monthDays(rule, start, year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (rule.byDay.length) {
    return rule.byDay
      .flatMap((entry) => {
        const [, nth, name] = /^(-?\d*)([A-Z]{2})$/.exec(entry);
        return nthWeekdays(year, month, WEEKDAYS.indexOf(name), Number(nth || 0));
      })
      .sort((a, b) => a - b);
  }
  if (rule.byMonthDay.length) {
    return rule.byMonthDay
      .map((day) => (day < 0 ? lastDay + day + 1 : day))
      .filter((day) => day >= 1 && day <= lastDay)
      .sort((a, b) => a - b);
  }
  const day = start.getUTCDate();
  return day <= lastDay ? [day] : [];
}

/** Dates candidates d'un període, en ordre. Retorna null quan la regla no es coneix. */
function datesOfPeriod(rule, start, index) {
  const step = index * rule.interval;
  if (rule.freq === 'DAILY') return [shift(start, step)];

  if (rule.freq === 'WEEKLY') {
    const monday = shift(start, -((start.getUTCDay() + 6) % 7) + step * 7);
    const days = rule.byDay.length
      ? rule.byDay.map((name) => WEEKDAYS.indexOf(name.slice(-2)))
      : [start.getUTCDay()];
    return days.map((day) => shift(monday, (day + 6) % 7)).sort((a, b) => a - b);
  }

  if (rule.freq === 'MONTHLY') {
    const total = start.getUTCFullYear() * 12 + start.getUTCMonth() + step;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    return monthDays(rule, start, year, month).map((day) => utcDay(year, month, day));
  }

  if (rule.freq === 'YEARLY') {
    const year = start.getUTCFullYear() + step;
    const candidate = utcDay(year, start.getUTCMonth() + 1, start.getUTCDate());
    return candidate.getUTCMonth() === start.getUTCMonth() ? [candidate] : [];
  }
  return null;
}

/** Totes les dates d'una cita repetida fins a windowEnd. */
function occurrences(event, windowEnd) {
  const { start, rule } = event;
  const limit = rule.until ? stampInstant(rule.until) : null;
  const found = [];
  let produced = 0;

  for (let index = 0; index < MAX_STEPS; index += 1) {
    const dates = datesOfPeriod(rule, start.date, index);
    if (!dates) return [start.date];

    for (const date of dates) {
      if (date < start.date) continue;
      const instant = zonedInstant(date, start.time, start.zone);
      if (instant > windowEnd || (limit && instant > limit)) return found;
      if (rule.count !== null && produced >= rule.count) return found;
      produced += 1;
      found.push(date);
    }
    if (dates.length && dates[0] > shift(new Date(windowEnd), 1)) return found;
  }
  return found;
}

const toRow = (event, uid, date, durationMs) => {
  const startsAt = zonedInstant(date, event.start.time, event.start.zone);
  return {
    uid,
    title: event.title || '(Sense títol)',
    starts_at: event.start.allDay
      ? zonedInstant(date, [0, 0, 0], DEFAULT_ZONE).toISOString()
      : startsAt.toISOString(),
    ends_at: durationMs === null ? null : new Date(startsAt.getTime() + durationMs).toISOString(),
    all_day: event.start.allDay,
  };
};

/** Converteix un fitxer iCal en les files de l'agenda dins de la finestra indicada. */
export function parseIcal(text, now = new Date()) {
  const windowStart = new Date(now.getTime() - DAYS_BEFORE * DAY);
  const windowEnd = new Date(now.getTime() + DAYS_AHEAD * DAY);
  const events = readEvents(text);

  // Una cita canviada o anul·lada d'una sèrie substitueix l'original d'aquell dia.
  const replaced = new Set(
    events
      .filter((event) => event.recurrenceId)
      .map((event) => `${event.uid}|${stampInstant(event.recurrenceId).toISOString()}`),
  );

  const rows = [];
  for (const event of events) {
    if (event.status === 'CANCELLED') continue;

    const durationMs = event.end && !event.start.allDay
      ? stampInstant(event.end) - stampInstant(event.start)
      : null;

    if (event.recurrenceId) {
      const key = dayKey(event.recurrenceId.date);
      rows.push(toRow(event, `${event.uid}_${key}`, event.start.date, durationMs));
      continue;
    }
    if (!event.rule) {
      rows.push(toRow(event, event.uid, event.start.date, durationMs));
      continue;
    }

    const excluded = new Set(event.exdates.map((stamp) => stampInstant(stamp).toISOString()));
    for (const date of occurrences(event, windowEnd)) {
      const instant = zonedInstant(date, event.start.time, event.start.zone).toISOString();
      if (!excluded.has(instant) && !replaced.has(`${event.uid}|${instant}`)) {
        rows.push(toRow(event, `${event.uid}_${dayKey(date)}`, date, durationMs));
      }
    }
  }

  return rows.filter((row) => {
    const startsAt = new Date(row.starts_at);
    return startsAt >= windowStart && startsAt <= windowEnd;
  });
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Atén la petició de la tasca programada. */
export async function handle(request, env, fetcher = fetch) {
  if (!env.cronSecret || request.headers.get('x-family-cron') !== env.cronSecret) {
    return json(401, { error: 'no autoritzat' });
  }

  const calendar = await fetcher(env.icalUrl);
  if (!calendar.ok) return json(502, { error: `calendari ${calendar.status}` });

  // Un fitxer que no sigui un calendari no pot esborrar l'agenda.
  const text = await calendar.text();
  if (!text.includes('BEGIN:VCALENDAR')) return json(502, { error: 'calendari no vàlid' });

  const syncedAt = new Date().toISOString();
  const rows = parseIcal(text).map((row) => ({ ...row, updated_at: syncedAt }));
  const table = `${env.supabaseUrl}/rest/v1/agenda_events`;
  const headers = {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
    'content-type': 'application/json',
    'content-profile': 'family',
    'accept-profile': 'family',
  };

  if (rows.length) {
    const saved = await fetcher(`${table}?on_conflict=uid`, {
      method: 'POST',
      headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!saved.ok) return json(500, { error: `desar ${saved.status}: ${await saved.text()}` });
  }

  // El que no s'ha tornat a veure ja no és al calendari.
  const removed = await fetcher(
    `${table}?updated_at=lt.${encodeURIComponent(syncedAt)}`,
    { method: 'DELETE', headers },
  );
  if (!removed.ok) return json(500, { error: `netejar ${removed.status}: ${await removed.text()}` });

  return json(200, { events: rows.length });
}

const runtime = globalThis.Deno;
if (runtime) {
  runtime.serve((request) =>
    handle(request, {
      cronSecret: runtime.env.get('FAMILY_CRON_SECRET'),
      icalUrl: runtime.env.get('FAMILY_ICAL_URL'),
      supabaseUrl: runtime.env.get('SUPABASE_URL'),
      serviceKey: runtime.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    }),
  );
}
