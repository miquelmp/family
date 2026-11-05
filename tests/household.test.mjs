import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  eventDate,
  eventLastDate,
  eventTime,
  eventsOn,
  findProduct,
  newEventLink,
  nextEvent,
  nextRain,
  pendingTasks,
  placeUrl,
  readPlace,
  readWeather,
  shoppingMessage,
  toBuy,
  usualByCategory,
  visibleTasks,
  weatherKind,
  weatherLabel,
  weatherUrl,
} from '../js/household.js';

const items = [
  { id: '1', name: 'Pa', category: 'Rebost', is_usual: true, on_list: true },
  { id: '2', name: 'Cafè', category: 'Begudes', is_usual: true, on_list: false },
  { id: '3', name: 'Àpat & "ràpid"', is_usual: false, on_list: true },
];

test('la llista només inclou el que falta, en ordre', () => {
  assert.deepEqual(toBuy(items).map((item) => item.id), ['3', '1']);
});

test('el text per a WhatsApp conserva accents i salts de línia', () => {
  assert.equal(shoppingMessage(items), 'Llista de la compra:\n- Àpat & "ràpid"\n- Pa');
});

test('els productes es comparen sense majúscules ni espais', () => {
  assert.equal(findProduct(items, '  CAFÈ ').id, '2');
  assert.equal(findProduct(items, 'Arròs'), undefined);
});

test('els habituals s\'agrupen per categoria', () => {
  assert.deepEqual(usualByCategory(items).map((group) => group.category), ['Rebost', 'Begudes']);
});

test('les tasques fetes desapareixen als 2 dies', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const tasks = [
    { id: 'a', done_at: '2026-11-04T10:00:00Z' },
    { id: 'b', done_at: null },
    { id: 'c', done_at: '2026-11-01T10:00:00Z' },
  ];
  assert.deepEqual(visibleTasks(tasks, now).map((task) => task.id), ['b', 'a']);
  assert.deepEqual(pendingTasks(tasks).map((task) => task.id), ['b']);
});

test('l\'agenda usa el dia i l\'hora de Madrid', () => {
  const late = { starts_at: '2026-11-04T23:30:00Z' };
  assert.equal(eventDate(late), '2026-11-05');
  assert.equal(eventTime(late), '00:30');
  assert.equal(eventTime({ starts_at: '2026-11-04T08:30:00Z' }), '09:30');
  assert.equal(eventTime({ all_day: true, starts_at: late.starts_at }), 'Tot el dia');
  assert.deepEqual(eventsOn([late], '2026-11-05'), [late]);
});

test('la pròxima cita ignora les que ja han començat', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const past = { starts_at: '2026-11-04T08:00:00Z' };
  const later = { starts_at: '2026-11-08T12:00:00Z' };
  const allDay = { all_day: true, starts_at: '2026-11-03T23:00:00Z' };
  assert.equal(nextEvent([later, past], now), later);
  assert.equal(nextEvent([later, past, allDay], now), allDay);
  assert.equal(nextEvent([past], now), undefined);
});

test('l\'enllaç de nova cita porta el dia', () => {
  assert.ok(newEventLink('2026-11-30').endsWith('dates=20261130/20261201'));
});

test('la meteo no envia la ubicació exacta', () => {
  const url = new URL(weatherUrl(41.38789, 2.16992));
  assert.equal(url.searchParams.get('latitude'), '41.39');
  assert.equal(url.searchParams.get('longitude'), '2.17');
  assert.equal(url.searchParams.get('timezone'), 'Europe/Madrid');
});

test('la pluja d\'avui no es confon amb la dels pròxims dies', () => {
  const hourly = {
    time: ['2026-11-04T18:00', '2026-11-05T09:00'],
    precipitation_probability: [10, 90],
  };
  assert.equal(nextRain(hourly, '2026-11-04T12:15'), null);
});

test('cada codi meteorològic té la seva icona', () => {
  const kinds = [0, 2, 3, 45, 61, 73, 81, 86, 95].map(weatherKind);
  assert.deepEqual(kinds, ['sun', 'partly', 'cloud', 'fog', 'rain', 'snow', 'rain', 'snow', 'storm']);
});

test('el nom del lloc es tria de la resposta', () => {
  assert.equal(readPlace({ city: 'Girona', locality: 'Centre' }), 'Girona');
  assert.equal(readPlace({ city: '', locality: 'Centre' }), 'Centre');
  assert.equal(readPlace({}), '');
  assert.ok(placeUrl(41.98123, 2.82111).includes('latitude=41.98'));
});

test('la pluja es busca a partir de l\'hora actual', () => {
  const hourly = {
    time: ['2026-11-04T10:00', '2026-11-04T14:00', '2026-11-04T18:00'],
    precipitation_probability: [90, 20, 60],
  };
  assert.equal(nextRain(hourly, '2026-11-04T12:15'), '18:00');
  assert.equal(nextRain(hourly, '2026-11-04T19:15'), null);
});

test('la resposta d\'Open-Meteo es tradueix', () => {
  const weather = readWeather({
    current: { temperature_2m: 16.6, weather_code: 61, time: '2026-11-04T12:15' },
    daily: {
      time: ['2026-11-04'],
      weather_code: [61],
      temperature_2m_max: [20.4],
      temperature_2m_min: [10.5],
      precipitation_probability_max: [70],
    },
    hourly: { time: ['2026-11-04T18:00'], precipitation_probability: [70] },
  });
  assert.deepEqual(weather, {
    temperature: 17,
    max: 20,
    min: 11,
    label: 'Pluja',
    kind: 'rain',
    rainAt: '18:00',
    days: [{ date: '2026-11-04', label: 'Pluja', kind: 'rain', max: 20, min: 11, rain: 70 }],
  });
  assert.equal(weatherLabel(0), 'Cel serè');
  assert.equal(weatherLabel(95), 'Tempesta');
});

test('una cita de diversos dies surt tots els dies', () => {
  const trip = {
    all_day: true,
    starts_at: '2026-11-30T23:00:00Z',
    ends_at: '2026-12-03T23:00:00Z',
  };
  assert.equal(eventLastDate(trip), '2026-12-03');
  for (const day of ['2026-12-01', '2026-12-02', '2026-12-03']) {
    assert.deepEqual(eventsOn([trip], day), [trip]);
  }
  assert.deepEqual(eventsOn([trip], '2026-11-30'), []);
  assert.deepEqual(eventsOn([trip], '2026-12-04'), []);
});

test('una cita d\'un dia de tot el dia només surt aquell dia', () => {
  const day = { all_day: true, starts_at: '2026-11-09T23:00:00Z', ends_at: '2026-11-10T23:00:00Z' };
  assert.deepEqual(eventsOn([day], '2026-11-10'), [day]);
  assert.deepEqual(eventsOn([day], '2026-11-11'), []);
});

test('la pròxima cita inclou un viatge en curs', () => {
  const trip = {
    all_day: true,
    starts_at: '2026-11-30T23:00:00Z',
    ends_at: '2026-12-03T23:00:00Z',
  };
  assert.equal(nextEvent([trip], new Date('2026-12-02T12:00:00Z')), trip);
  assert.equal(nextEvent([trip], new Date('2026-12-04T12:00:00Z')), undefined);
});
