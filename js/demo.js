// Dades inventades per al mode demostració. Aquest fitxer és públic:
// no hi posis mai noms ni dades reals.
import { addDays, madridInstant, weekDates } from './lunch.js';

const everyWeekday = (memberId, days) =>
  days.map((weekday) => ({
    member_id: memberId,
    weekday,
    valid_from: '2026-01-01',
    at_home: true,
  }));

const product = (id, name, category, onList = false) => ({
  id,
  name,
  category,
  is_usual: true,
  on_list: onList,
});

const DISHES = [
  'Arròs amb verdures',
  'Llenties',
  'Crema de carbassa',
  'Pasta al forn',
  'Peix al forn',
  'Paella',
];

export const demoData = (today) => ({
  members: [
    { id: 'p1', display_name: 'Persona 1', short_label: 'P1', color: '#1D4ED8' },
    { id: 'p2', display_name: 'Persona 2', short_label: 'P2', color: '#C2410C' },
    { id: 'p3', display_name: 'Persona 3', short_label: 'P3', color: '#0F766E' },
    { id: 'p4', display_name: 'Persona 4', short_label: 'P4', color: '#6D28D9' },
  ],
  weeklyLunches: [
    ...everyWeekday('p1', [1, 3, 4, 6, 7]),
    ...everyWeekday('p2', [1, 2, 3, 5, 6, 7]),
    ...everyWeekday('p3', [2, 3, 4, 6, 7]),
    ...everyWeekday('p4', [4, 5, 6, 7]),
  ],
  overrides: [],
  menus: weekDates(today)
    .slice(0, DISHES.length)
    .map((lunch_date, index) => ({ lunch_date, dish: DISHES[index] })),
  agenda: [
    { uid: 'a1', title: 'Dentista', starts_at: madridInstant(today, '09:30') },
    { uid: 'a2', title: 'Entrenament', starts_at: madridInstant(today, '18:15') },
    { uid: 'a3', title: 'Dinar amb els avis', starts_at: madridInstant(addDays(today, 3), '13:30') },
  ],
  shopping: [
    product('s1', 'Detergent', 'Neteja', true),
    product('s2', 'Paper higiènic', 'Paper', true),
    product('s3', 'Tovallons', 'Paper'),
    product('s4', 'Aigua', 'Begudes'),
    product('s5', 'Llet', 'Begudes', true),
    product('s6', 'Oli', 'Rebost'),
  ],
  tasks: [
    { id: 't1', title: 'Posar la rentadora', assignee_id: 'p1', due_date: today, done_at: null },
    { id: 't2', title: 'Treure les escombraries', assignee_id: 'p4', due_date: null, done_at: null },
  ],
});

export const demoWeather = {
  temperature: 17,
  max: 20,
  min: 11,
  label: 'Ennuvolat a estones',
  rainAt: '18:00',
};
