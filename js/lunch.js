// Regles dels dinars. No depèn del navegador, així es pot provar sola.

const TIME_ZONE = 'Europe/Madrid';

/** Data d'avui a Madrid, en format AAAA-MM-DD. */
export function todayInMadrid(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Instant corresponent a una data i hora de Madrid, en format ISO. */
export function madridInstant(isoDate, time) {
  const utcGuess = new Date(`${isoDate}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(utcGuess)
    .find((part) => part.type === 'timeZoneName')
    .value.replace('GMT', '');
  return new Date(`${isoDate}T${time}:00${offset || 'Z'}`).toISOString();
}

function toUtc(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Dia de la setmana: 1 dilluns, 7 diumenge. */
export function isoWeekday(isoDate) {
  return toUtc(isoDate).getUTCDay() || 7;
}

export function addDays(isoDate, days) {
  const date = toUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Els 7 dies de la setmana d'una data, de dilluns a diumenge. */
export function weekDates(isoDate) {
  const monday = addDays(isoDate, 1 - isoWeekday(isoDate));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export const DEFAULT_LUNCH_TIME = '14:30';

/** Les hores es guarden com a 14:30:00; aquí es fan servir com a 14:30. */
const shortTime = (value) => (value ? value.slice(0, 5) : null);

/**
 * Estat del dinar d'un membre una data: { atHome, time }.
 * time és null quan dina a l'hora habitual o no dina a casa.
 * Prioritat: canvi puntual, setmana tipus vigent aquell dia, i si no n'hi ha cap, fora.
 */
export function lunchStatus(memberId, isoDate, weeklyRows, overrides) {
  const override = overrides.find(
    (row) => row.member_id === memberId && row.lunch_date === isoDate,
  );
  const weekday = isoWeekday(isoDate);
  const row =
    override ??
    weeklyRows
      .filter(
        (entry) =>
          entry.member_id === memberId &&
          entry.weekday === weekday &&
          entry.valid_from <= isoDate,
      )
      .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];

  if (!row?.at_home) return { atHome: false, time: null };
  return { atHome: true, time: shortTime(row.lunch_time) };
}

export const isAtHome = (memberId, isoDate, weeklyRows, overrides) =>
  lunchStatus(memberId, isoDate, weeklyRows, overrides).atHome;

/** Tothom dina a casa, a l'hora que sigui. */
export function allHome(memberIds, isoDate, weeklyRows, overrides) {
  return (
    memberIds.length > 0 &&
    memberIds.every((id) => isAtHome(id, isoDate, weeklyRows, overrides))
  );
}

/** "Tots junts": tothom dina a casa i a la mateixa hora. */
export function allTogether(memberIds, isoDate, weeklyRows, overrides, defaultTime = DEFAULT_LUNCH_TIME) {
  if (!allHome(memberIds, isoDate, weeklyRows, overrides)) return false;
  const times = new Set(
    memberIds.map((id) => lunchStatus(id, isoDate, weeklyRows, overrides).time ?? defaultTime),
  );
  return times.size === 1;
}
