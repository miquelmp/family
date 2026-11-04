// Regles de la compra, les tasques, l'agenda i la meteo.
// No depèn del navegador, així es pot provar sola.
import { addDays, todayInMadrid } from './lunch.js';

const TIME_ZONE = 'Europe/Madrid';

export const toBuy = (items) =>
  items.filter((item) => item.on_list).sort((a, b) => a.name.localeCompare(b.name, 'ca'));

export const usualByCategory = (items) => {
  const groups = new Map();
  for (const item of items.filter((entry) => entry.is_usual)) {
    const category = item.category ?? 'Altres';
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups].map(([category, products]) => ({ category, products }));
};

export const findProduct = (items, name) => {
  const wanted = name.trim().toLocaleLowerCase('ca');
  return items.find((item) => item.name.toLocaleLowerCase('ca') === wanted);
};

export const shoppingMessage = (items) =>
  ['Llista de la compra:', ...toBuy(items).map((item) => `- ${item.name}`)].join('\n');

/** Pendents, i les fetes durant els últims 2 dies. */
export const visibleTasks = (tasks, now = new Date()) => {
  const limit = now.getTime() - 2 * 24 * 60 * 60 * 1000;
  return tasks
    .filter((task) => !task.done_at || new Date(task.done_at).getTime() >= limit)
    .sort((a, b) => Boolean(a.done_at) - Boolean(b.done_at));
};

export const pendingTasks = (tasks) => tasks.filter((task) => !task.done_at);

export const eventDate = (event) => todayInMadrid(new Date(event.starts_at));

export const eventTime = (event) =>
  event.all_day
    ? 'Tot el dia'
    : new Intl.DateTimeFormat('ca', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(event.starts_at));

const byStart = (a, b) => new Date(a.starts_at) - new Date(b.starts_at);

export const eventsOn = (agenda, isoDate) =>
  agenda.filter((event) => eventDate(event) === isoDate).sort(byStart);

/** Pròxima cita que encara no ha començat. Les de tot el dia compten tot el dia. */
export const nextEvent = (agenda, now = new Date()) =>
  [...agenda]
    .sort(byStart)
    .find((event) =>
      event.all_day
        ? eventDate(event) >= todayInMadrid(now)
        : new Date(event.starts_at) >= now,
    );

/** Enllaç que obre Google Calendar amb el formulari preomplert. */
export const newEventLink = (isoDate) => {
  const start = isoDate.replaceAll('-', '');
  const end = addDays(isoDate, 1).replaceAll('-', '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${start}/${end}`;
};

export const weatherUrl = (latitude, longitude) => {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    hourly: 'precipitation_probability',
    timezone: TIME_ZONE,
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
};

const WEATHER_LABELS = [
  [0, 'Cel serè'],
  [2, 'Ennuvolat a estones'],
  [3, 'Ennuvolat'],
  [48, 'Boira'],
  [57, 'Plugim'],
  [67, 'Pluja'],
  [77, 'Neu'],
  [82, 'Ruixats'],
  [86, 'Neu'],
  [99, 'Tempesta'],
];

export const weatherLabel = (code) =>
  WEATHER_LABELS.find(([limit]) => code <= limit)?.[1] ?? 'Temps variable';

/** Primera hora d'avui, a partir d'ara, amb un 50% o més de probabilitat de pluja. */
export const nextRain = (hourly, currentTime) => {
  const hour = currentTime.slice(0, 13);
  const index = hourly.time.findIndex(
    (time, position) =>
      time.slice(0, 13) >= hour && hourly.precipitation_probability[position] >= 50,
  );
  return index === -1 ? null : hourly.time[index].slice(11, 16);
};

export const readWeather = (data) => ({
  temperature: Math.round(data.current.temperature_2m),
  max: Math.round(data.daily.temperature_2m_max[0]),
  min: Math.round(data.daily.temperature_2m_min[0]),
  label: weatherLabel(data.current.weather_code),
  rainAt: nextRain(data.hourly, data.current.time),
});
