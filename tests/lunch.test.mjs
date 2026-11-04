import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  allTogether,
  isAtHome,
  isoWeekday,
  todayInMadrid,
  weekDates,
} from '../js/lunch.js';

const weekly = [
  { member_id: 'a', weekday: 3, valid_from: '2026-01-01', at_home: true },
  { member_id: 'a', weekday: 3, valid_from: '2026-11-10', at_home: false },
  { member_id: 'b', weekday: 3, valid_from: '2026-01-01', at_home: true },
];

test('dies de la setmana de dilluns a diumenge', () => {
  assert.equal(isoWeekday('2026-11-02'), 1);
  assert.equal(isoWeekday('2026-11-04'), 3);
  assert.equal(isoWeekday('2026-11-08'), 7);
  assert.deepEqual(weekDates('2026-11-08').slice(0, 2), ['2026-11-02', '2026-11-03']);
  assert.equal(weekDates('2026-11-02').at(-1), '2026-11-08');
});

test('les dates no es desplacen amb el canvi d\'hora', () => {
  assert.equal(addDays('2027-03-27', 1), '2027-03-28');
  assert.equal(addDays('2027-03-28', 1), '2027-03-29');
  assert.equal(isoWeekday('2027-03-28'), 7);
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
});

test('avui es calcula a l\'hora de Madrid', () => {
  assert.equal(todayInMadrid(new Date('2026-11-04T23:30:00Z')), '2026-11-05');
  assert.equal(todayInMadrid(new Date('2027-03-28T00:59:00Z')), '2027-03-28');
  assert.equal(todayInMadrid(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
});

test('la setmana tipus nova no canvia els dies anteriors', () => {
  assert.equal(isAtHome('a', '2026-11-04', weekly, []), true);
  assert.equal(isAtHome('a', '2026-11-11', weekly, []), false);
});

test('un canvi puntual només afecta la seva data', () => {
  const overrides = [{ member_id: 'b', lunch_date: '2026-11-04', at_home: false }];
  assert.equal(isAtHome('b', '2026-11-04', weekly, overrides), false);
  assert.equal(isAtHome('b', '2026-11-11', weekly, overrides), true);
});

test('un canvi puntual es manté encara que canviï la setmana tipus', () => {
  const overrides = [{ member_id: 'a', lunch_date: '2026-11-18', at_home: true }];
  assert.equal(isAtHome('a', '2026-11-18', weekly, overrides), true);
});

test('sense dades, el membre no consta a casa', () => {
  assert.equal(isAtHome('c', '2026-11-04', weekly, []), false);
});

test('Tots junts només si tots dinen a casa', () => {
  assert.equal(allTogether(['a', 'b'], '2026-11-04', weekly, []), true);
  assert.equal(allTogether(['a', 'b'], '2026-11-11', weekly, []), false);
  assert.equal(allTogether([], '2026-11-04', weekly, []), false);
});
