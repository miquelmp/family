import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  eventDate,
  eventTime,
  eventsOn,
  findProduct,
  newEventLink,
  nextEvent,
  nextRain,
  pendingTasks,
  readWeather,
  shoppingMessage,
  toBuy,
  usualByCategory,
  visibleTasks,
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
    daily: { temperature_2m_max: [20.4], temperature_2m_min: [10.5] },
    hourly: { time: ['2026-11-04T18:00'], precipitation_probability: [70] },
  });
  assert.deepEqual(weather, { temperature: 17, max: 20, min: 11, label: 'Pluja', rainAt: '18:00' });
  assert.equal(weatherLabel(0), 'Cel serè');
  assert.equal(weatherLabel(95), 'Tempesta');
});
