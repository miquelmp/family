// Regles de la compra, les tasques, l'agenda i la meteo.
// No depèn del navegador, així es pot provar sola.
import { addDays, todayInMadrid } from './lunch.js';

const TIME_ZONE = 'Europe/Madrid';

const SWIPE_TABS = ['avui', 'setmana', 'casa'];
const SWIPE_DISTANCE = 60;

/**
 * Pantalla a la qual porta un lliscament, o null si no n'ha de canviar.
 * Ha de ser clarament horitzontal, perquè pujar i baixar no canviï de pantalla.
 */
export const swipeTarget = (current, deltaX, deltaY) => {
  if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) < 2 * Math.abs(deltaY)) return null;
  const index = SWIPE_TABS.indexOf(current || 'avui');
  if (index === -1) return null;
  return SWIPE_TABS[index + (deltaX < 0 ? 1 : -1)] ?? null;
};

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

/** Últim dia d'una cita. En les de tot el dia, ends_at és l'inici del dia següent. */
export const eventLastDate = (event) => {
  if (!event.ends_at) return eventDate(event);
  const end = todayInMadrid(new Date(event.ends_at));
  const last = event.all_day ? addDays(end, -1) : end;
  return last > eventDate(event) ? last : eventDate(event);
};

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
  agenda
    .filter((event) => eventDate(event) <= isoDate && isoDate <= eventLastDate(event))
    .sort(byStart);

/** Pròxima cita que encara no ha començat. Les de tot el dia compten tot el dia. */
export const nextEvent = (agenda, now = new Date()) =>
  [...agenda]
    .sort(byStart)
    .find((event) =>
      event.all_day
        ? eventLastDate(event) >= todayInMadrid(now)
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
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    hourly: 'precipitation_probability',
    timezone: TIME_ZONE,
    forecast_days: '7',
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

/** Tipus d'icona de cada codi meteorològic. */
export const weatherKind = (code) => {
  if (code === 0) return 'sun';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
};

export const weatherLabel = (code) =>
  WEATHER_LABELS.find(([limit]) => code <= limit)?.[1] ?? 'Temps variable';

/** Nom del lloc a partir de les coordenades, sense necessitat de clau. */
export const placeUrl = (latitude, longitude) => {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    localityLanguage: 'ca',
  });
  return `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`;
};

export const readPlace = (data) =>
  data.city || data.locality || data.principalSubdivision || '';

/** Primera hora d'avui, a partir d'ara, amb un 50% o més de probabilitat de pluja. */
export const nextRain = (hourly, currentTime) => {
  const hour = currentTime.slice(0, 13);
  const today = currentTime.slice(0, 10);
  const index = hourly.time.findIndex(
    (time, position) =>
      time.slice(0, 10) === today &&
      time.slice(0, 13) >= hour &&
      hourly.precipitation_probability[position] >= 50,
  );
  return index === -1 ? null : hourly.time[index].slice(11, 16);
};

export const readWeather = (data) => ({
  temperature: Math.round(data.current.temperature_2m),
  max: Math.round(data.daily.temperature_2m_max[0]),
  min: Math.round(data.daily.temperature_2m_min[0]),
  label: weatherLabel(data.current.weather_code),
  kind: weatherKind(data.current.weather_code),
  rainAt: nextRain(data.hourly, data.current.time),
  days: data.daily.time.map((date, index) => ({
    date,
    label: weatherLabel(data.daily.weather_code[index]),
    kind: weatherKind(data.daily.weather_code[index]),
    max: Math.round(data.daily.temperature_2m_max[index]),
    min: Math.round(data.daily.temperature_2m_min[index]),
    rain: data.daily.precipitation_probability_max[index],
  })),
});
