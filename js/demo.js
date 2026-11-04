// Dades inventades per al mode demostració. Aquest fitxer és públic:
// no hi posis mai noms ni dades reals.

const everyWeekday = (memberId, days) =>
  days.map((weekday) => ({
    member_id: memberId,
    weekday,
    valid_from: '2026-01-01',
    at_home: true,
  }));

export const demo = {
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
  menusByWeekday: {
    1: 'Arròs amb verdures',
    2: 'Llenties',
    3: 'Crema de carbassa',
    4: 'Pasta al forn',
    5: 'Peix al forn',
    6: 'Paella',
    7: 'Dinar fora',
  },
  agenda: [
    { time: '09:30', title: 'Dentista', note: 'Persona 3, l\'acompanya Persona 1', memberId: 'p3' },
    { time: '14:00', title: 'Dinar a casa', note: 'Cuina Persona 2', memberId: 'p2' },
    { time: '18:15', title: 'Entrenament', note: 'Recull Persona 1 a les 19:30', memberId: 'p4' },
  ],
  shopping: [
    { id: 's1', name: 'Detergent', onList: true },
    { id: 's2', name: 'Paper WC', onList: true },
    { id: 's3', name: 'Begudes', onList: false },
    { id: 's4', name: 'Llet', onList: true },
    { id: 's5', name: 'Cafè', onList: false },
    { id: 's6', name: 'Oli', onList: false },
  ],
  tasks: [
    { id: 't1', title: 'Posar la rentadora', memberId: 'p1', done: false },
    { id: 't2', title: 'Treure les escombraries', memberId: 'p4', done: false },
    { id: 't3', title: 'Parar taula', memberId: 'p3', done: true },
  ],
};
